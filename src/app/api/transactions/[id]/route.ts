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

    const txn = data.transactions.find((t) => t.id === id);
    if (!txn) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const idsToDelete = new Set<string>([id]);

    // Cascade: if deleting a transfer, also delete its fee expense
    if (txn.type === "transfer") {
      for (const t of data.transactions) {
        if (
          t.type === "expense" &&
          t.tags.includes("TransferFee") &&
          t.date === txn.date &&
          t.account_id === txn.account_id
        ) {
          idsToDelete.add(t.id);
        }
      }
    }

    // Cascade: if deleting a fee expense, also delete its parent transfer
    if (txn.type === "expense" && txn.tags.includes("TransferFee")) {
      for (const t of data.transactions) {
        if (
          t.type === "transfer" &&
          t.date === txn.date &&
          t.account_id === txn.account_id
        ) {
          // Also delete any other fee expenses for this transfer
          idsToDelete.add(t.id);
          for (const f of data.transactions) {
            if (
              f.type === "expense" &&
              f.tags.includes("TransferFee") &&
              f.date === t.date &&
              f.account_id === t.account_id
            ) {
              idsToDelete.add(f.id);
            }
          }
        }
      }
    }

    data.transactions = data.transactions.filter((t) => !idsToDelete.has(t.id));
    data.updated_at = new Date().toISOString();
    await writeFile(drive, "transactions.json", data);

    return NextResponse.json({ success: true, deleted: Array.from(idsToDelete) });
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
