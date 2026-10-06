import { access, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

function validatedStorageKey(storageKey: string) {
  if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(storageKey)) {
    throw new Error("Chave de armazenamento inválida.");
  }
  return storageKey;
}

export function attachmentStorageBackend(): "LOCAL" | "S3" {
  return process.env.ATTACHMENT_STORAGE_BACKEND?.trim().toLowerCase() === "s3" ? "S3" : "LOCAL";
}

function s3Config() {
  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.S3_REGION?.trim();
  if (!bucket || !region) throw new Error("S3_BUCKET e S3_REGION são obrigatórios para anexos no S3.");
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
  return {
    bucket,
    client: new S3Client({
      region,
      endpoint,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    }),
  };
}

export async function checkAttachmentStorageReady() {
  if (attachmentStorageBackend() === "S3") {
    const { bucket, client } = s3Config();
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return;
  }
  const root = attachmentsRoot();
  await mkdir(root, { recursive: true });
  await access(root, constants.R_OK | constants.W_OK);
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
  validatedStorageKey(storageKey);
  if (attachmentStorageBackend() === "S3") {
    const { bucket, client } = s3Config();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: buffer }));
    return;
  }
  const target = storagePath(storageKey);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  const file = await open(temporary, "wx", 0o600);
  try {
    await file.writeFile(buffer);
    await file.sync();
  } finally {
    await file.close();
  }
  try {
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export async function readAttachmentObject(storageKey: string, backend: "LOCAL" | "S3" = attachmentStorageBackend()) {
  validatedStorageKey(storageKey);
  if (backend === "S3") {
    const { bucket, client } = s3Config();
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
    if (!result.Body) throw new Error("Objeto do anexo não encontrado.");
    return Buffer.from(await result.Body.transformToByteArray());
  }
  return readFile(storagePath(storageKey));
}

export async function deleteAttachmentObject(storageKey: string, backend: "LOCAL" | "S3" = attachmentStorageBackend()) {
  validatedStorageKey(storageKey);
  if (backend === "S3") {
    const { bucket, client } = s3Config();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
    return;
  }
  await rm(storagePath(storageKey), { force: true });
}

export function safeOriginalFileName(value: string) {
  // eslint-disable-next-line no-control-regex -- remover/recusar caracteres de controle no nome do arquivo é o objetivo
  const name = path.basename(value).replace(/[\u0000-\u001f\u007f]/g, "_").trim();
  return (name || "anexo").slice(0, 255);
}
