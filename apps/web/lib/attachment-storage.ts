import { mkdir, open, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { ATTACHMENT_MAX_BYTES } from "@ax-finance/domain";

export function attachmentsRoot() {
  return path.resolve(process.env.ATTACHMENTS_DIR?.trim() || path.join(process.cwd(), ".data", "attachments"));
}

function storagePath(storageKey: string) {
  if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(storageKey)) {
    throw new Error("Chave de armazenamento inválida.");
  }
  const root = attachmentsRoot();
  const target = path.resolve(root, ...storageKey.split("/"));
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Caminho de armazenamento inválido.");
  return target;
}

export function detectAttachmentMime(buffer: Buffer): string | null {
  if (buffer.length > ATTACHMENT_MAX_BYTES || buffer.length === 0) return null;
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

export async function writeAttachmentObject(storageKey: string, buffer: Buffer) {
  const target = storagePath(storageKey);
  await mkdir(path.dirname(target), { recursive: true });
  const file = await open(target, "wx", 0o600);
  try {
    await file.writeFile(buffer);
  } finally {
    await file.close();
  }
}

export async function readAttachmentObject(storageKey: string) {
  return readFile(storagePath(storageKey));
}

export async function deleteAttachmentObject(storageKey: string) {
  await rm(storagePath(storageKey), { force: true });
}

export function safeOriginalFileName(value: string) {
  const name = path.basename(value).replace(/[\u0000-\u001f\u007f]/g, "_").trim();
  return (name || "anexo").slice(0, 255);
}
