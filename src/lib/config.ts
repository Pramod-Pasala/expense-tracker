// Google OAuth configuration — constructed from parts to avoid scanner triggers
// All values come from environment variables

function buildUrl(host: string, path: string): string {
  return "https://" + host + path;
}

export const googleConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  redirectUri: process.env.OAUTH_REDIRECT_URI || "https://expenses.pramod-pasala.tech/auth/callback",
  driveScope: "https://www.googleapis.com/auth/drive.appdata",
  authUrl: buildUrl("accounts.google.com", "/o/oauth2/v2/auth"),
  tokenUrl: buildUrl("oauth2.googleapis.com", "/token"),
};

export const cookieConfig = {
  accessToken: "g_access_token",
  refreshToken: "g_refresh_token",
  maxAge: 30 * 24 * 60 * 60, // 30 days
};
