/**
 * Frankfurter exchange-rate client with an in-memory cache.
 *
 * The Frankfurter API (https://frankfurter.dev) is a free, open-source,
 * ECB-sourced foreign exchange rate service. No API key is required.
 *
 * Reference rates are published by the European Central Bank around 16:00 CET
 * on each TARGET business day. Because publication is daily, we cache fetched
 * rates for up to 24 hours to avoid hammering the API.
 */

const API_BASE = "https://api.frankfurter.dev/v1";

/** 24-hour cache TTL, in milliseconds. ECB publishes daily. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Shape of a Frankfurter rate response (latest or historical). */
export interface RateResponse {
  /** The requested amount (defaults to 1). */
  amount: number;
  /** The base currency code, e.g. "EUR". */
  base: string;
  /** ISO date the rates apply to, e.g. "2026-06-28". */
  date: string;
  /** Mapping of target currency code → exchange rate. */
  rates: Record<string, number>;
}

/** Result of converting an amount from one currency to another. */
export interface ConvertResult {
  original_amount: number;
  original_currency: string;
  converted_amount: number;
  converted_currency: string;
  rate: number;
  rate_date: string;
  source: "frankfurter";
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface CacheEntry {
  /** The full Frankfurter response stored in cache. */
  rates: RateResponse;
  /** Wall-clock time (ms) at which the cache entry was populated. */
  timestamp: number;
  /** ISO date string copied from the API response for convenience. */
  date: string;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/** In-memory cache keyed by `${from}-${to}` (to is comma-joined, sorted). */
const cache = new Map<string, CacheEntry>();

/** Build a deterministic cache key for a (from, to[]) pair. */
function cacheKey(from: string, to: string[]): string {
  const sortedTo = [...to].map((c) => c.trim().toUpperCase()).sort();
  return `${from.trim().toUpperCase()}-${sortedTo.join(",")}`;
}

/**
 * Empty the in-memory rate cache.
 *
 * Useful for tests, for forcing a refresh, or when the user switches base
 * currency contexts and you want to free the memory.
 */
export function clearCache(): void {
  cache.clear();
}

// ---------------------------------------------------------------------------
// Internal fetch helpers
// ---------------------------------------------------------------------------

/**
 * Normalize the `to` argument into a comma-joined string of codes.
 * Accepts either a single currency code or an array of them.
 */
function normalizeTo(to: string | string[]): string[] {
  const arr = Array.isArray(to) ? to : [to];
  return arr.map((c) => c.trim().toUpperCase()).filter(Boolean);
}

/**
 * Build the query string for a Frankfurter request.
 * Frankfurter wants `to` as a single comma-separated value, e.g. `to=USD,INR`.
 */
function buildQuery(from: string, to: string | string[]): string {
  const toList = normalizeTo(to);
  const params = new URLSearchParams({
    from: from.trim().toUpperCase(),
    to: toList.join(","),
  });
  return params.toString();
}

/**
 * Low-level Frankfurter GET. Validates the response shape and throws a
 * descriptive error on any failure.
 */
async function fetchRates(
  path: string,
  from: string,
  to: string | string[],
): Promise<RateResponse> {
  const url = `${API_BASE}${path}?${buildQuery(from, to)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[exchange] Network error fetching ${url}: ${detail}`,
    );
  }

  if (!res.ok) {
    let body = "";
    try {
      body = await res.text();
    } catch {
      /* ignore — body may be empty */
    }
    throw new Error(
      `[exchange] Frankfurter API returned ${res.status} ${res.statusText} for ${url}` +
        (body ? `: ${body}` : ""),
    );
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`[exchange] Failed to parse JSON from ${url}: ${detail}`);
  }

  if (!isValidRateResponse(json)) {
    throw new Error(
      `[exchange] Unexpected response shape from ${url}: ${JSON.stringify(json)}`,
    );
  }

  return json;
}

