"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Amount from "@/components/ui/Amount";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import { formatCurrency, formatRelativeDate, cn } from "@/lib/format";
import type { AccountType, TransactionType } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/*  API response types (mirror GET /api/dashboard)                            */
/* -------------------------------------------------------------------------- */

interface DashboardAccount {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  color: string;
  balance: number;
}

interface DashboardTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  date: string;
  notes: string;
  account_name: string;
  category_name: string | null;
  category_color: string | null;
}

interface DashboardData {
  net_worth: number;
  base_currency: string;
  accounts: DashboardAccount[];
  month_income: number;
  month_expense: number;
  recent_transactions: DashboardTransaction[];
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: DashboardData }
  | { status: "empty"; data: DashboardData };

export default function DashboardPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (res.status === 401) {
          // AuthGate should normally catch this, but guard anyway.
          if (!cancelled) setState({ status: "error", message: "Your session has expired. Please reload." });
          return;
        }
        if (!res.ok) {
          if (!cancelled)
            setState({ status: "error", message: `Failed to load dashboard (HTTP ${res.status}).` });
          return;
        }
        const data: DashboardData = await res.json();
        if (cancelled) return;
        setState(data.accounts.length === 0 ? { status: "empty", data } : { status: "ok", data });
      } catch {
        if (!cancelled)
          setState({ status: "error", message: "Network error while loading your dashboard." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <Card>
        <EmptyState
          icon="⚠️"
          title="Couldn't load your dashboard"
          description={state.message}
          action={
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Retry
            </button>
          }
        />
      </Card>
    );
  }

  // Empty state — no accounts yet.
  if (state.status === "empty") {
    return (
      <div className="py-6">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <Card className="mt-4">
          <EmptyState
            icon="🏦"
            title="Welcome to Ledger"
            description="You don't have any accounts yet. Create your first account to start tracking your finances."
            action={
              <Link
                href="/accounts"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                Create your first account
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const { data } = state;
  const monthNet = data.month_income - data.month_expense;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>

      {/* ---------- Top row: net worth + monthly income/expense ---------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Net worth — spans full width on mobile, 1 col on desktop */}
        <Card className="sm:col-span-2 lg:col-span-1" bodyClassName="flex flex-col gap-1">
          <p className="text-sm font-medium text-gray-500">Net worth</p>
          <p className="text-3xl font-semibold tracking-tight text-gray-900">
            {formatCurrency(data.net_worth, data.base_currency)}
          </p>
          <p className="text-xs text-gray-400">in {data.base_currency}</p>
        </Card>

        {/* Monthly income */}
        <Card bodyClassName="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <ArrowDownIcon />
            </span>
            <p className="text-sm font-medium text-gray-500">Income (this month)</p>
          </div>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-emerald-600">
            {formatCurrency(data.month_income, data.base_currency)}
          </p>
        </Card>

        {/* Monthly expense */}
        <Card bodyClassName="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <ArrowUpIcon />
            </span>
            <p className="text-sm font-medium text-gray-500">Expenses (this month)</p>
          </div>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-rose-600">
            {formatCurrency(data.month_expense, data.base_currency)}
          </p>
          <p className={cn("text-xs", monthNet >= 0 ? "text-emerald-600" : "text-rose-600")}>
            Net {monthNet >= 0 ? "+" : ""}
            {formatCurrency(monthNet, data.base_currency)}
          </p>
        </Card>
      </div>

      {/* ---------- Account balances grid ---------- */}
      <Card
        title="Accounts"
        action={
          <Link
            href="/accounts"
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
          >
            View all
          </Link>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.accounts.map((acc) => (
            <Link
              key={acc.id}
              href={`/transactions?account_id=${acc.id}`}
              className="flex items-center justify-between rounded-xl border border-gray-200 p-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: acc.color }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{acc.name}</p>
                  <p className="text-xs text-gray-400">
                    {acc.type} · {acc.currency}
                  </p>
                </div>
              </div>
              <Amount
                amount={acc.balance}
                currency={acc.currency}
                colored={false}
                className="text-sm"
              />
            </Link>
          ))}
        </div>
      </Card>

      {/* ---------- Recent transactions ---------- */}
      <Card
        title="Recent transactions"
        action={
          <Link
            href="/transactions"
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
          >
            View all
          </Link>
        }
        bodyClassName="p-0"
      >
        {data.recent_transactions.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="No transactions yet"
            description="Add your first transaction to see it here."
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.recent_transactions.map((txn) => (
              <TransactionRow key={txn.id} txn={txn} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Transaction row                                                           */
/* -------------------------------------------------------------------------- */

function TransactionRow({ txn }: { txn: DashboardTransaction }) {
  const signedAmount =
    txn.type === "expense" ? -Math.abs(txn.amount) : txn.type === "income" ? Math.abs(txn.amount) : txn.amount;

  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          txn.type === "income" && "bg-emerald-100 text-emerald-600",
          txn.type === "expense" && "bg-rose-100 text-rose-600",
          txn.type === "transfer" && "bg-blue-100 text-blue-600"
        )}
      >
        <TransactionTypeIcon type={txn.type} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-gray-900">
            {txn.notes || txn.category_name || txn.account_name}
          </p>
          {txn.category_name && (
            <Badge color={txn.category_color}>{txn.category_name}</Badge>
          )}
        </div>
        <p className="truncate text-xs text-gray-400">
          {txn.account_name} · {formatRelativeDate(txn.date)}
        </p>
      </div>

      <Amount
        amount={signedAmount}
        currency={txn.currency}
        className="shrink-0 text-sm"
      />
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Icons                                                                     */
/* -------------------------------------------------------------------------- */

function ArrowDownIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M19 12l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TransactionTypeIcon({ type }: { type: TransactionType }) {
  if (type === "income")
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14M19 12l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (type === "transfer")
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 7h13l-3-3M17 17H4l3 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  // expense
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
