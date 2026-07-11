import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/session";
import { getErrorMessage, isDriveAuthError} from "@/lib/format";

export async function GET(req: NextRequest) {
  try {
    const settings = await getSettings(req);
    return NextResponse.json(settings);
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

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const current = await getSettings(req);
    const updated = { ...current, ...body, updated_at: new Date().toISOString() };
    await saveSettings(req, updated);
    return NextResponse.json(updated);
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
