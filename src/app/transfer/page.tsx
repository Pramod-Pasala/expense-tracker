"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { Account, Transaction } from "@/lib/types";
import { formatCurrency, getErrorMessage } from "@/lib/format";
import {
  Button,
  EmptyState,
  Label,
  LoadingState,
  PageHeader,
  Select,
  TextArea,
  TextInput,
} from "@/components/ui";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface AccountsResponse {
  accounts: Account[];
}

interface RateResponse {
  from: string;
  to: string;
  rate: number;
  amount: number;
  converted_amount: number;
  source: string;
  date: string;
}

interface RecentTransfersResponse {
  transactions: Transaction[];
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function parseAmount(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function formatRate(rate: number): string {
  // Show enough decimals for small rates, trim trailing zeros otherwise.
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(rate);
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function TransferPage() {
  const router = useRouter();

  // --- data state ----------------------------------------------------------
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  // --- form state ----------------------------------------------------------
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [transferFee, setTransferFee] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [useCustomRate, setUseCustomRate] = useState(false);
  const [customRate, setCustomRate] = useState("");

  // --- rate state ----------------------------------------------------------
  const [rateData, setRateData] = useState<RateResponse | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  // --- submit state --------------------------------------------------------
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    amount: number;
    fromCur: string;
    converted: number;
    toCur: string;
    different: boolean;
  } | null>(null);

  // --- recent transfers ----------------------------------------------------
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  /* ------------------------------------------------------------------------ */
  /*  Fetch accounts + recent transfers on mount                               */
  /* ------------------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingAccounts(true);
      setAccountsError(null);
      try {
        const res = await fetch("/api/accounts");
        if (!res.ok) throw new Error(`Failed to load accounts (${res.status})`);
        const data: AccountsResponse = await res.json();
        if (cancelled) return;
        setAccounts(data.accounts || []);
      } catch (err: unknown) {
        if (!cancelled) setAccountsError(getErrorMessage(err) || "Failed to load accounts");
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    })();

    (async () => {
      setRecentLoading(true);
      try {
        const res = await fetch("/api/transactions?type=transfer&limit=5");
        if (!res.ok) return;
        const data: RecentTransfersResponse = await res.json();
        if (!cancelled) setRecent(data.transactions || []);
      } catch {
        // non-fatal
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------------------------------------------------------ */
  /*  Derived currency info                                                    */
  /* ------------------------------------------------------------------------ */
  const fromAccount = useMemo(
    () => accounts.find((a) => a.id === fromAccountId) || null,
    [accounts, fromAccountId],
  );
  const toAccount = useMemo(
    () => accounts.find((a) => a.id === toAccountId) || null,
    [accounts, toAccountId],
  );

  const sameAccount = !!fromAccountId && fromAccountId === toAccountId;
  const fromCur = fromAccount?.currency;
  const toCur = toAccount?.currency;
  const differentCurrencies = !!fromCur && !!toCur && fromCur !== toCur;

  /* ------------------------------------------------------------------------ */
  /*  Auto-fetch exchange rate when currencies differ                          */
  /*  (skipped when custom rate is enabled)                                    */
  /* ------------------------------------------------------------------------ */

  const rateClearSig = `${useCustomRate}|${differentCurrencies}|${parseAmount(amount) > 0}`;
  const [prevRateClearSig, setPrevRateClearSig] = useState(rateClearSig);
  if (rateClearSig !== prevRateClearSig) {
    setPrevRateClearSig(rateClearSig);
    if (useCustomRate || !differentCurrencies || parseAmount(amount) <= 0) {
      setRateData(null);
      setRateError(null);
    }
  }

  const fetchRateIdRef = useRef(0);
  useEffect(() => {
    if (useCustomRate || !differentCurrencies || !fromCur || !toCur) {
      return;
    }
    const amt = parseAmount(amount);
    if (amt <= 0) {
      return;
    }

    const reqId = ++fetchRateIdRef.current;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setRateLoading(true);
      setRateError(null);
      try {
        const params = new URLSearchParams({
          from: fromCur,
          to: toCur,
          amount: String(amt),
        });
        if (date) params.set("date", date);
        const res = await fetch(`/api/transfer?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed to fetch rate (${res.status})`);
        }
        const data: RateResponse = await res.json();
        if (reqId === fetchRateIdRef.current) {
          setRateData(data);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (reqId === fetchRateIdRef.current) {
          setRateData(null);
          setRateError(getErrorMessage(err) || "Failed to fetch exchange rate");
        }
      } finally {
        if (reqId === fetchRateIdRef.current) setRateLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [fromCur, toCur, amount, date, differentCurrencies, useCustomRate]);

  /* ------------------------------------------------------------------------ */
  /*  Effective rate + converted amount (manual or fetched)                    */
  /* ------------------------------------------------------------------------ */
  const effectiveRate = useMemo(() => {
    if (!differentCurrencies) return 1;
    if (useCustomRate) return parseAmount(customRate) || 0;
    return rateData?.rate ?? 0;
  }, [differentCurrencies, useCustomRate, customRate, rateData]);

  const convertedAmount = useMemo(() => {
    const amt = parseAmount(amount);
    if (!differentCurrencies) return amt;
    return amt * effectiveRate;
  }, [amount, differentCurrencies, effectiveRate]);

  const rateSource = useMemo(() => {
    if (!differentCurrencies) return null;
    if (useCustomRate) return "manual";
    return rateData?.source ?? null;
  }, [differentCurrencies, useCustomRate, rateData]);

  /* ------------------------------------------------------------------------ */
  /*  Submit                                                                    */
  /* ------------------------------------------------------------------------ */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      if (!fromAccountId || !toAccountId) {
        setSubmitError("Please select both source and destination accounts.");
        return;
      }
      if (sameAccount) {
        setSubmitError("Source and destination accounts must be different.");
        return;
      }
      const amt = parseAmount(amount);
      if (amt <= 0) {
        setSubmitError("Enter an amount greater than zero.");
        return;
      }
      if (differentCurrencies && useCustomRate && parseAmount(customRate) <= 0) {
        setSubmitError("Enter a valid custom exchange rate.");
        return;
      }

      setSubmitting(true);
      try {
        const body: Record<string, unknown> = {
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
          amount: amt,
          date,
          notes,
          tags: parseTags(tagsInput),
        };
        if (transferFee) {
          body.transfer_fee = parseAmount(transferFee);
        }
        if (differentCurrencies) {
          if (useCustomRate) {
            body.exchange_rate = parseAmount(customRate);
            body.exchange_rate_source = "manual";
          } else if (rateData) {
            body.exchange_rate = rateData.rate;
            body.exchange_rate_source = rateData.source;
          }
        }

        const res = await fetch("/api/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `Transfer failed (${res.status})`);
        }

        setSuccess({
          amount: amt,
          fromCur: fromCur!,
          converted: convertedAmount,
          toCur: toCur!,
          different: !!differentCurrencies,
        });
      } catch (err: unknown) {
        setSubmitError(getErrorMessage(err) || "Transfer failed");
      } finally {
        setSubmitting(false);
      }
    },
    [
      fromAccountId,
      toAccountId,
      sameAccount,
      amount,
      differentCurrencies,
      useCustomRate,
      customRate,
      transferFee,
      date,
      notes,
      tagsInput,
      rateData,
      convertedAmount,
      fromCur,
      toCur,
    ],
  );

  const resetForm = useCallback(() => {
    setSuccess(null);
    setFromAccountId("");
    setToAccountId("");
    setAmount("");
    setTransferFee("");
    setNotes("");
    setTagsInput("");
    setUseCustomRate(false);
    setCustomRate("");
    setDate(today());
    setRateData(null);
    setSubmitError(null);
  }, []);

  /* ------------------------------------------------------------------------ */
  /*  Render — success state                                                   */
  /* ------------------------------------------------------------------------ */
  if (success) {
    return (
      <div>
        <PageHeader title="Transfer Money" />
        <div className="mx-auto w-full max-w-xl rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-green-100 bg-green-50 p-6 dark:border-green-900/50 dark:bg-green-950/30">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
                <svg
                  className="h-5 w-5 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-green-900 dark:text-green-100">
                  Transfer complete
                </h2>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Your money is on its way.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3 p-6">
            <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Amount sent
              </span>
              <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {formatCurrency(success.amount, success.fromCur)}
              </span>
            </div>
            {success.different && (
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  Amount received
                </span>
                <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  {formatCurrency(success.converted, success.toCur)}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-zinc-200 p-6 sm:flex-row dark:border-zinc-800">
            <Button
              onClick={() => router.push("/transactions")}
              className="sm:flex-1"
            >
              View transactions
            </Button>
            <Button variant="secondary" onClick={resetForm} className="sm:flex-1">
              New transfer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /*  Render — main form                                                       */
  /* ------------------------------------------------------------------------ */
  return (
    <div>
      <PageHeader
        title="Transfer Money"
        description="Move funds between accounts — with live exchange rates for currency conversion."
      />

      {accountsError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {accountsError}
        </div>
      )}

      {loadingAccounts ? (
        <LoadingState label="Loading accounts…" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Form column */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  New transfer
                </h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4 p-5">
                {/* Accounts */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="from_account">From account</Label>
                    <Select
                      id="from_account"
                      value={fromAccountId}
                      onChange={(e) => setFromAccountId(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="">Select source…</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.currency})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="to_account">To account</Label>
                    <Select
                      id="to_account"
                      value={toAccountId}
                      onChange={(e) => setToAccountId(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="">Select destination…</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.currency})
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {sameAccount && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Source and destination must be different accounts.
                  </p>
                )}

                {/* Amount + Date */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="amount">
                      Amount{fromCur ? ` (${fromCur})` : ""}
                    </Label>
                    <TextInput
                      id="amount"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <TextInput
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                </div>

                {/* Exchange rate section — only when currencies differ */}
                {differentCurrencies && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                        Exchange rate
                      </h4>
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <input
                          type="checkbox"
                          checked={useCustomRate}
                          onChange={(e) => setUseCustomRate(e.target.checked)}
                          className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
                        />
                        Use custom rate
                      </label>
                    </div>

                    {useCustomRate ? (
                      <div className="mt-3">
                        <Label htmlFor="custom_rate">
                          Custom rate (1 {fromCur} = ? {toCur})
                        </Label>
                        <TextInput
                          id="custom_rate"
                          type="number"
                          inputMode="decimal"
                          step="0.0001"
                          min="0"
                          placeholder="0.0000"
                          value={customRate}
                          onChange={(e) => setCustomRate(e.target.value)}
                          disabled={submitting}
                        />
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {rateLoading && (
                          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                            <svg
                              className="h-4 w-4 animate-spin text-blue-500"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                            Fetching latest rate…
                          </div>
                        )}
                        {rateError && !rateLoading && (
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {rateError}
                          </p>
                        )}
                        {rateData && !rateLoading && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              1 {fromCur} = {formatRate(rateData.rate)} {toCur}
                            </span>
                            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs capitalize text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                              {rateData.source}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Converted amount */}
                    {parseAmount(amount) > 0 && effectiveRate > 0 && (
                      <div className="mt-3 rounded-md bg-white p-3 text-sm dark:bg-zinc-900">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(parseAmount(amount), fromCur!)}
                        </span>
                        <span className="mx-2 text-zinc-400">→</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {formatCurrency(convertedAmount, toCur!)}
                        </span>
                        {rateSource && (
                          <span className="ml-2 text-xs text-zinc-400">
                            ({rateSource})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Transfer fee */}
                <div>
                  <Label htmlFor="fee">
                    Transfer fee (optional)
                    {fromCur ? ` · in ${fromCur}, charged to source` : ""}
                  </Label>
                  <TextInput
                    id="fee"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={transferFee}
                    onChange={(e) => setTransferFee(e.target.value)}
                    disabled={submitting}
                  />
                </div>

                {/* Notes + Tags */}
                <div>
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <TextArea
                    id="notes"
                    rows={2}
                    placeholder="Add a note…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <Label htmlFor="tags">Tags (optional)</Label>
                  <TextInput
                    id="tags"
                    type="text"
                    placeholder="comma-separated, e.g. rent, monthly"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    disabled={submitting}
                  />
                </div>

                {submitError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                    {submitError}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    type="submit"
                    disabled={submitting || sameAccount}
                    className="flex-1"
                  >
                    {submitting ? "Processing…" : "Transfer"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetForm}
                    disabled={submitting}
                  >
                    Reset
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* Sidebar: recent transfers */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:sticky lg:top-6">
              <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Recent transfers
                </h2>
              </div>
              <div className="p-5">
                {recentLoading ? (
                  <div className="flex items-center justify-center py-8 text-zinc-400">
                    <svg
                      className="h-5 w-5 animate-spin text-zinc-400"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  </div>
                ) : recent.length === 0 ? (
                  <EmptyState
                    icon="⇄"
                    title="No transfers yet"
                    description="Your recent transfers will appear here."
                  />
                ) : (
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {recent.map((t) => {
                      const fromAcc = accounts.find((a) => a.id === t.account_id);
                      const toAcc = accounts.find(
                        (a) => a.id === t.transfer_to_account_id,
                      );
                      const toCurrency = toAcc?.currency || t.currency;
                      const showConverted =
                        t.transfer_to_amount != null &&
                        t.transfer_to_amount !== t.amount;
                      return (
                        <li key={t.id} className="py-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                {fromAcc?.name || "Unknown"} →{" "}
                                {toAcc?.name || "Unknown"}
                              </p>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {t.date}
                                {t.transfer_fee
                                  ? ` · fee ${formatCurrency(t.transfer_fee, t.currency)}`
                                  : ""}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                {formatCurrency(t.amount, t.currency)}
                              </p>
                              {showConverted && (
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                  → {formatCurrency(t.transfer_to_amount!, toCurrency)}
                                </p>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
