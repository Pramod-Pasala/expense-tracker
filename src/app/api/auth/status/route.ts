import { NextRequest, NextResponse } from "next/server";
import { getTokens, getCfEmail } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { access, refresh } = getTokens(req);
  const email = getCfEmail(req);

  // If we have an access token or a refresh token, consider the user
  // authenticated. The API routes will refresh the access token if needed.
  // If the refresh token itself is invalid (invalid_grant), the API will
  // return 401 and the frontend will redirect to re-consent.
  if (access || refresh) {
    return NextResponse.json({ authenticated: true, email, needs_consent: false });
  }
  if (email) {
    return NextResponse.json({ authenticated: false, email, needs_consent: true });
  }
  return NextResponse.json({ authenticated: false, email: null, needs_consent: false });
}