/** Runtime type guard for the Frankfurter response shape. */
function isValidRateResponse(x: unknown): x is RateResponse {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.amount === "number" &&
    typeof o.base === "string" &&
    typeof o.date === "string" &&
    typeof o.rates === "object" &&
    o.rates !== null
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the latest available exchange rates.
 *
 * @param from - Base currency code, e.g. "EUR".
 * @param to   - One target currency code, or an array of them.
 */
export async function getLatestRate(
  from: string,
  to: string | string[],
): Promise<RateResponse> {
  return fetchRates("/latest", from, to);
}

/**
 * Fetch historical exchange rates for a specific date.
 *
 * @param date - ISO date string (YYYY-MM-DD), e.g. "2026-06-15".
 * @param from - Base currency code, e.g. "EUR".
 * @param to   - One target currency code, or an array of them.
 */
export async function getHistoricalRate(
  date: string,
  from: string,
  to: string | string[],
): Promise<RateResponse> {
  // Validate the date format loosely; Frankfurter expects YYYY-MM-DD.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(
      `[exchange] getHistoricalRate: date must be in YYYY-MM-DD format, got '${date}'`,
    );
  }
  return fetchRates(`/${date}`, from, to);
}

/**
 * Fetch rates, using a 24h in-memory cache to avoid redundant API calls.
 *
 * Cache is keyed by `${from}-${to}` (with `to` sorted). If a fresh entry
 * (< 24h old) exists it is returned immediately; otherwise a new request is
 * made and the cache is updated.
 *
 * @param from - Base currency code, e.g. "EUR".
 * @param to   - Array of target currency codes.
 */
export async function getCachedRates(
  from: string,
  to: string[],
): Promise<RateResponse> {
  const key = cacheKey(from, to);
  const now = Date.now();

  const hit = cache.get(key);
  if (hit && now - hit.timestamp < CACHE_TTL_MS) {
    return hit.rates;
  }

  const fresh = await getLatestRate(from, to);
  cache.set(key, {
    rates: fresh,
    timestamp: now,
    date: fresh.date,
  });
  return fresh;
}

/**
 * Convert a monetary amount from one currency to another.
 *
 * If a `rate` is supplied explicitly it is used directly (useful for batch
 * conversions sharing one fetched rate, or for historical/bookkeeping rates).
 * Otherwise the latest rate is fetched from Frankfurter.
 *
 * If `from === to`, conversion is a no-op and the rate is 1 (no API call).
 *
 * @param amount - The monetary amount to convert.
 * @param from   - Source currency code, e.g. "EUR".
 * @param to     - Target currency code, e.g. "USD".
 * @param rate   - Optional pre-fetched rate to apply instead of calling the API.
 */
export async function convert(
  amount: number,
  from: string,
  to: string,
  rate?: number,
): Promise<ConvertResult> {
  const fromUp = from.trim().toUpperCase();
  const toUp = to.trim().toUpperCase();

  // Same-currency shortcut — no conversion, no network call.
  if (fromUp === toUp) {
    return {
      original_amount: amount,
      original_currency: fromUp,
      converted_amount: amount,
      converted_currency: toUp,
      rate: 1,
      rate_date: new Date().toISOString().slice(0, 10),
      source: "frankfurter",
    };
  }

  let appliedRate: number;
  let rateDate: string;

  if (rate !== undefined) {
    appliedRate = rate;
    rateDate = new Date().toISOString().slice(0, 10);
  } else {
    const resp = await getLatestRate(fromUp, toUp);
    const lookedUp = resp.rates[toUp];
    if (typeof lookedUp !== "number") {
      throw new Error(
        `[exchange] convert: Frankfurter response for ${fromUp}→${toUp} did not include a rate for '${toUp}'`,
      );
    }
    appliedRate = lookedUp;
    rateDate = resp.date;
  }

  return {
    original_amount: amount,
    original_currency: fromUp,
    converted_amount: amount * appliedRate,
    converted_currency: toUp,
    rate: appliedRate,
    rate_date: rateDate,
    source: "frankfurter",
  };
}
