import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth";

export async function POST(_req: NextRequest) {
  const resp = NextResponse.json({ ok: true });
  clearAuthCookies(resp);
  return resp;
}
