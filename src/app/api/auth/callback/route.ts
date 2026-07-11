import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl, setAuthCookies, googleConfig } from "@//lib/auth";

/** Build an absolute redirect URL from a path, using the request's origin. */
function absoluteRedirect(req: NextRequest, path: string): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = path.split("?")[0];
  url.search = "";
  // Re-append query string if present
  const qIndex = path.indexOf("?");
  if (qIndex >= 0) {
    url.search = path.slice(qIndex);
  }
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
    return absoluteRedirect(req, "/?auth_error=denied");
  }
  if (error) {
    return absoluteRedirect(req, "/?auth_error=" + encodeURIComponent(error));
  }
  if (!code) {
    return absoluteRedirect(req, "/?auth_error=no_code");
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
    return absoluteRedirect(req, "/?auth_error=" + encodeURIComponent(msg));
  }

  const tokenData = await resp.json();
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;

  if (!accessToken) {
    return absoluteRedirect(req, "/?auth_error=no_access_token");
  }

  // Build absolute URL for success redirect
  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = "/";
  redirectUrl.search = "";
  const redirect = NextResponse.redirect(redirectUrl, 303);
  setAuthCookies(redirect, accessToken, refreshToken);
  return redirect;
}
