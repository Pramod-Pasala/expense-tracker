import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl, setAuthCookies, googleConfig } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  // Silent login needs consent — re-redirect with prompt=consent
  if (error === "consent_required" || error === "interaction_required") {
    return NextResponse.redirect(buildAuthUrl(req, "consent"));
  }
  if (error === "access_denied") {
    return NextResponse.redirect("/?auth_error=denied");
  }
  if (error) {
    return NextResponse.redirect("/?auth_error=" + encodeURIComponent(error));
  }
  if (!code) {
    return NextResponse.redirect("/?auth_error=no_code");
  }

  // Exchange code for tokens
  const body = new URLSearchParams({
    client_id: googleConfig.clientId,
    client_secret: googleConfig.clientSecret,
    code,
    redirect_uri: googleConfig.redirectUri,
    grant_type: "authorization_code",
  });

  const resp = await fetch(googleConfig.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    const errorDetail = await resp.json().catch(() => ({}));
    const msg = errorDetail.error || "token_exchange_failed";
    return NextResponse.redirect("/?auth_error=" + encodeURIComponent(msg));
  }

  const tokenData = await resp.json();
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;

  if (!accessToken) {
    return NextResponse.redirect("/?auth_error=no_access_token");
  }

  const redirect = NextResponse.redirect("/", 303);
  setAuthCookies(redirect, accessToken, refreshToken);
  return redirect;
}
