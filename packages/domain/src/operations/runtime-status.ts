import { readFile } from "node:fs/promises";

export async function readTimestampStatus(filePath: string | undefined, now = new Date()) {
  if (!filePath?.trim()) return { available: false as const, timestamp: null, ageSeconds: null };
  try {
    const firstLine = (await readFile(filePath, "utf8")).split(/\r?\n/, 1)[0]?.trim();
    const epochSeconds = Number(firstLine);
    if (!Number.isFinite(epochSeconds) || epochSeconds <= 0) {
      return { available: false as const, timestamp: null, ageSeconds: null };
    }
    const timestamp = new Date(epochSeconds * 1000);
    return {
      available: true as const,
      timestamp,
      ageSeconds: Math.max(0, Math.floor((now.getTime() - timestamp.getTime()) / 1000)),
    };
  } catch {
    return { available: false as const, timestamp: null, ageSeconds: null };
  }
}
