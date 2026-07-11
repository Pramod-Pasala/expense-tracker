import { NextRequest, NextResponse } from "next/server";
import { getDriveClient } from "@/lib/session";
import { readFile, writeFile } from "@/lib/drive";
import type { TransactionsFile } from "@/lib/schema";
import { validateTransactionsFile } from "@/lib/schema";
import { getErrorMessage, isDriveAuthError} from "@/lib/format";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const drive = await getDriveClient(req);
    const body = await req.json();

    const raw = await readFile<unknown>(drive, "transactions.json");
    if (!raw) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    const data: TransactionsFile = validateTransactionsFile(raw);

    const idx = data.transactions.findIndex((t) => t.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    data.transactions[idx] = {
      ...data.transactions[idx],
      ...body,
      amount: body.amount !== undefined ? parseFloat(body.amount) : data.transactions[idx].amount,
      updated_at: new Date().toISOString(),
    };
    data.updated_at = new Date().toISOString();
    await writeFile(drive, "transactions.json", data);

    return NextResponse.json(data.transactions[idx]);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    if (message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (isDriveAuthError(message)) {
      return NextResponse.json({ error: "Token expired or invalid. Please reconnect." }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const drive = await getDriveClient(req);
    const raw = await readFile<unknown>(drive, "transactions.json");
    if (!raw) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    const data: TransactionsFile = validateTransactionsFile(raw);

    const idx = data.transactions.findIndex((t) => t.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Hard delete for transactions (they can be recreated, and archived
    // transactions would skew balance calculations)
    data.transactions.splice(idx, 1);
    data.updated_at = new Date().toISOString();
    await writeFile(drive, "transactions.json", data);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    if (message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (isDriveAuthError(message)) {
      return NextResponse.json({ error: "Token expired or invalid. Please reconnect." }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
