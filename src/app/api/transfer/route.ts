import { NextRequest, NextResponse } from "next/server";
import { getDriveClient } from "@/lib/session";
import { readFile, writeFile } from "@/lib/drive";
import type { TransactionsFile, Transaction, AccountsFile } from "@/lib/schema";
import { validateTransactionsFile, validateAccountsFile } from "@/lib/schema";
import { getErrorMessage } from "@/lib/format";
import { getLatestRate, getHistoricalRate } from "@/lib/exchange";
import { v4 as uuidv4 } from "uuid";

// GET exchange rate for a transfer preview
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const amount = parseFloat(url.searchParams.get("amount") || "0");
    const date = url.searchParams.get("date"); // optional historical date

    if (!from || !to) {
      return NextResponse.json(
        { error: "Both 'from' and 'to' currency params are required" },
        { status: 400 }
      );
    }

    if (from === to) {
      return NextResponse.json({
        from,
        to,
        rate: 1,
        amount,
        converted_amount: amount,
        source: "identity",
        date: new Date().toISOString().split("T")[0],
      });
    }

    // Fetch rate (historical if date provided, otherwise latest)
    const rateResponse = date
      ? await getHistoricalRate(date, from, to)
      : await getLatestRate(from, to);

    const rate = rateResponse.rates[to];
    if (!rate) {
      return NextResponse.json(
        { error: `Could not find rate for ${to}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      from,
      to,
      rate,
      amount,
      converted_amount: amount * rate,
      source: "frankfurter",
      date: rateResponse.date,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

// POST to create a transfer transaction
export async function POST(req: NextRequest) {
  try {
    const drive = await getDriveClient(req);
    const body = await req.json();

    const {
      from_account_id,
      to_account_id,
      amount,
      date,
      exchange_rate,
      exchange_rate_source,
      transfer_fee,
      notes,
      tags,
    } = body;

    if (!from_account_id || !to_account_id || !amount) {
      return NextResponse.json(
        { error: "from_account_id, to_account_id, and amount are required" },
        { status: 400 }
      );
    }

    if (from_account_id === to_account_id) {
      return NextResponse.json(
        { error: "Source and destination accounts must be different" },
        { status: 400 }
      );
    }

    // Fetch accounts to get currencies
    const accountsRaw = await readFile<AccountsFile>(drive, "accounts.json");
    if (!accountsRaw) {
      return NextResponse.json({ error: "No accounts found" }, { status: 400 });
    }
    const accountsFile = validateAccountsFile(accountsRaw);

    // Read transactions file
    const raw = await readFile<unknown>(drive, "transactions.json");
    const data: TransactionsFile = raw
      ? validateTransactionsFile(raw)
      : {
          schema_version: 1,
          updated_at: new Date().toISOString(),
          transactions: [],
        };

    const now = new Date().toISOString();
    const transferDate = date || now.split("T")[0];

    let finalRate = exchange_rate;
    let rateSource = exchange_rate_source || "manual";
    let rateDate = transferDate;
    let convertedAmount = amount;

    // If same currency, rate is 1
    // If different currency and no manual rate provided, fetch from Frankfurter
    // Determine if currencies differ by checking accounts
    const fromAccount = accountsFile.accounts.find(
      (a) => a.id === from_account_id
    );
    const toAccount = accountsFile.accounts.find(
      (a) => a.id === to_account_id
    );

    if (!fromAccount || !toAccount) {
      return NextResponse.json({ error: "Account not found" }, { status: 400 });
    }

    const sameCurrency = fromAccount.currency === toAccount.currency;

    if (sameCurrency) {
      finalRate = 1;
      rateSource = "identity";
      convertedAmount = amount;
    } else if (!finalRate) {
      // Auto-fetch rate from Frankfurter
      try {
        const rateResponse = transferDate === now.split("T")[0]
          ? await getLatestRate(fromAccount.currency, toAccount.currency)
          : await getHistoricalRate(transferDate, fromAccount.currency, toAccount.currency);
        finalRate = rateResponse.rates[toAccount.currency];
        rateSource = "frankfurter";
        rateDate = rateResponse.date;
        convertedAmount = amount * finalRate;
      } catch (err: unknown) {
        return NextResponse.json(
          { error: `Failed to fetch exchange rate: ${getErrorMessage(err)}` },
          { status: 500 }
        );
      }
    } else {
      // Manual rate provided
      convertedAmount = amount * finalRate;
    }

    const newTxn: Transaction = {
      id: uuidv4(),
      type: "transfer",
      amount: amount,
      currency: fromAccount.currency,
      account_id: from_account_id,
      category_id: null,
      date: transferDate,
      notes: notes || "",
      tags: tags || [],
      created_at: now,
      updated_at: now,

      transfer_to_account_id: to_account_id,
      transfer_from_amount: amount,
      transfer_to_amount: convertedAmount,
      exchange_rate: finalRate,
      exchange_rate_source: rateSource as "frankfurter" | "manual" | null,
      exchange_rate_date: rateDate,
      transfer_fee: transfer_fee || null,
      transfer_fee_account_id: transfer_fee ? from_account_id : null,

      metadata: {},
    };

    data.transactions.push(newTxn);
    data.updated_at = now;
    await writeFile(drive, "transactions.json", data);

    return NextResponse.json(newTxn, { status: 201 });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    if (message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
