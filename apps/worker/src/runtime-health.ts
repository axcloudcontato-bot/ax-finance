import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeWorkerHeartbeat(workerId: string, now = new Date()) {
  const target = process.env.WORKER_HEALTH_FILE?.trim();
  if (!target) return;
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${Math.floor(now.getTime() / 1000)}\n${workerId}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporary, target);
}
