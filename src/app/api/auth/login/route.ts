import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const forceConsent = req.nextUrl.searchParams.get("force_consent") === "true";
  const prompt = forceConsent ? "consent" : "none";
  const url = buildAuthUrl(req, prompt);
  return NextResponse.redirect(url);
}
