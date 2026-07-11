import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl, setAuthCookies, googleConfig } from "@/lib/auth";

/** Build an absolute redirect URL using the app's external origin from OAUTH_REDIRECT_URI. */
function appRedirect(path: string): NextResponse {
  // googleConfig.redirectUri is e.g. "https://expenses.pramod-pasala.tech/api/auth/callback"
  // Extract the origin from it so redirects always use the public domain, not 0.0.0.0:8084.
  const origin = new URL(googleConfig.redirectUri).origin;
  const url = new URL(path, origin);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  // Silent login (prompt=none) needs consent — re-redirect with prompt=consent
  if (error === "consent_required" || error === "interaction_required") {
    return NextResponse.redirect(new URL(buildAuthUrl(req, "consent")));
  }
  if (error === "access_denied") {
    return appRedirect("/?auth_error=denied");
  }
  if (error) {
    return appRedirect("/?auth_error=" + encodeURIComponent(error));
  }
  if (!code) {
    return appRedirect("/?auth_error=no_code");
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
    return appRedirect("/?auth_error=" + encodeURIComponent(msg));
  }

  const tokenData = await resp.json();
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;

  if (!accessToken) {
    return appRedirect("/?auth_error=no_access_token");
  }

  const redirect = appRedirect("/");
  setAuthCookies(redirect, accessToken, refreshToken);
  return redirect;
}
