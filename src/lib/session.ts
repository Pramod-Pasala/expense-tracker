import { NextRequest } from "next/server";
import { requireAuth } from "./auth";
import { createDriveClient, readFile, writeFile } from "./drive";
import type { Settings } from "./schema";
import { defaultSettings, validateSettings } from "./schema";

export async function getDriveClient(req: NextRequest) {
  const accessToken = await requireAuth(req);
  return createDriveClient(accessToken);
}

export async function getSettings(req: NextRequest): Promise<Settings> {
  const drive = await getDriveClient(req);
  const raw = await readFile<unknown>(drive, "settings.json");
  if (!raw) {
    const settings = defaultSettings();
    await writeFile(drive, "settings.json", settings);
    return settings;
  }
  return validateSettings(raw);
}

export async function saveSettings(req: NextRequest, settings: Settings): Promise<void> {
  const drive = await getDriveClient(req);
  const data = { ...settings, updated_at: new Date().toISOString() };
  await writeFile(drive, "settings.json", data);
}
