"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn, formatCurrency, getErrorMessage, checkAuthExpired} from "@/lib/format";
import {
  EmptyState,
  Label,
  LoadingState,
  PageHeader,
  TextInput,
  DateInput,
} from "@/components/ui";
import {
  CashflowChart,
  ExpenseByCategoryChart,
  SpendingByAccountChart,
  type AccountDatum,
  type CashflowDatum,
  type CategoryDatum,
} from "@/components/reports/charts";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface ReportData {
  date_range: { start: string; end: string };
  base_currency: string;
  expense_by_category: CategoryDatum[];
  cashflow: CashflowDatum[];
  spending_by_account: AccountDatum[];
  summary: {
    total_income: number;
    total_expense: number;
    net: number;
  };
  tags: { tag: string; income: number; expense: number; count: number }[];
}

type Preset = "this_month" | "last_3_months" | "this_year" | "custom";

/* -------------------------------------------------------------------------- */
/*  Date helpers                                                               */
/* -------------------------------------------------------------------------- */

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function presetRange(preset: Preset): { start: string; end: string } {
  const now = new Date();
  const end = toISODate(now);

  switch (preset) {
    case "this_month":
      return {
        start: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
        end,
      };
    case "last_3_months": {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { start: toISODate(start), end };
    }
    case "this_year":
      return {
        start: toISODate(new Date(now.getFullYear(), 0, 1)),
        end,
      };
    case "custom":
    default:
      return {
        start: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
        end,
      };
  }
}

const PRESET_LABELS: Record<Preset, string> = {
  this_month: "This Month",
  last_3_months: "Last 3 Months",
  this_year: "This Year",
  custom: "Custom",
};

/* -------------------------------------------------------------------------- */
/*  Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function ReportsPage() {
  const [preset, setPreset] = useState<Preset>("this_month");
  const [startDate, setStartDate] = useState(presetRange("this_month").start);
  const [endDate, setEndDate] = useState(presetRange("this_month").end);

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ------------------------------------------------------------------------ */
  /*  When a preset is chosen, sync the date inputs                             */
  /* ------------------------------------------------------------------------ */
  const applyPreset = useCallback((p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const r = presetRange(p);
      setStartDate(r.start);
      setEndDate(r.end);
    }
  }, []);

  /* ------------------------------------------------------------------------ */
  /*  Fetch report data whenever the effective range changes                    */
  /* ------------------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          start_date: startDate,
          end_date: endDate,
        });
        const res = await fetch(`/api/reports?${params.toString()}`);
        if (checkAuthExpired(res)) return; if (checkAuthExpired(res)) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed to load report (${res.status})`);
        }
        const json: ReportData = await res.json();
        if (!cancelled) setData(json);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(err) || "Failed to load report");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  /* ------------------------------------------------------------------------ */
  /*  Derived                                                                   */
  /* ------------------------------------------------------------------------ */
  const baseCurrency = data?.base_currency || "EUR";
  const hasData = useMemo(() => {
    if (!data) return false;
    return (
      data.summary.total_income + data.summary.total_expense > 0 ||
      data.expense_by_category.length > 0 ||
      data.cashflow.length > 0
    );
  }, [data]);

  const savingsRate = useMemo(() => {
    if (!data || data.summary.total_income <= 0) return null;
    return (data.summary.net / data.summary.total_income) * 100;
  }, [data]);

  /* ------------------------------------------------------------------------ */
  /*  Render                                                                    */
  /* ------------------------------------------------------------------------ */
  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        description="Track your income, expenses, and savings over time."
      />

      {/* Date range controls */}
      <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                preset === p
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
              )}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="mt-4 grid gap-3 sm:max-w-md sm:grid-cols-2">
            <div>
              <Label htmlFor="start_date">From</Label>
              <DateInput
                id="start_date"
                value={startDate}
                onChange={setStartDate}
                max={endDate}
              />
            </div>
            <div>
              <Label htmlFor="end_date">To</Label>
              <DateInput
                id="end_date"
                value={endDate}
                onChange={setEndDate}
                min={startDate}
              />
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {startDate} → {endDate}
          {data && (
            <span className="ml-2">
              · All amounts in{" "}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {baseCurrency}
              </span>
            </span>
          )}
        </p>
      </div>

      {/* Body */}
      {loading ? (
        <LoadingState label="Loading report…" />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : !hasData ? (
        <EmptyState
          icon="📊"
          title="No transactions in this range"
          description="Try selecting a different date range, or add some transactions to see your reports come to life."
        />
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard
              label="Total Income"
              value={formatCurrency(data!.summary.total_income, baseCurrency)}
              accent="green"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 19.5v-15m0 0l-6.75 6.75M12 4.5l6.75 6.75"
                />
              }
            />
            <SummaryCard
              label="Total Expense"
              value={formatCurrency(data!.summary.total_expense, baseCurrency)}
              accent="red"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m0 0l6.75-6.75M12 19.5l-6.75-6.75"
                />
              }
            />
            <SummaryCard
              label="Net Savings"
              value={formatCurrency(data!.summary.net, baseCurrency)}
              accent={data!.summary.net >= 0 ? "blue" : "red"}
              sublabel={
                savingsRate !== null
                  ? `${savingsRate >= 0 ? "" : "-"}${Math.abs(savingsRate).toFixed(1)}% of income`
                  : undefined
              }
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z"
                />
              }
            />
          </div>

          {/* Charts row 1: Pie + Cashflow */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Expense by Category">
              {data!.expense_by_category.length > 0 ? (
                <>
                  <ExpenseByCategoryChart
                    data={data!.expense_by_category}
                    baseCurrency={baseCurrency}
                  />
                  <CategoryBreakdown
                    data={data!.expense_by_category}
                    baseCurrency={baseCurrency}
                  />
                </>
              ) : (
                <NoData label="No expenses in this range" />
              )}
            </ChartCard>

            <ChartCard title="Cashflow Over Time">
              {data!.cashflow.length > 0 ? (
                <CashflowChart
                  data={data!.cashflow}
                  baseCurrency={baseCurrency}
                />
              ) : (
                <NoData label="No cashflow data in this range" />
              )}
            </ChartCard>
          </div>

          {/* Charts row 2: Spending by account */}
          <ChartCard title="Spending by Account">
            {data!.spending_by_account.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2 lg:items-center">
                <SpendingByAccountChart
                  data={data!.spending_by_account}
                  baseCurrency={baseCurrency}
                />
                <AccountBreakdown
                  data={data!.spending_by_account}
                  baseCurrency={baseCurrency}
                />
              </div>
            ) : (
              <NoData label="No spending in this range" />
            )}
          </ChartCard>

          {/* Tag analysis */}
          <ChartCard title="Tag Analysis">
            {data!.tags.length > 0 ? (
              <TagAnalysis
                data={data!.tags}
                baseCurrency={baseCurrency}
              />
            ) : (
              <NoData label="No tagged transactions in this range" />
            )}
          </ChartCard>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sublabel,
  accent,
  icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  accent: "green" | "red" | "blue";
  icon: React.ReactNode;
}) {
  const accentClasses = {
    green: "bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400",
    red: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  } as const;

  const valueColor = {
    green: "text-green-600 dark:text-green-400",
    red: "text-red-600 dark:text-red-400",
    blue: "text-blue-600 dark:text-blue-400",
  } as const;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            accentClasses[accent],
          )}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
          >
            {icon}
          </svg>
        </div>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">{label}</span>
      </div>
      <p
        className={cn(
          "mt-3 text-2xl font-bold tracking-tight",
          valueColor[accent],
        )}
      >
        {value}
      </p>
      {sublabel && <p className="mt-1 text-xs text-zinc-400">{sublabel}</p>}
    </div>
  );
}

