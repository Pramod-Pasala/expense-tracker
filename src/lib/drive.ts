/**
 * Google Drive appDataFolder storage layer.
 *
 * All application data is stored in the user's Google Drive `appDataFolder`
 * — a hidden, app-specific space that is not visible to the user in their
 * normal Drive UI. Nothing is persisted on the server filesystem; every
 * read/write round-trips through the Drive REST API.
 *
 * The Drive client is authenticated with a Google OAuth access token that
 * must be obtained elsewhere (e.g. an auth/NextAuth layer). This module
 * only consumes the token — it does not perform the OAuth flow itself.
 */

import { google } from "googleapis";
import type { drive_v3 } from "googleapis";

/** A configured, authenticated Google Drive (v3) client. */
export type DriveClient = drive_v3.Drive;

/** Metadata for the single appDataFolder file that holds our JSON blob. */
interface AppDataFileMeta {
  id: string;
  name: string;
}

/**
 * Create an authenticated Drive client from a Google OAuth access token.
 *
 * @param accessToken - A valid Google OAuth2 access token with the
 *   `https://www.googleapis.com/auth/drive.appdata` scope.
 * @returns A `drive_v3.Drive` instance whose requests are authorized with
 *   the supplied token.
 */
export function createDriveClient(accessToken: string): DriveClient {
  if (!accessToken) {
    throw new Error("createDriveClient: an OAuth access token is required");
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  return google.drive({
    version: "v3",
    auth,
  });
}

/**
 * Find a single file by name inside appDataFolder.
 *
 * @param drive   - The authenticated Drive client.
 * @param name    - Exact file name to look for.
 * @returns       - The file's `{id, name}` metadata, or `null` if no such
 *                  file exists in appDataFolder.
 */
async function findFile(
  drive: DriveClient,
  name: string,
): Promise<AppDataFileMeta | null> {
  // Escape single quotes in the filename per the Drive query-syntax rules.
  const escapedName = name.replace(/'/g, "\\'");

  const res = await drive.files.list({
    q: `name='${escapedName}'`,
    spaces: "appDataFolder",
    fields: "files(id, name)",
    pageSize: 1,
  });

  const files = res.data.files ?? [];
  const first = files[0];
  if (first && first.id) {
    return { id: first.id, name: first.name ?? name };
  }
  return null;
}

/**
 * Read and parse a JSON file from appDataFolder.
 *
 * @param drive     - The authenticated Drive client.
 * @param fileName  - Name of the JSON file to read.
 * @returns         - The parsed contents, or `null` if the file does not
 *                    exist yet (e.g. first run).
 *
 * Any non-404 error (auth failure, network error, malformed JSON) is thrown.
 */
export async function readFile<T>(
  drive: DriveClient,
  fileName: string,
): Promise<T | null> {
  try {
    const meta = await findFile(drive, fileName);
    if (!meta) {
      return null;
    }

    const res = await drive.files.get({
      fileId: meta.id,
      alt: "media",
    });

    // `alt: 'media'` returns the raw file content. Depending on the
    // googleapis build, `data` can be a string, a parsed object, or a
    // Buffer — normalize all of them to a JSON-parsed object.
    const raw: unknown = res.data;
    let parsed: T;

    if (typeof raw === "string") {
      parsed = JSON.parse(raw) as T;
    } else if (Buffer.isBuffer(raw)) {
      parsed = JSON.parse(raw.toString("utf8")) as T;
    } else if (raw && typeof raw === "object") {
      parsed = raw as T;
    } else {
      parsed = JSON.parse(String(raw ?? "null")) as T;
    }

    return parsed;
  } catch (err) {
    if (isNotFound(err)) {
      // Race: file was deleted between findFile() and get(). Treat as absent.
      return null;
    }
    throw enrichError(err, `readFile('${fileName}')`);
  }
}

/**
 * Create or update a JSON file in appDataFolder.
 *
 * If a file with the given name already exists, its contents are overwritten
 * in place (by fileId) so the name remains unique within appDataFolder. If
 * no such file exists, a new one is created with `appDataFolder` as its
 * parent.
 *
 * @param drive     - The authenticated Drive client.
 * @param fileName  - Name of the JSON file to write.
 * @param data      - Arbitrary JSON-serializable data.
 */
export async function writeFile<T>(
  drive: DriveClient,
  fileName: string,
  data: T,
): Promise<void> {
  try {
    const body = JSON.stringify(data, null, 2);
    const existing = await findFile(drive, fileName);

    if (existing) {
      // Update in place — supply the fileId so Drive replaces the content.
      await drive.files.update({
        fileId: existing.id,
        requestBody: { name: fileName },
        media: {
          mimeType: "application/json",
          body,
        },
      });
    } else {
      // Create a brand-new file inside appDataFolder.
      await drive.files.create({
        fields: "id, name",
        requestBody: {
          name: fileName,
          parents: ["appDataFolder"],
        },
        media: {
          mimeType: "application/json",
          body,
        },
      });
    }
  } catch (err) {
    throw enrichError(err, `writeFile('${fileName}')`);
  }
}

/**
 * List the names of every file currently stored in appDataFolder.
 *
 * @param drive - The authenticated Drive client.
 * @returns     - An array of file names (may be empty). Names are returned
 *                in the order Drive reports them.
 */
export async function listFiles(drive: DriveClient): Promise<string[]> {
  try {
    const names: string[] = [];
    let pageToken: string | undefined;

    do {
      const res = await drive.files.list({
        spaces: "appDataFolder",
        fields: "nextPageToken, files(id, name)",
        pageSize: 100,
        pageToken,
      });

      const files = res.data.files ?? [];
      for (const f of files) {
        if (f.name) names.push(f.name);
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return names;
  } catch (err) {
    throw enrichError(err, "listFiles()");
  }
}

/**
 * Permanently delete a file from appDataFolder by name.
 *
 * If the file does not exist, this is a no-op (no error is thrown) so that
 * callers can treat delete as idempotent.
 *
 * @param drive     - The authenticated Drive client.
 * @param fileName  - Name of the file to delete.
 */
export async function deleteFile(
  drive: DriveClient,
  fileName: string,
): Promise<void> {
  try {
    const meta = await findFile(drive, fileName);
    if (!meta) {
      return; // nothing to delete — treat as success
    }
    await drive.files.delete({ fileId: meta.id });
  } catch (err) {
    if (isNotFound(err)) {
      // Race: deleted between findFile() and delete(). Already gone — fine.
      return;
    }
    throw enrichError(err, `deleteFile('${fileName}')`);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if a googleapis error represents an HTTP 404 (file not found).
 * The googleapis error shape varies across versions, so check defensively.
 */
function isNotFound(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    code?: number;
    status?: number;
    response?: { status?: number };
  };
  return e.code === 404 || e.status === 404 || e.response?.status === 404;
}

/**
 * Wrap an opaque googleapis error with a human-readable prefix while
 * preserving the original error object (and its `code`/stack) as the cause.
 */
function enrichError(err: unknown, context: string): Error {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : JSON.stringify(err);
  const wrapped = new Error(`[drive] ${context} failed: ${message}`);
  if (err instanceof Error) {
    (wrapped as Error & { cause?: unknown }).cause = err;
  }
  return wrapped;
}
