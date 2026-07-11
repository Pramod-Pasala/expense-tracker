import { NextRequest, NextResponse } from "next/server";
import { getTokens, getCfEmail, isTokenExpired } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { access, refresh } = getTokens(req);
  const email = getCfEmail(req);

  // Only consider "authenticated" if we have a valid (non-expired) access token
  // OR a refresh token that can be used to get a new one.
  if (access || refresh) {
    // If access token exists but is expired, we still have a refresh token —
    // the API routes will auto-refresh. But if BOTH are missing/invalid,
    // the user needs to re-consent.
    if (access && !isTokenExpired(access)) {
      return NextResponse.json({ authenticated: true, email, needs_consent: false });
    }
    // Access token expired but we have a refresh token — still "authenticated"
    // because API routes will refresh automatically. But if refresh also fails
    // (invalid_grant), the API will return 401 and the frontend should handle it.
    if (refresh) {
      return NextResponse.json({ authenticated: true, email, needs_consent: false });
    }
  }
  if (email) {
    return NextResponse.json({ authenticated: false, email, needs_consent: true });
  }
  return NextResponse.json({ authenticated: false, email: null, needs_consent: false });
}
