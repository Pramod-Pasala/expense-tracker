import { NextRequest, NextResponse } from "next/server";
import { getDriveClient, getSettings } from "@/lib/session";
import { readFile } from "@/lib/drive";
import { validateAccountsFile, validateTransactionsFile, validateCategoriesFile } from "@/lib/schema";
import { getErrorMessage } from "@/lib/format";
import { getLatestRate } from "@/lib/exchange";

export async function GET(req: NextRequest) {
  try {
    const drive = await getDriveClient(req);
    const settings = await getSettings(req);
    const baseCurrency = settings.base_currency;

    // Load all data
    const [accountsRaw, txnsRaw, catsRaw] = await Promise.all([
      readFile<unknown>(drive, "accounts.json"),
      readFile<unknown>(drive, "transactions.json"),
      readFile<unknown>(drive, "categories.json"),
    ]);

    const accounts = accountsRaw ? validateAccountsFile(accountsRaw).accounts : [];
    const transactions = txnsRaw ? validateTransactionsFile(txnsRaw).transactions : [];
    const categories = catsRaw ? validateCategoriesFile(catsRaw).categories : [];

    const activeAccounts = accounts.filter((a) => !a.archived);

    // Calculate account balances: initial_balance + income - expense + transfers received - transfers sent
    const balances: Record<string, number> = {};
    for (const acc of activeAccounts) {
      balances[acc.id] = acc.initial_balance;
    }

    for (const txn of transactions) {
      if (txn.type === "income") {
        if (balances[txn.account_id] !== undefined) {
          balances[txn.account_id] += txn.amount;
        }
      } else if (txn.type === "expense") {
        if (balances[txn.account_id] !== undefined) {
          balances[txn.account_id] -= txn.amount;
        }
      } else if (txn.type === "transfer") {
        // Debit source account
        const debitAmount = txn.transfer_fee
          ? txn.amount + txn.transfer_fee
          : txn.amount;
        if (balances[txn.account_id] !== undefined) {
          balances[txn.account_id] -= debitAmount;
        }
        // Credit destination account
        const toId = txn.transfer_to_account_id!;
        if (balances[toId] !== undefined) {
          balances[toId] += txn.transfer_to_amount || 0;
        }
      }
    }

    // Convert all balances to base currency for net worth
    let netWorth = 0;
    const accountBalances = activeAccounts.map((acc) => {
      const balance = balances[acc.id] || 0;
      return {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        currency: acc.currency,
        color: acc.color,
        balance,
      };
    });

    // Fetch exchange rates for non-base currencies
    const nonBaseCurrencies = [...new Set(activeAccounts.map((a) => a.currency))].filter(
      (c) => c !== baseCurrency
    );

    const ratesMap: Record<string, number> = {};
    if (nonBaseCurrencies.length > 0) {
      try {
        const rateResponse = await getLatestRate(baseCurrency, nonBaseCurrencies);
        for (const [currency, rate] of Object.entries(rateResponse.rates)) {
          ratesMap[currency] = rate as number;
        }
      } catch (err) {
        // If rate fetch fails, just show native balances
        console.error("Rate fetch failed for dashboard:", err);
      }
    }

    for (const acc of accountBalances) {
      if (acc.currency === baseCurrency) {
        netWorth += acc.balance;
      } else {
        const rate = ratesMap[acc.currency];
        if (rate) {
          netWorth += acc.balance / rate; // Convert to base
        }
      }
    }

    // This month's income vs expense
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const monthTxns = transactions.filter((t) => t.date >= monthStart);

    let monthIncome = 0;
    let monthExpense = 0;

    // Convert monthly totals to base currency
    const incomeByCurrency: Record<string, number> = {};
    const expenseByCurrency: Record<string, number> = {};

    for (const txn of monthTxns) {
      if (txn.type === "income") {
        incomeByCurrency[txn.currency] = (incomeByCurrency[txn.currency] || 0) + txn.amount;
      } else if (txn.type === "expense") {
        expenseByCurrency[txn.currency] = (expenseByCurrency[txn.currency] || 0) + txn.amount;
      }
    }

    for (const [currency, amount] of Object.entries(incomeByCurrency)) {
      if (currency === baseCurrency) {
        monthIncome += amount;
      } else {
        monthIncome += amount / (ratesMap[currency] || 1);
      }
    }
    for (const [currency, amount] of Object.entries(expenseByCurrency)) {
      if (currency === baseCurrency) {
        monthExpense += amount;
      } else {
        monthExpense += amount / (ratesMap[currency] || 1);
      }
    }

    // Recent transactions (last 10)
    const recent = [...transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10)
      .map((t) => {
        const account = accounts.find((a) => a.id === t.account_id);
        const category = t.category_id
          ? categories.find((c) => c.id === t.category_id)
          : null;
        return {
          id: t.id,
          type: t.type,
          amount: t.amount,
          currency: t.currency,
          date: t.date,
          notes: t.notes,
          account_name: account?.name || "Unknown",
          category_name: category?.name || null,
          category_color: category?.color || null,
        };
      });

    return NextResponse.json({
      net_worth: parseFloat(netWorth.toFixed(2)),
      base_currency: baseCurrency,
      accounts: accountBalances.map((a) => ({
        ...a,
        balance: parseFloat(a.balance.toFixed(2)),
      })),
      month_income: parseFloat(monthIncome.toFixed(2)),
      month_expense: parseFloat(monthExpense.toFixed(2)),
      recent_transactions: recent,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("[dashboard] Error:", message, error);
    if (message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    // Drive API auth errors (expired token, invalid credentials)
    if (/invalid authentication credentials|invalid_grant|401|unauthorized/i.test(message)) {
      return NextResponse.json({ error: "Token expired or invalid. Please reconnect." }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
