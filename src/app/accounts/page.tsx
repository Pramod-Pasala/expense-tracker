"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Account, AccountType, Transaction } from "@/lib/types";
import { ACCOUNT_TYPES, CURRENCY_INFO } from "@/lib/types";
import { formatCurrency, cn, accountTypeInfo, computeAccountBalance, getErrorMessage, checkAuthExpired} from "@/lib/format";
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

interface TransactionsResponse {
  transactions: Transaction[];
}

const PRESET_COLORS = [
  "#10B981",
  "#3B82F6",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#EF4444",
  "#14B8A6",
  "#6B7280",
];

const CURRENCY_CODES = Object.keys(CURRENCY_INFO);

/* -------------------------------------------------------------------------- */
/*  Account form modal                                                        */
/* -------------------------------------------------------------------------- */

interface AccountFormValues {
  name: string;
  type: AccountType;
  currency: string;
  initial_balance: string;
  color: string;
}

const emptyForm: AccountFormValues = {
  name: "",
  type: "bank",
  currency: "EUR",
  initial_balance: "",
  color: "#10B981",
};

function AccountFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: AccountFormValues) => void;
  initial: AccountFormValues | null;
  submitting: boolean;
}) {
  const [values, setValues] = useState<AccountFormValues>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setValues(initial ?? emptyForm);
      setError(null);
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.name.trim()) {
      setError("Account name is required.");
      return;
    }
    onSubmit(values);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit account" : "Add account"}
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Name"
          placeholder="e.g. Main Checking"
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          error={!!error && !values.name.trim()}
          autoFocus
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Type"
            value={values.type}
            onChange={(e) =>
              setValues((v) => ({ ...v, type: e.target.value as AccountType }))
            }
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.icon} {t.label}
              </option>
            ))}
          </Select>
          <Select
            label="Currency"
            value={values.currency}
            onChange={(e) =>
              setValues((v) => ({ ...v, currency: e.target.value }))
            }
          >
            {CURRENCY_CODES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_INFO[c].symbol} {c} — {CURRENCY_INFO[c].name}
              </option>
            ))}
          </Select>
        </div>

        <Input
          label="Initial balance"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={values.initial_balance}
          onChange={(e) =>
            setValues((v) => ({ ...v, initial_balance: e.target.value }))
          }
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Color</label>
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setValues((v) => ({ ...v, color: c }))}
                className={cn(
                  "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
                  values.color.toLowerCase() === c.toLowerCase()
                    ? "border-gray-900 ring-2 ring-offset-2"
                    : "border-transparent",
                )}
                style={{ backgroundColor: c }}
                aria-label={`Select color ${c}`}
              />
            ))}
            <input
              type="color"
              value={values.color}
              onChange={(e) =>
                setValues((v) => ({ ...v, color: e.target.value }))
              }
              className="h-8 w-8 cursor-pointer rounded-full border-0 bg-transparent p-0"
              aria-label="Custom color"
            />
          </div>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : initial ? "Save changes" : "Create account"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  Icons                                                                     */
/* -------------------------------------------------------------------------- */

function PencilIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={cn("h-5 w-5 transition-transform", open && "rotate-180")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Account card                                                             */
/* -------------------------------------------------------------------------- */

function AccountCard({
  account,
  balance,
  onEdit,
  onArchive,
}: {
  account: Account;
  balance: number;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const type = accountTypeInfo(account.type);
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
      style={{ borderTopColor: account.color, borderTopWidth: 4 }}
    >
      <div className="flex items-start justify-between">
        <button
          type="button"
          onClick={onEdit}
          className="flex items-start gap-3 text-left"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
            style={{ backgroundColor: `${account.color}1A` }}
          >
            {type.icon}
          </span>
          <div>
            <h3 className="font-semibold text-gray-900">{account.name}</h3>
            <p className="text-xs text-gray-400">
              {type.label} · {account.currency}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Edit account"
            title="Edit"
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            onClick={onArchive}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
            aria-label="Archive account"
            title="Archive"
          >
            <ArchiveIcon />
          </button>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs uppercase tracking-wide text-gray-400">Balance</p>
        <p
          className={cn(
            "mt-0.5 text-2xl font-bold tabular-nums",
            balance < 0 ? "text-rose-600" : "text-gray-900",
          )}
        >
          {formatCurrency(balance, account.currency)}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<Account | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    // Note: loading/error reset is handled by callers (the mount effect sets
    // them in async callbacks; the retry button sets them in its event handler)
    // so that this function does not synchronously call setState — which would
    // be flagged when invoked from an effect (react-hooks/set-state-in-effect).
    try {
      const [accRes, txnRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/transactions"),
      ]);
      if (checkAuthExpired(accRes)) return; if (!accRes.ok) {
        const body = await accRes.json().catch(() => ({}));
        throw new Error(body.error || `Failed to load accounts (${accRes.status})`);
      }
      if (checkAuthExpired(txnRes)) return; if (!txnRes.ok) {
        const body = await txnRes.json().catch(() => ({}));
        throw new Error(
          body.error || `Failed to load transactions (${txnRes.status})`,
        );
      }
      const accData: AccountsResponse = await accRes.json();
      const txnData: TransactionsResponse = await txnRes.json();
      setAccounts(accData.accounts ?? []);
      setTransactions(txnData.transactions ?? []);
    } catch (e: unknown) {
      setError(getErrorMessage(e) || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load on mount. The setState calls above all run inside async
  // callbacks (after `await`), so the effect body itself does not call
  // setState synchronously.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [accRes, txnRes] = await Promise.all([
          fetch("/api/accounts"),
          fetch("/api/transactions"),
        ]);
        if (cancelled) return;
        if (checkAuthExpired(accRes)) return; if (!accRes.ok) {
          const body = await accRes.json().catch(() => ({}));
          throw new Error(body.error || `Failed to load accounts (${accRes.status})`);
        }
        if (checkAuthExpired(txnRes)) return; if (!txnRes.ok) {
          const body = await txnRes.json().catch(() => ({}));
          throw new Error(
            body.error || `Failed to load transactions (${txnRes.status})`,
          );
        }
        const accData: AccountsResponse = await accRes.json();
        const txnData: TransactionsResponse = await txnRes.json();
        if (cancelled) return;
        setAccounts(accData.accounts ?? []);
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

  const balances = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of accounts) {
      map.set(a.id, computeAccountBalance(a, transactions));
    }
    return map;
  }, [accounts, transactions]);

  const activeAccounts = accounts.filter((a) => !a.archived);
  const archivedAccounts = accounts.filter((a) => a.archived);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditing(account);
    setModalOpen(true);
  };

  const handleSubmit = async (values: AccountFormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        name: values.name,
        type: values.type,
        currency: values.currency,
        initial_balance: parseFloat(values.initial_balance) || 0,
        color: values.color,
      };
      if (editing) {
        const res = await fetch(`/api/accounts/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (checkAuthExpired(res)) return; if (checkAuthExpired(res)) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to update account");
        }
        const updated: Account = await res.json();
        setAccounts((prev) =>
          prev.map((a) => (a.id === updated.id ? updated : a)),
        );
      } else {
        const res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (checkAuthExpired(res)) return; if (checkAuthExpired(res)) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to create account");
        }
        const created: Account = await res.json();
        setAccounts((prev) => [...prev, created]);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    const target = archiveTarget;
    setArchiveTarget(null);
    try {
      const res = await fetch(`/api/accounts/${target.id}`, {
        method: "DELETE",
      });
      if (checkAuthExpired(res)) return; if (checkAuthExpired(res)) return;
        if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to archive account");
      }
      setAccounts((prev) =>
        prev.map((a) => (a.id === target.id ? { ...a, archived: true } : a)),
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  };

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
          <h1 className="text-xl font-semibold text-gray-900">Accounts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track your bank, cash, card, and investment accounts.
          </p>
        </div>
        <Button onClick={openAdd}>
          <PlusIcon />
          Add Account
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

      {!error && activeAccounts.length === 0 && archivedAccounts.length === 0 ? (
        <Card>
          <EmptyState
            icon="🏦"
            title="No accounts yet"
            description="Add your first account to start tracking your spending and income."
            action={
              <Button onClick={openAdd}>
                <PlusIcon />
                Add Account
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {activeAccounts.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  balance={balances.get(account.id) ?? account.initial_balance}
                  onEdit={() => openEdit(account)}
                  onArchive={() => setArchiveTarget(account)}
                />
              ))}
            </div>
          )}

          {archivedAccounts.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowArchived((s) => !s)}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                <span>Archived ({archivedAccounts.length})</span>
                <ChevronIcon open={showArchived} />
              </button>
              {showArchived && (
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {archivedAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 p-5 opacity-70"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-11 w-11 items-center justify-center rounded-xl text-xl"
                          style={{ backgroundColor: `${account.color}1A` }}
                        >
                          {accountTypeInfo(account.type).icon}
                        </span>
                        <div>
                          <h3 className="font-semibold text-gray-600">
                            {account.name}
                          </h3>
                          <p className="text-xs text-gray-400">
                            {accountTypeInfo(account.type).label} ·{" "}
                            {account.currency}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm text-gray-400">
                          {formatCurrency(
                            balances.get(account.id) ?? account.initial_balance,
                            account.currency,
                          )}
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEdit(account)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <AccountFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        submitting={submitting}
        initial={
          editing
            ? {
                name: editing.name,
                type: editing.type,
                currency: editing.currency,
                initial_balance: String(editing.initial_balance),
                color: editing.color,
              }
            : null
        }
      />

      <ConfirmDialog
        open={!!archiveTarget}
        title="Archive account"
        message={`Archive "${archiveTarget?.name ?? ""}"? It will be hidden from your active accounts. You can still find it under Archived.`}
        confirmLabel="Archive"
        variant="danger"
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}
