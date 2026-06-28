import { NextRequest, NextResponse } from "next/server";
import { getDriveClient } from "@/lib/session";
import { readFile, writeFile } from "@/lib/drive";
import type { AccountsFile } from "@/lib/schema";
import { validateAccountsFile } from "@/lib/schema";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
  try {
    const drive = await getDriveClient(req);
    const raw = await readFile<any>(drive, "accounts.json");
    if (!raw) {
      return NextResponse.json({ schema_version: 1, updated_at: new Date().toISOString(), accounts: [] });
    }
    const data = validateAccountsFile(raw);
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const drive = await getDriveClient(req);
    const body = await req.json();

    // Read existing accounts
    const raw = await readFile<any>(drive, "accounts.json");
    const data: AccountsFile = raw
      ? validateAccountsFile(raw)
      : { schema_version: 1, updated_at: new Date().toISOString(), accounts: [] };

    const newAccount = {
      id: uuidv4(),
      name: body.name,
      type: body.type || "bank",
      currency: body.currency || "EUR",
      initial_balance: body.initial_balance ?? 0,
      color: body.color || "#4CAF50",
      icon: body.icon || "bank",
      archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: body.metadata || {},
    };

    data.accounts.push(newAccount);
    data.updated_at = new Date().toISOString();
    await writeFile(drive, "accounts.json", data);

    return NextResponse.json(newAccount, { status: 201 });
  } catch (error: any) {
    if (error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
