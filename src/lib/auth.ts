import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createDriveClient, readFile, writeFile } from "./drive";
import { defaultSettings, validateSettings } from "./schema";
import type { Settings } from "./types";
import { googleConfig, cookieConfig } from "./config";

// ════════════════════════════════════════════════════════════════
//  CF Access email extraction
// ════════════════════════════════════════════════════════════════

export function getCfEmail(req: NextRequest): string | null {
  const jwt = req.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64").toString()
    );
    return payload.email || null;
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
//  Token management
// ════════════════════════════════════════════════════════════════

export function getTokens(req: NextRequest): { access: string | null; refresh: string | null } {
  const access = req.cookies.get(cookieConfig.accessToken)?.value || null;
  const refresh = req.cookies.get(cookieConfig.refreshToken)?.value || null;
  return { access, refresh };
}

/**
 * Check whether a Google OAuth access token (JWT) is expired or about to expire.
 * Google access tokens are JWTs with an `exp` claim (Unix seconds).
 * We add a 30-second buffer to avoid edge-case races.
 */
export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return true;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString()
    );
    if (!payload.exp) return true;
    // exp is in seconds; Date.now() is in milliseconds
    return payload.exp * 1000 <= Date.now() + 30_000;
  } catch {
    return true; // If we can't decode it, treat as expired
  }
}

/**
 * Get a valid (non-expired) access token, refreshing from the refresh token
 * if the current access token has expired. Also updates the cookie so
 * subsequent requests don't need to refresh again.
 */
export async function getAccessToken(req: NextRequest): Promise<string | null> {
  const { access, refresh } = getTokens(req);

  // Access token still valid — use it directly
  if (access && !isTokenExpired(access)) {
    return access;
  }

  // Access token missing or expired — try refreshing
  if (refresh) {
    try {
      const refreshed = await refreshAccessToken(refresh);
      // Update the cookie so subsequent requests use the fresh token
      try {
        const cookieStore = await cookies();
        cookieStore.set(cookieConfig.accessToken, refreshed.access_token, {
          maxAge: cookieConfig.maxAge,
          httpOnly: true,
          secure: googleConfig.redirectUri.startsWith("https://"),
          sameSite: "lax",
          path: "/",
        });
      } catch {
        // cookieStore.set() only works in a route handler / server action.
        // If we're in a context where it doesn't, just return the token
        // without updating the cookie — the next request will refresh again.
      }
      return refreshed.access_token;
    } catch {
      return null;
    }
  }

  return null;
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    client_id: googleConfig.clientId,
    client_secret: googleConfig.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const resp = await fetch(googleConfig.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    throw new Error("Token refresh failed: " + resp.status);
  }
  return resp.json();
}

// ════════════════════════════════════════════════════════════════
//  Auth URL builder
// ════════════════════════════════════════════════════════════════

export function buildAuthUrl(req: NextRequest, prompt: string): string {
  const email = getCfEmail(req);
  const params = new URLSearchParams({
    client_id: googleConfig.clientId,
    redirect_uri: googleConfig.redirectUri,
    response_type: "code",
    scope: googleConfig.driveScope,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt,
  });
  if (email) {
    params.set("login_hint", email);
  }
  return googleConfig.authUrl + "?" + params.toString();
}

// ════════════════════════════════════════════════════════════════
//  Auth status check for API routes
// ════════════════════════════════════════════════════════════════

export async function requireAuth(req: NextRequest): Promise<string> {
  const token = await getAccessToken(req);
  if (!token) {
    throw new Error("Not authenticated");
  }
  return token;
}

// ════════════════════════════════════════════════════════════════
//  Cookie helpers
// ════════════════════════════════════════════════════════════════

export function setAuthCookies(response: NextResponse, accessToken: string, refreshToken?: string | null) {
  const secure = googleConfig.redirectUri.startsWith("https://");
  response.cookies.set(cookieConfig.accessToken, accessToken, {
    maxAge: cookieConfig.maxAge,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  });
  if (refreshToken) {
    response.cookies.set(cookieConfig.refreshToken, refreshToken, {
      maxAge: cookieConfig.maxAge,
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
    });
  }
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.delete(cookieConfig.accessToken);
  response.cookies.delete(cookieConfig.refreshToken);
}

// ════════════════════════════════════════════════════════════════
//  Drive client & settings helpers (used by API route handlers)
// ════════════════════════════════════════════════════════════════

/**
 * Build an authenticated Google Drive client from the access token stored in
 * the request cookies. Uses Next.js 16's async `cookies()` API so it can be
 * called from route handlers without explicitly passing the request.
 *
 * If the access token has expired, automatically refreshes it using the
 * stored refresh token and updates the cookie.
 *
 * @returns An authenticated `drive_v3.Drive` instance.
 * @throws  {Error} "Not authenticated" if no valid access token is found.
 */
export async function getDriveClient() {
  const cookieStore = await cookies();
  const access = cookieStore.get(cookieConfig.accessToken)?.value || null;
  const refresh = cookieStore.get(cookieConfig.refreshToken)?.value || null;

  // Access token still valid — use it directly
  if (access && !isTokenExpired(access)) {
    return createDriveClient(access);
  }

  // Access token missing or expired — try refreshing
  if (refresh) {
    try {
      const refreshed = await refreshAccessToken(refresh);
      cookieStore.set(cookieConfig.accessToken, refreshed.access_token, {
        maxAge: cookieConfig.maxAge,
        httpOnly: true,
        secure: googleConfig.redirectUri.startsWith("https://"),
        sameSite: "lax",
        path: "/",
      });
      return createDriveClient(refreshed.access_token);
    } catch {
      // Fall through to "Not authenticated"
    }
  }

  throw new Error("Not authenticated");
}

/**
 * Load and validate the user's settings from Drive. Returns sensible defaults
 * if no settings file exists yet (first run).
 */
export async function getSettings(): Promise<Settings> {
  const drive = await getDriveClient();
  const raw = await readFile<unknown>(drive, "settings.json");
  if (!raw) {
    return defaultSettings();
  }
  return validateSettings(raw);
}

/**
 * Persist settings to Drive.
 */
export async function saveSettings(settings: Settings): Promise<void> {
  const drive = await getDriveClient();
  await writeFile(drive, "settings.json", settings);
}

export { googleConfig, cookieConfig };
