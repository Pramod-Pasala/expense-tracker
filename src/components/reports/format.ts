/**
 * reports/format.ts — small formatting helpers local to the reports feature.
 *
 * Kept here (rather than added to the shared @/lib/format, which is being
 * edited in parallel) to avoid merge races. Mirrors the Intl-based style of
 * the shared formatter.
 */

import { formatCurrency } from "@/lib/format";

/** Format a plain number with thousands separators + fixed decimals. */
export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Format a YYYY-MM month key for display (e.g. "Jun 2026"). */
export function formatMonth(month: string): string {
  if (!month) return "";
  const [year, mon] = month.split("-");
  const d = new Date(Number(year), Number(mon) - 1, 1);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

/** Re-export for convenience so charts import from one place. */
export { formatCurrency };
