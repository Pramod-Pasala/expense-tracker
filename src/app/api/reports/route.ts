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

    const url = req.nextUrl;
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");

    // Default to current month if no range
    const now = new Date();
    const sDate = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const eDate = endDate || now.toISOString().split("T")[0];

    const [accountsRaw, txnsRaw, catsRaw] = await Promise.all([
      readFile<unknown>(drive, "accounts.json"),
      readFile<unknown>(drive, "transactions.json"),
      readFile<unknown>(drive, "categories.json"),
    ]);

    const accounts = accountsRaw ? validateAccountsFile(accountsRaw).accounts : [];
    const transactions = txnsRaw ? validateTransactionsFile(txnsRaw).transactions : [];
    const categories = catsRaw ? validateCategoriesFile(catsRaw).categories : [];

    // Filter by date range
    const rangeTxns = transactions.filter((t) => t.date >= sDate && t.date <= eDate);

    // Fetch rates for currency conversion
    const currencies = [...new Set(rangeTxns.map((t) => t.currency))].filter(
      (c) => c !== baseCurrency
    );
    const ratesMap: Record<string, number> = {};
    if (currencies.length > 0) {
      try {
        const rateResponse = await getLatestRate(baseCurrency, currencies);
        for (const [currency, rate] of Object.entries(rateResponse.rates)) {
          ratesMap[currency] = rate as number;
        }
      } catch {
        // Continue with native amounts
      }
    }

    const toBase = (amount: number, currency: string): number => {
      if (currency === baseCurrency) return amount;
      return amount / (ratesMap[currency] || 1);
    };

    // 1. Expense by category (pie chart)
    const categoryTotals: Record<string, { name: string; color: string; total: number }> = {};
    for (const txn of rangeTxns) {
      if (txn.type !== "expense") continue;
      const cat = categories.find((c) => c.id === txn.category_id);
      const catId = txn.category_id || "uncategorized";
      const catName = cat?.name || "Uncategorized";
      const catColor = cat?.color || "#9E9E9E";

      if (!categoryTotals[catId]) {
        categoryTotals[catId] = { name: catName, color: catColor, total: 0 };
      }
      categoryTotals[catId].total += toBase(txn.amount, txn.currency);
    }

    const expenseByCategory = Object.entries(categoryTotals)
      .map(([id, data]) => ({
        category_id: id,
        name: data.name,
        color: data.color,
        total: parseFloat(data.total.toFixed(2)),
      }))
      .sort((a, b) => b.total - a.total);

    // 2. Cashflow over time (income vs expense per month)
    const cashflowMap: Record<string, { income: number; expense: number }> = {};

    // Extend range to include all months from earliest transaction
    const allTxns = transactions.filter((t) => t.date >= sDate && t.date <= eDate);
    for (const txn of allTxns) {
      const month = txn.date.substring(0, 7); // YYYY-MM
      if (!cashflowMap[month]) {
        cashflowMap[month] = { income: 0, expense: 0 };
      }
      if (txn.type === "income") {
        cashflowMap[month].income += toBase(txn.amount, txn.currency);
      } else if (txn.type === "expense") {
        cashflowMap[month].expense += toBase(txn.amount, txn.currency);
      }
    }

    const cashflow = Object.entries(cashflowMap)
      .map(([month, data]) => ({
        month,
        income: parseFloat(data.income.toFixed(2)),
        expense: parseFloat(data.expense.toFixed(2)),
        net: parseFloat((data.income - data.expense).toFixed(2)),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // 3. Spending by account
    const accountTotals: Record<string, { name: string; color: string; total: number }> = {};
    for (const txn of rangeTxns) {
      if (txn.type !== "expense") continue;
      const acc = accounts.find((a) => a.id === txn.account_id);
      const accId = txn.account_id;
      const accName = acc?.name || "Unknown";
      const accColor = acc?.color || "#9E9E9E";

      if (!accountTotals[accId]) {
        accountTotals[accId] = { name: accName, color: accColor, total: 0 };
      }
      accountTotals[accId].total += toBase(txn.amount, txn.currency);
    }

    const spendingByAccount = Object.entries(accountTotals)
      .map(([id, data]) => ({
        account_id: id,
        name: data.name,
        color: data.color,
        total: parseFloat(data.total.toFixed(2)),
      }))
      .sort((a, b) => b.total - a.total);

    // 4. Summary totals
    const totalIncome = cashflow.reduce((sum, c) => sum + c.income, 0);
    const totalExpense = cashflow.reduce((sum, c) => sum + c.expense, 0);

    return NextResponse.json({
      date_range: { start: sDate, end: eDate },
      base_currency: baseCurrency,
      expense_by_category: expenseByCategory,
      cashflow,
      spending_by_account: spendingByAccount,
      summary: {
        total_income: parseFloat(totalIncome.toFixed(2)),
        total_expense: parseFloat(totalExpense.toFixed(2)),
        net: parseFloat((totalIncome - totalExpense).toFixed(2)),
      },
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    if (message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
