import { NextRequest, NextResponse } from "next/server";
import { getDriveClient } from "@/lib/session";
import { readFile, writeFile } from "@/lib/drive";
import type { TransactionsFile, Transaction } from "@/lib/schema";
import { validateTransactionsFile } from "@/lib/schema";
import { getErrorMessage } from "@/lib/format";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
  try {
    const drive = await getDriveClient(req);
    const raw = await readFile<unknown>(drive, "transactions.json");
    if (!raw) {
      return NextResponse.json({
        schema_version: 1,
        updated_at: new Date().toISOString(),
        transactions: [],
      });
    }
    const data = validateTransactionsFile(raw);

    // Optional query filters
    const url = req.nextUrl;
    const accountId = url.searchParams.get("account_id");
    const type = url.searchParams.get("type");
    const categoryParam = url.searchParams.get("category_id");
    const limitParam = url.searchParams.get("limit");
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");

    let txns = data.transactions;

    if (accountId) {
      txns = txns.filter(
        (t) =>
          t.account_id === accountId ||
          t.transfer_to_account_id === accountId
      );
    }
    if (type) {
      txns = txns.filter((t) => t.type === type);
    }
    if (categoryParam) {
      txns = txns.filter((t) => t.category_id === categoryParam);
    }
    if (startDate) {
      txns = txns.filter((t) => t.date >= startDate!);
    }
    if (endDate) {
      txns = txns.filter((t) => t.date <= endDate!);
    }

    // Sort by date descending (newest first)
    txns = txns.sort((a, b) => b.date.localeCompare(a.date));

    if (limitParam) {
      txns = txns.slice(0, parseInt(limitParam));
    }

    return NextResponse.json({
      schema_version: data.schema_version,
      updated_at: data.updated_at,
      transactions: txns,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    if (message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const drive = await getDriveClient(req);
    const body = await req.json();

    const raw = await readFile<unknown>(drive, "transactions.json");
    const data: TransactionsFile = raw
      ? validateTransactionsFile(raw)
      : {
          schema_version: 1,
          updated_at: new Date().toISOString(),
          transactions: [],
        };

    const now = new Date().toISOString();
    const newTxn: Transaction = {
      id: uuidv4(),
      type: body.type || "expense",
      amount: parseFloat(body.amount),
      currency: body.currency || "EUR",
      account_id: body.account_id,
      category_id: body.category_id || null,
      date: body.date || new Date().toISOString().split("T")[0],
      notes: body.notes || "",
      tags: body.tags || [],
      created_at: now,
      updated_at: now,

      // Transfer-specific fields (null for income/expense)
      transfer_to_account_id: body.transfer_to_account_id || null,
      transfer_from_amount: body.transfer_from_amount || null,
      transfer_to_amount: body.transfer_to_amount || null,
      exchange_rate: body.exchange_rate || null,
      exchange_rate_source: body.exchange_rate_source || null,
      exchange_rate_date: body.exchange_rate_date || null,
      transfer_fee: body.transfer_fee || null,
      transfer_fee_account_id: body.transfer_fee_account_id || null,

      metadata: body.metadata || {},
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