function CategoryBreakdown({
  data,
  baseCurrency,
}: {
  data: CategoryDatum[];
  baseCurrency: string;
}) {
  const total = data.reduce((s, d) => s + d.total, 0);
  return (
    <ul className="mt-4 space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
      {data.slice(0, 6).map((d) => {
        const pct = total > 0 ? (d.total / total) * 100 : 0;
        return (
          <li key={d.category_id} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">
              {d.name}
            </span>
            <span className="text-zinc-400">{pct.toFixed(0)}%</span>
            <span className="w-24 text-right font-medium text-zinc-900 dark:text-zinc-100">
              {formatCurrency(d.total, baseCurrency)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function AccountBreakdown({
  data,
  baseCurrency,
}: {
  data: AccountDatum[];
  baseCurrency: string;
}) {
  const total = data.reduce((s, d) => s + d.total, 0);
  return (
    <ul className="space-y-2">
      {data.map((d) => {
        const pct = total > 0 ? (d.total / total) * 100 : 0;
        return (
          <li key={d.account_id} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">
              {d.name}
            </span>
            <span className="text-zinc-400">{pct.toFixed(0)}%</span>
            <span className="w-24 text-right font-medium text-zinc-900 dark:text-zinc-100">
              {formatCurrency(d.total, baseCurrency)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function NoData({ label }: { label: string }) {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-zinc-400">
      {label}
    </div>
  );
}

function TagAnalysis({
  data,
  baseCurrency,
}: {
  data: { tag: string; income: number; expense: number; count: number }[];
  baseCurrency: string;
}) {
  // Mobile: cards; desktop: table. Data already sorted by expense desc from API.
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-2 py-2 font-medium">Tag</th>
              <th className="px-2 py-2 text-right font-medium">Income</th>
              <th className="px-2 py-2 text-right font-medium">Expense</th>
              <th className="px-2 py-2 text-right font-medium">Transactions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr
                key={d.tag}
                className="border-b border-zinc-50 last:border-0 dark:border-zinc-800/50"
              >
                <td className="whitespace-nowrap px-2 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  #{d.tag}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right text-sm text-emerald-600 dark:text-emerald-400">
                  {d.income > 0 ? formatCurrency(d.income, baseCurrency) : "—"}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right text-sm text-rose-600 dark:text-rose-400">
                  {d.expense > 0 ? formatCurrency(d.expense, baseCurrency) : "—"}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right text-sm text-zinc-500 dark:text-zinc-400">
                  {d.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-2 sm:hidden">
        {data.map((d) => (
          <li
            key={d.tag}
            className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                #{d.tag}
              </p>
              <p className="text-xs text-zinc-400">{d.count} transactions</p>
            </div>
            <div className="text-right text-sm">
              {d.income > 0 && (
                <p className="text-emerald-600 dark:text-emerald-400">
                  +{formatCurrency(d.income, baseCurrency)}
                </p>
              )}
              {d.expense > 0 && (
                <p className="text-rose-600 dark:text-rose-400">
                  −{formatCurrency(d.expense, baseCurrency)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
