/**
 * migrations.ts — Forward-only, version-based migration system for the expense
 * tracker's JSON data files.
 *
 * Design:
 *  - Every file carries a top-level `schema_version` (number). All entity files
 *    share one version counter — a migration advances the version for every
 *    file at once, which keeps the bookkeeping trivial.
 *  - `migrate(data, targetVersion)` walks the registry from
 *    `data.schema_version` up to (but not including) `targetVersion`, applying
 *    each registered migration function in order and bumping the version by 1
 *    after each step.
 *  - If no migration is registered for the version we're currently on, the
 *    runner stops safely and returns the data as-is (already advanced as far as
 *    it could). It never throws for a missing migration — that's a valid "we're
 *    on a newer schema than this build knows about, or no change was needed"
 *    state.
 *  - Migrations are pure transforms: `(data: any) => any`. They must not touch
 *    the disk or perform I/O.
 *
 * Usage:
 *   import { migrate } from "@/lib/migrations";
 *   const data = loadAccountsFile();      // unknown shape
 *   const migrated = migrate(data, CURRENT_SCHEMA_VERSION);
 *   const valid = validateAccountsFile(migrated);
 */
import type { AnyDataFile } from "./types";
import { CURRENT_SCHEMA_VERSION } from "./types";

/* -------------------------------------------------------------------------- */
/*  Registry                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A migration takes data that is *currently at* `schema_version === N` and
 * returns data at `schema_version === N + 1`. The runner bumps the recorded
 * version itself, so a migration must NOT set `schema_version` — it should only
 * transform the payload fields.
 *
 * Migrations are keyed by the version they upgrade *from*. So
 * `migrations[1]` upgrades v1 → v2, `migrations[2]` upgrades v2 → v3, etc.
 */
// Migrations handle heterogeneous file payloads, so `any` is intentional here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MigrationFn = (data: any) => any;

export const migrations: Record<number, MigrationFn> = {
  /**
   * Example placeholder. v1 → v2: (none yet — v1 is the initial schema.)
   *
   * When the first real schema change lands, replace this with a real migration
   * and document the change. A typical migration looks like:
   *
   *   1: (data) => {
   *     // data is at schema_version 1
   *     if (Array.isArray(data?.accounts)) {
   *       for (const a of data.accounts) {
   *         // e.g. rename/normalize a field, add a default, etc.
   *         if (a.initial_balance == null) a.initial_balance = 0;
   *       }
   *     }
   *     return data; // runner will bump schema_version to 2
   *   },
   */
  // (No migrations registered yet — v1 is current.)
};

/* -------------------------------------------------------------------------- */
/*  Runner                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Apply forward migrations to `data` until it reaches `targetVersion` (or as
 * close as possible). Safe to call on data that is already at or above the
 * target.
 *
 * @param data          A parsed file payload. Must be an object with a numeric
 *                      `schema_version` (missing → treated as 1).
 * @param targetVersion Desired final schema_version. Defaults to
 *                      `CURRENT_SCHEMA_VERSION`.
 * @returns             The migrated data. `schema_version` reflects how far the
 *                      runner actually got.
 */
export function migrate<T extends { schema_version?: number } | object>(
  data: T,
  targetVersion: number = CURRENT_SCHEMA_VERSION,
): T {
  if (data == null || typeof data !== "object") {
    return data;
  }

  // Work on a shallow clone so we never mutate the caller's object.
  const current: { schema_version: number; [k: string]: unknown } = {
    ...(data as Record<string, unknown>),
  } as { schema_version: number; [k: string]: unknown };

  // Coerce / default the version. Missing or non-numeric → assume v1.
  const rawVersion = (current as { schema_version?: unknown }).schema_version;
  const version =
    typeof rawVersion === "number" && Number.isFinite(rawVersion)
      ? Math.trunc(rawVersion)
      : 1;
  current.schema_version = version;

  // Walk forward one version at a time.
  while (current.schema_version < targetVersion) {
    const step = migrations[current.schema_version];
    if (typeof step !== "function") {
      // No migration registered for this version — stop safely without crashing.
      break;
    }

    let next: unknown;
    try {
      next = step(current);
    } catch (err) {
      // A migration should be robust, but never let a broken migration take the
      // whole loader down. Stop here and surface what we have.
      console.error(
        `[migrations] migration v${current.schema_version} → v${
          current.schema_version + 1
        } failed; stopping. Error:`,
        err,
      );
      break;
    }

    if (next == null || typeof next !== "object") {
      // Migration returned something unusable — bail out rather than corrupt.
      console.error(
        `[migrations] migration v${current.schema_version} returned non-object; stopping.`,
      );
      break;
    }

    // The migration produced the next version's payload. Bump the recorded
    // version (migrations are not expected to set it themselves).
    current.schema_version = current.schema_version + 1;
    // Merge: preserve any keys the migration set, but guarantee schema_version.
    Object.assign(current, next, { schema_version: current.schema_version });
  }

  return current as T;
}

/* -------------------------------------------------------------------------- */
/*  Convenience                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Migrate to the current schema version. Thin alias for `migrate(data)`.
 */
export function migrateToCurrent<
  T extends { schema_version?: number } | object,
>(data: T): T {
  return migrate(data, CURRENT_SCHEMA_VERSION);
}

/**
 * The highest migration *from* version registered, i.e. the version above which
 * the runner has no work to do. Useful for diagnostics.
 */
export function highestRegisteredMigration(): number {
  const keys = Object.keys(migrations)
    .map((k) => Number(k))
    .filter((n) => Number.isInteger(n) && n >= 1);
  return keys.length === 0 ? 0 : Math.max(...keys);
}

/**
 * Type-guard-ish helper: is `data` at least at `targetVersion`?
 */
export function isAtVersion(
  data: { schema_version?: number } | object | null | undefined,
  targetVersion: number,
): boolean {
  if (data == null || typeof data !== "object") return false;
  const v = (data as { schema_version?: unknown }).schema_version;
  return typeof v === "number" && v >= targetVersion;
}

export type { AnyDataFile };
