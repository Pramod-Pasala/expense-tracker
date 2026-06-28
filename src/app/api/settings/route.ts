import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const settings = await getSettings(req);
    return NextResponse.json(settings);
  } catch (error: any) {
    if (error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const current = await getSettings(req);
    const updated = { ...current, ...body, updated_at: new Date().toISOString() };
    await saveSettings(req, updated);
    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
