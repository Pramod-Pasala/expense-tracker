import { NextRequest, NextResponse } from "next/server";
import { getDriveClient } from "@/lib/session";
import { readFile, writeFile } from "@/lib/drive";
import type { AccountsFile } from "@/lib/schema";
import { validateAccountsFile } from "@/lib/schema";
import { getErrorMessage } from "@/lib/format";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const drive = await getDriveClient(req);
    const body = await req.json();

    const raw = await readFile<unknown>(drive, "accounts.json");
    if (!raw) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    const data: AccountsFile = validateAccountsFile(raw);

    const idx = data.accounts.findIndex((a) => a.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    data.accounts[idx] = {
      ...data.accounts[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    data.updated_at = new Date().toISOString();
    await writeFile(drive, "accounts.json", data);

    return NextResponse.json(data.accounts[idx]);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    if (message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
    const raw = await readFile<unknown>(drive, "accounts.json");
    if (!raw) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    const data: AccountsFile = validateAccountsFile(raw);

    const idx = data.accounts.findIndex((a) => a.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Archive instead of hard delete (extensible data principle)
    data.accounts[idx].archived = true;
    data.accounts[idx].updated_at = new Date().toISOString();
    data.updated_at = new Date().toISOString();
    await writeFile(drive, "accounts.json", data);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    if (message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
