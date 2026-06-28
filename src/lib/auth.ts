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

export async function getAccessToken(req: NextRequest): Promise<string | null> {
  const { access, refresh } = getTokens(req);
  if (access) return access;
  if (refresh) {
    try {
      const refreshed = await refreshAccessToken(refresh);
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
 * @returns An authenticated `drive_v3.Drive` instance.
 * @throws  {Error} "Not authenticated" if no valid access token is found.
 */
export async function getDriveClient() {
  const cookieStore = await cookies();
  const access = cookieStore.get(cookieConfig.accessToken)?.value || null;

  let token = access;
  if (!token) {
    // Try a refresh if we have a refresh token but no (or expired) access token.
    const refresh = cookieStore.get(cookieConfig.refreshToken)?.value || null;
    if (refresh) {
      try {
        const refreshed = await refreshAccessToken(refresh);
        token = refreshed.access_token;
      } catch {
        token = null;
      }
    }
  }

  if (!token) {
    throw new Error("Not authenticated");
  }
  return createDriveClient(token);
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
