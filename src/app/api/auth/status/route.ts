import { NextRequest, NextResponse } from "next/server";
import { getTokens, getCfEmail } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { access, refresh } = getTokens(req);
  const email = getCfEmail(req);

  if (access || refresh) {
    return NextResponse.json({ authenticated: true, email, needs_consent: false });
  }
  if (email) {
    return NextResponse.json({ authenticated: false, email, needs_consent: true });
  }
  return NextResponse.json({ authenticated: false, email: null, needs_consent: false });
}
