/**
 * format.ts — Display formatting helpers shared across the UI.
 *
 * All currency/date formatting goes through Intl so we get proper grouping and
 * locale-aware symbols for free (€, ₹, $, Kč, …). Currency symbols are rendered
 * by the Intl engine; we don't hardcode them in templates.
 */

import {
  ACCOUNT_TYPES,
  CURRENCY_INFO,
  type Account,
  type AccountType,
  type Transaction,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/*  getErrorMessage() — safe string extraction from unknown errors             */
/* -------------------------------------------------------------------------- */

/**
 * Safely extract a human-readable message from a value caught as `unknown`.
 *
 *   getErrorMessage(new Error("boom"))  → "boom"
 *   getErrorMessage("oops")             → "oops"
 *   getErrorException({ code: 500 })    → "[object Object]"
 *
 * Use this in `catch (e: unknown)` blocks instead of reaching for `e.message`,
 * which is not type-safe when the caught value is `unknown`.
 */
export function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Check if an error is a Google Drive auth error (expired/invalid token).
 * Used by API routes to return 401 instead of 500, so the frontend
 * can auto-redirect to the re-login flow.
 */
export function isDriveAuthError(message: string): boolean {
  return /invalid authentication credentials|invalid_grant|401|unauthorized/i.test(message);
}

/**
 * Check if a fetch response is a 401 (auth expired) and redirect to re-login.
 * Call this after every API fetch in client components.
 * Returns true if the response was a 401 (caller should bail out).
 */
export function checkAuthExpired(res: Response): boolean {
  if (res.status === 401) {
    window.location.href = "/api/auth/login?force_consent=true";
    return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/*  cn() — classname merger                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Merge class names, dropping any falsy values. A tinyclsx/clsx-lite: handles
 * strings, numbers (truthy), and arrays/objects are NOT supported (we don't
 * need them). Use plain conditional expressions for conditional classes.
 *
 *   cn("px-2", isActive && "bg-emerald-600", null, undefined, "text-white")
 *   => "px-2 bg-emerald-600 text-white"
 */
export function cn(...inputs: Array<string | false | null | undefined | 0>): string {
  return inputs.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/*  Currency                                                                   */
/* -------------------------------------------------------------------------- */

/** Cache of Intl.NumberFormat instances — these are expensive to construct. */
const currencyFormatterCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(currency: string): Intl.NumberFormat {
  let fmt = currencyFormatterCache.get(currency);
  if (!fmt) {
    // Prefer the currency's native display so € amounts look European and ₹
    // amounts look Indian. Fall back to code if Intl doesn't know the currency.
    try {
      fmt = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        currencyDisplay: "symbol",
        minimumFractionDigits: CURRENCY_INFO[currency]?.decimals ?? 2,
        maximumFractionDigits: CURRENCY_INFO[currency]?.decimals ?? 2,
      });
    } catch {
      fmt = new Intl.NumberFormat(undefined, {
        style: "decimal",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    currencyFormatterCache.set(currency, fmt);
  }
  return fmt;
}

/**
 * Format a numeric amount as a currency string using the user's locale.
 *
 *   formatCurrency(1234.56, "EUR") → "€1,234.56"
 *   formatCurrency(90150, "INR")   → "₹90,150.00"
 *   formatCurrency(-42.5, "USD")   → "-$42.50"
 *
 * Uses the Intl currency formatter which selects the correct symbol and digit
 * grouping for the locale. If the currency code is unknown to Intl, the code
 * is appended (e.g. "1,234.50 CZK") as a safe fallback — except for CZK which
 * Intl renders as "CZK 1,234.50"; we normalize that to "1,234.50 Kč" to match
 * the app's CURRENCY_INFO convention.
 */
export function formatCurrency(amount: number, currency: string): string {
  const fmt = getCurrencyFormatter(currency);
  let formatted = fmt.format(amount);

  // CZK: Intl typically produces "CZK 1,234.50"; rewrite to "1,234.50 Kč".
  if (currency === "CZK") {
    formatted = formatted.replace(/^CZK\s*/i, "").replace(/\s*CZK$/i, "");
    const sign = amount < 0 ? "-" : "";
    return `${sign}${formatted} Kč`.trim();
  }

  return formatted;
}

/* -------------------------------------------------------------------------- */
/*  Dates                                                                      */
/* -------------------------------------------------------------------------- */

/** Same-shaped date formatter cache as the currency one. */
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

function getDateFormatter(format: DateFormat): Intl.DateTimeFormat {
  let fmt = dateFormatterCache.get(format);
  if (!fmt) {
    const opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" };
    fmt = new Intl.DateTimeFormat(
      format === "MM/DD/YYYY" ? "en-US" : format === "YYYY-MM-DD" ? "sv-SE" : "en-GB",
      opts
    );
    dateFormatterCache.set(format, fmt);
  }
  return fmt;
}

/**
 * Format an ISO date string (or Date) into the requested display format.
 *
 *   formatDate("2026-06-28", "DD/MM/YYYY") → "28/06/2026"
 *   formatDate("2026-06-28", "MM/DD/YYYY") → "06/28/2026"
 *   formatDate("2026-06-28", "YYYY-MM-DD") → "2026-06-28"
 *
 * Defaults to DD/MM/YYYY (the app's default date format).
 */
export function formatDate(date: string | Date, format: DateFormat = "DD/MM/YYYY"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return getDateFormatter(format).format(d);
}

/**
 * Human-friendly relative date. Returns one of:
 *   "Today" · "Yesterday" · "Tomorrow" · "2 days ago" · "in 3 days" · "12/06/2026"
 *
 * Falls back to the absolute DD/MM/YYYY date when the value is more than 7 days
 * away from "now".
 */
export function formatRelativeDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";

  const now = new Date();
  // Normalize both to local midnight for day-diff math.
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffMs = startOfDay.getTime() - startOfToday.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 0 && diffDays > -7) return `${Math.abs(diffDays)} days ago`;
  if (diffDays > 0 && diffDays < 7) return `in ${diffDays} days`;

  return formatDate(d, "DD/MM/YYYY");
}

/* -------------------------------------------------------------------------- */
/*  Extra helpers used by sibling pages (accounts / transactions / categories) */
/*  These sit alongside the core formatting API to keep the build green.      */
/* -------------------------------------------------------------------------- */

/**
 * Today's date as a `YYYY-MM-DD` string in the local timezone. Handy as the
 * default value for date inputs in forms.
 */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Alias of {@link formatCurrency} for call sites that prefer the shorter name. */
export function formatMoney(amount: number, currency: string): string {
  return formatCurrency(amount, currency);
}

/**
 * Format a money amount with an explicit sign character prepended. `sign`
 * is +1, -1, or 0; the absolute value is formatted and a leading "+" or "−" is
 * added accordingly. Used by the transactions table to render signed amounts.
 */
export function formatSignedMoney(
  amount: number,
  currency: string,
  sign: number,
): string {
  const formatted = formatCurrency(Math.abs(amount), currency);
  if (sign > 0) return `+ ${formatted}`;
  if (sign < 0) return `− ${formatted}`;
  return formatted;
}

/** Display label + emoji icon for a given account type. */
export function accountTypeInfo(type: AccountType): { label: string; icon: string } {
  const found = ACCOUNT_TYPES.find((t) => t.value === type);
  return found ?? { label: "Other", icon: "📦" };
}

/**
 * Compute an account's current balance from its transactions, mirroring the
 * logic in the dashboard API route:
 *   initial_balance + income − expense − transfer_debit + transfer_credit
 * Transfers debit the source account (optionally including a fee) and credit
 * the destination account by `transfer_to_amount`.
 */
export function computeAccountBalance(account: Account, transactions: Transaction[]): number {
  let balance = account.initial_balance;
  for (const t of transactions) {
    if (t.account_id === account.id) {
      if (t.type === "income") {
        balance += t.amount;
      } else if (t.type === "expense") {
        balance -= t.amount;
      } else if (t.type === "transfer") {
        const debit = t.transfer_fee ? t.amount + t.transfer_fee : t.amount;
        balance -= debit;
      }
    }
    // Credit the destination account of a transfer.
    if (t.type === "transfer" && t.transfer_to_account_id === account.id) {
      balance += t.transfer_to_amount ?? 0;
    }
  }
  return balance;
}
