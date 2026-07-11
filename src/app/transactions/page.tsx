"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  Account,
  Category,
  Transaction,
  TransactionType,
} from "@/lib/types";
import { CURRENCY_INFO } from "@/lib/types";
import { formatCurrency, formatDate, cn, todayISO, getErrorMessage, checkAuthExpired} from "@/lib/format";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";

/* -------------------------------------------------------------------------- */
/*  Types & constants                                                         */
/* -------------------------------------------------------------------------- */

interface AccountsResponse {
  accounts: Account[];
}
interface CategoriesResponse {
  categories: Category[];
}
interface TransactionsResponse {
  transactions: Transaction[];
}

/** Transaction type display metadata. amountClass drives the color coding. */
const TYPE_META: Record<
  TransactionType,
  { label: string; icon: string; amountClass: string; badgeClass: string }
> = {
  expense: {
    label: "Expense",
    icon: "↓",
    amountClass: "text-rose-600",
    badgeClass: "bg-rose-100 text-rose-700",
  },
  income: {
    label: "Income",
    icon: "↑",
    amountClass: "text-emerald-600",
    badgeClass: "bg-emerald-100 text-emerald-700",
  },
  transfer: {
    label: "Transfer",
    icon: "⇄",
    amountClass: "text-blue-600",
    badgeClass: "bg-blue-100 text-blue-700",
  },
};

const PAGE_SIZE = 25;
const CURRENCY_CODES = Object.keys(CURRENCY_INFO);

/** Sign and format an amount for the transactions list. Income is +, others -. */
function signedAmount(t: Transaction): number {
  if (t.type === "income") return Math.abs(t.amount);
  if (t.type === "transfer") return -(t.transfer_from_amount ?? t.amount);
  return -Math.abs(t.amount);
}

/* -------------------------------------------------------------------------- */
/*  Transaction form modal                                                    */
/* -------------------------------------------------------------------------- */

type FormType = "expense" | "income";

interface TxnFormValues {
  type: FormType;
  amount: string;
  currency: string;
  account_id: string;
  category_id: string;
  date: string;
  notes: string;
  tags: string; // comma-separated in the input
}

function emptyTxnForm(defaultAccount: string): TxnFormValues {
  return {
    type: "expense",
    amount: "",
    currency: "EUR",
    account_id: defaultAccount,
    category_id: "",
    date: todayISO(),
    notes: "",
    tags: "",
  };
}

/** Check if the editing target is a transfer transaction. */
function isTransferTxn(txn: Transaction | null): boolean {
  return !!txn && txn.type === "transfer";
}

/** Build the edit URL for a transfer transaction. */
function transferEditUrl(txn: Transaction | null): string {
  return txn ? `/transfer?edit=${txn.id}` : "/transfer";
}

function TransactionFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  submitting,
  accounts,
  categories,
  existingTags,
  isTransfer,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: TxnFormValues) => void;
  initial: TxnFormValues | null;
  submitting: boolean;
  accounts: Account[];
  categories: Category[];
  existingTags: string[];
  /** When true, the transaction being edited is a transfer — show a notice
   *  instead of the expense/income form (transfers are edited elsewhere). */
  isTransfer?: boolean;
  /** The transaction being edited (for building edit links). */
  editing: Transaction | null;
}) {
  const [values, setValues] = useState<TxnFormValues>(() =>
    emptyTxnForm(accounts[0]?.id ?? ""),
  );
  const [error, setError] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setValues(initial ?? emptyTxnForm(accounts[0]?.id ?? ""));
      setError(null);
    }
  }

  // Current tags (already entered) so we can avoid suggesting duplicates.
  const currentTags = useMemo(
    () =>
      values.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    [values.tags],
  );

  // Determine which fragment the user is currently typing (last comma-separated
  // segment) so we can filter suggestions by prefix match.
  const typingFragment = useMemo(() => {
    const parts = values.tags.split(",");
    return (parts[parts.length - 1] ?? "").trim().toLowerCase();
  }, [values.tags]);

  // Suggest tags that are not already in the input. If the user is typing in
  // the last segment, further filter to those matching that prefix.
  const suggestions = useMemo(() => {
    let pool = existingTags.filter(
      (t) => !currentTags.includes(t.toLowerCase()),
    );
    if (typingFragment) {
      pool = pool.filter((t) => t.toLowerCase().startsWith(typingFragment));
    }
    return pool.slice(0, 12);
  }, [existingTags, currentTags, typingFragment]);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    if (currentTags.includes(trimmed.toLowerCase())) return; // avoid duplicates
    setValues((v) => {
      // Replace the last comma-separated fragment (the one the user is typing)
      // with the selected tag. If there are no existing tags, just set the tag.
      const parts = v.tags.split(",");
      const lastIdx = parts.length - 1;
      parts[lastIdx] = trimmed;
      // Clean up: drop empty leading parts, trim everything, rejoin
      const cleaned = parts
        .map((p) => p.trim())
        .filter((p, i) => p !== "" || i === 0);
      return { ...v, tags: cleaned.join(", ") };
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.amount.trim() || parseFloat(values.amount) <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!values.account_id) {
      setError("Please select an account.");
      return;
    }
    onSubmit(values);
  };

  // Categories filtered to those compatible with the chosen type.
  const availableCategories = useMemo(
    () =>
      categories.filter((c) => c.type === values.type || c.type === "both"),
    [categories, values.type],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit transaction" : "Add transaction"}
    >
      {isTransfer ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <p className="font-medium">
              This is a transfer transaction.
            </p>
            <p className="mt-1">
              Transfer transactions are edited on the Transfer page. Click below to edit this transfer.
            </p>
          </div>
          <Link
            href={transferEditUrl(editing)}
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Edit this transfer →
          </Link>
        </div>
      ) : (
      <form onSubmit={submit} className="space-y-4">
        {/* Type toggle */}
        <div className="flex gap-2">
          {(["expense", "income"] as FormType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setValues((v) => ({ ...v, type: t }))}
              className={cn(
                "flex-1 rounded-xl border px-4 py-3 text-sm font-medium capitalize transition-colors",
                values.type === t
                  ? t === "expense"
                    ? "border-rose-500 bg-rose-50 text-rose-700"
                    : "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50",
              )}
            >
              {t === "expense" ? "↓ Expense" : "↑ Income"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={values.amount}
            onChange={(e) =>
              setValues((v) => ({ ...v, amount: e.target.value }))
            }
            error={!!error && (!values.amount.trim() || parseFloat(values.amount) <= 0)}
            autoFocus
          />
          <Select
            label="Currency"
            value={values.currency}
            onChange={(e) =>
              setValues((v) => ({ ...v, currency: e.target.value }))
            }
          >
            {CURRENCY_CODES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_INFO[c].symbol} {c}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Account"
            value={values.account_id}
            onChange={(e) =>
              setValues((v) => ({ ...v, account_id: e.target.value }))
            }
            error={!!error && !values.account_id}
          >
            <option value="">Select account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Select
            label="Category"
            value={values.category_id}
            onChange={(e) =>
              setValues((v) => ({ ...v, category_id: e.target.value }))
            }
          >
            <option value="">None</option>
            {availableCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <Input
          label="Date"
          type="date"
          value={values.date}
          onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="txn-notes" className="text-sm font-medium text-gray-700">
            Notes
          </label>
          <textarea
            id="txn-notes"
            rows={2}
            value={values.notes}
            onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
            placeholder="Optional notes…"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        <Input
          label="Tags"
          placeholder="comma, separated, tags"
          value={values.tags}
          onChange={(e) => setValues((v) => ({ ...v, tags: e.target.value }))}
        />

        {suggestions.length > 0 && (
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {suggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : initial ? "Save changes" : "Add transaction"}
          </Button>
        </div>
      </form>
      )}
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  Icons                                                                     */
/* -------------------------------------------------------------------------- */

function PlusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function TransactionsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterAccount, setFilterAccount] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterStart, setFilterStart] = useState<string>("");
  const [filterEnd, setFilterEnd] = useState<string>("");

  // Pagination ("load more")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  const load = useCallback(async () => {
    // loading/error reset is handled by callers so this function does not
    // synchronously call setState (which would be flagged when called from an
    // effect — react-hooks/set-state-in-effect).
    try {
      const [accRes, catRes, txnRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/categories"),
        fetch("/api/transactions"),
      ]);
      if (!accRes.ok) throw new Error("Failed to load accounts");
      if (!catRes.ok) throw new Error("Failed to load categories");
      if (!txnRes.ok) throw new Error("Failed to load transactions");

      const accData: AccountsResponse = await accRes.json();
      const catData: CategoriesResponse = await catRes.json();
      const txnData: TransactionsResponse = await txnRes.json();
      setAccounts(accData.accounts ?? []);
      setCategories(catData.categories ?? []);
      setTransactions(txnData.transactions ?? []);
    } catch (e: unknown) {
      setError(getErrorMessage(e) || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load on mount. The setState calls all run inside async callbacks
  // (after `await`), so the effect body itself does not call setState.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [accRes, catRes, txnRes] = await Promise.all([
          fetch("/api/accounts"),
          fetch("/api/categories"),
          fetch("/api/transactions"),
        ]);
        if (cancelled) return;
        if (!accRes.ok) throw new Error("Failed to load accounts");
        if (!catRes.ok) throw new Error("Failed to load categories");
        if (!txnRes.ok) throw new Error("Failed to load transactions");

        const accData: AccountsResponse = await accRes.json();
        const catData: CategoriesResponse = await catRes.json();
        const txnData: TransactionsResponse = await txnRes.json();
        if (cancelled) return;
        setAccounts(accData.accounts ?? []);
        setCategories(catData.categories ?? []);
        setTransactions(txnData.transactions ?? []);
      } catch (e: unknown) {
        if (!cancelled) setError(getErrorMessage(e) || "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lookup maps
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  // Apply filters (transactions already come sorted newest-first from the API)
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filterAccount) {
        if (
          t.account_id !== filterAccount &&
          t.transfer_to_account_id !== filterAccount
        ) {
          return false;
        }
      }
      if (filterType && t.type !== filterType) return false;
      if (filterStart && t.date < filterStart) return false;
      if (filterEnd && t.date > filterEnd) return false;
      return true;
    });
  }, [transactions, filterAccount, filterType, filterStart, filterEnd]);

  const filterSig = `${filterAccount}|${filterType}|${filterStart}|${filterEnd}`;
  const [prevFilterSig, setPrevFilterSig] = useState(filterSig);
  if (filterSig !== prevFilterSig) {
    setPrevFilterSig(filterSig);
    setVisibleCount(PAGE_SIZE);
  }

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const activeAccounts = accounts.filter((a) => !a.archived);

  // All distinct tags across loaded transactions, for autocomplete suggestions.
  const existingTags = useMemo(() => {
    const set = new Set<string>();
    for (const t of transactions) {
      for (const tag of t.tags ?? []) {
        const trimmed = tag.trim();
        if (trimmed) set.add(trimmed);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (txn: Transaction) => {
    setEditing(txn);
    setModalOpen(true);
  };

  const handleSubmit = async (values: TxnFormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        type: values.type,
        amount: values.amount,
        currency: values.currency,
        account_id: values.account_id,
        category_id: values.category_id || null,
        date: values.date,
        notes: values.notes,
        tags: values.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      if (editing) {
        const res = await fetch(`/api/transactions/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (checkAuthExpired(res)) return; if (checkAuthExpired(res)) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to update transaction");
        }
        const updated: Transaction = await res.json();
        setTransactions((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t)),
        );
      } else {
        const res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (checkAuthExpired(res)) return; if (checkAuthExpired(res)) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to create transaction");
        }
        const created: Transaction = await res.json();
        // Insert then re-sort to keep newest-first order.
        setTransactions((prev) => {
          const next = [...prev, created];
          next.sort((a, b) => b.date.localeCompare(a.date));
          return next;
        });
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/transactions/${target.id}`, {
        method: "DELETE",
      });
      if (checkAuthExpired(res)) return; if (checkAuthExpired(res)) return;
        if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete transaction");
      }
      setTransactions((prev) => prev.filter((t) => t.id !== target.id));
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  };

  const hasFilters = Boolean(
    filterAccount || filterType || filterStart || filterEnd,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Transactions</h1>
          <p className="mt-1 text-sm text-gray-500">
            All your income, expenses, and transfers in one place.
          </p>
        </div>
        <Button onClick={openAdd} disabled={activeAccounts.length === 0}>
          <PlusIcon />
          Add Transaction
        </Button>
      </div>

      {error && (
        <Card>
          <EmptyState
            icon="⚠️"
            title="Something went wrong"
            description={error}
            action={
              <Button
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  load();
                }}
              >
                Try again
              </Button>
            }
          />
        </Card>
      )}

      {/* Filter bar */}
      <Card bodyClassName="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Account"
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Select
            label="Type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </Select>
          <Input
            label="From date"
            type="date"
            value={filterStart}
            onChange={(e) => setFilterStart(e.target.value)}
          />
          <Input
            label="To date"
            type="date"
            value={filterEnd}
            onChange={(e) => setFilterEnd(e.target.value)}
          />
        </div>
        {hasFilters && (
          <div>
            <button
              type="button"
              onClick={() => {
                setFilterAccount("");
                setFilterType("");
                setFilterStart("");
                setFilterEnd("");
              }}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              Clear filters
            </button>
          </div>
        )}
      </Card>

      {!error && filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon="🧾"
            title={hasFilters ? "No matching transactions" : "No transactions yet"}
            description={
              hasFilters
                ? "Try adjusting your filters to see more results."
                : activeAccounts.length === 0
                  ? "Add an account first, then record your first transaction."
                  : "Record your first transaction to start tracking your spending."
            }
            action={
              !hasFilters && activeAccounts.length > 0 ? (
                <Button onClick={openAdd}>
                  <PlusIcon />
                  Add Transaction
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        !error && (
          <>
            <p className="text-sm text-gray-500">
              Showing {visible.length} of {filtered.length}
            </p>

            {/* Desktop table */}
            <Card bodyClassName="p-0 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Account</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Notes</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((t) => {
                    const meta = TYPE_META[t.type];
                    const acct = accountMap.get(t.account_id);
                    const destAcct = t.transfer_to_account_id
                      ? accountMap.get(t.transfer_to_account_id)
                      : null;
                    const cat = t.category_id
                      ? categoryMap.get(t.category_id)
                      : null;
                    return (
                      <tr
                        key={t.id}
                        onClick={() => openEdit(t)}
                        className="group cursor-pointer border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                          {formatDate(t.date)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                              meta.badgeClass,
                            )}
                          >
                            {meta.icon} {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {t.type === "transfer" && destAcct
                            ? `${acct?.name ?? "—"} → ${destAcct.name}`
                            : (acct?.name ?? "—")}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {cat ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: cat.color }}
                              />
                              {cat.name}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="max-w-[200px] px-4 py-3 text-sm text-gray-500">
                          <div className="flex flex-col gap-0.5">
                            <span className="truncate">
                              {t.notes || (
                                <span className="text-gray-300">—</span>
                              )}
                            </span>
                            {t.tags.length > 0 && (
                              <span className="text-xs text-gray-400">
                                {t.tags.map((tag) => `#${tag}`).join(" ")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums",
                            meta.amountClass,
                          )}
                        >
                          {formatCurrency(signedAmount(t), t.currency)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(t);
                            }}
                            className="rounded-lg p-1.5 text-gray-400 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                            aria-label="Delete transaction"
                            title="Delete"
                          >
                            <TrashIcon />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

            {/* Mobile cards */}
            <div className="space-y-3 lg:hidden">
              {visible.map((t) => {
                const meta = TYPE_META[t.type];
                const acct = accountMap.get(t.account_id);
                const destAcct = t.transfer_to_account_id
                  ? accountMap.get(t.transfer_to_account_id)
                  : null;
                const cat = t.category_id
                  ? categoryMap.get(t.category_id)
                  : null;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openEdit(t)}
                    className="block w-full rounded-2xl border border-gray-200 bg-white p-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                              meta.badgeClass,
                            )}
                          >
                            {meta.icon}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(t.date)}
                          </span>
                        </div>
                        <p className="mt-1.5 truncate text-sm font-medium text-gray-900">
                          {t.type === "transfer" && destAcct
                            ? `${acct?.name ?? "—"} → ${destAcct.name}`
                            : cat?.name ?? acct?.name ?? "Transaction"}
                        </p>
                        {t.notes && (
                          <p className="mt-0.5 truncate text-xs text-gray-500">
                            {t.notes}
                          </p>
                        )}
                        {t.tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {t.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            "whitespace-nowrap text-sm font-semibold tabular-nums",
                            meta.amountClass,
                          )}
                        >
                          {formatCurrency(signedAmount(t), t.currency)}
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(t);
                          }}
                          className="mt-1 rounded-lg p-1 text-gray-400 hover:text-rose-600"
                          aria-label="Delete transaction"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {hasMore && (
              <div className="flex justify-center">
                <Button
                  variant="secondary"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                >
                  Load more ({filtered.length - visibleCount} remaining)
                </Button>
              </div>
            )}
          </>
        )
      )}

      <TransactionFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        submitting={submitting}
        accounts={activeAccounts}
        categories={categories.filter((c) => !c.archived)}
        existingTags={existingTags}
        isTransfer={isTransferTxn(editing)}
        editing={editing}
        initial={
          editing
            ? {
                type: editing.type === "income" ? "income" : "expense",
                amount: String(editing.amount),
                currency: editing.currency,
                account_id: editing.account_id,
                category_id: editing.category_id ?? "",
                date: editing.date,
                notes: editing.notes,
                tags: editing.tags.join(", "),
              }
            : null
        }
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete transaction"
        message="Delete this transaction? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
