import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { MAX_IMPORT_FILE_BYTES, type ImportFileFormatValue } from "./bank-statement-parser";

const STORAGE_KEY = /^[a-f0-9-]{36}\/[a-f0-9-]{36}\/source\.(csv|ofx)$/;

export function importsRoot() {
  return path.resolve(process.env.IMPORTS_DIR?.trim() || path.join(process.cwd(), ".data", "imports"));
}

function importPath(storageKey: string) {
  if (!STORAGE_KEY.test(storageKey)) throw new Error("Chave de importação inválida.");
  const root = importsRoot();
  const target = path.resolve(root, ...storageKey.split("/"));
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Caminho de importação inválido.");
  return target;
}

export function importStorageKey(companyId: string, batchId: string, format: ImportFileFormatValue) {
  return `${companyId}/${batchId}/source.${format.toLowerCase()}`;
}

export async function writeImportSource(storageKey: string, bytes: Buffer) {
  if (bytes.length === 0 || bytes.length > MAX_IMPORT_FILE_BYTES) throw new Error("Arquivo fora do limite permitido.");
  const target = importPath(storageKey);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  const file = await open(temporary, "wx", 0o600);
  try {
    await file.writeFile(bytes);
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

export async function readImportSource(storageKey: string) {
  return readFile(importPath(storageKey));
}

export async function deleteImportSource(storageKey: string) {
  const target = importPath(storageKey);
  await rm(path.dirname(target), { recursive: true, force: true });
}

export function decodeImportSource(bytes: Buffer) {
  const asciiHeader = bytes.subarray(0, Math.min(bytes.length, 512)).toString("ascii");
  const windows1252 = /ENCODING\s*[:>]\s*(1252|USASCII)|CHARSET\s*[:>]\s*1252/i.test(asciiHeader);
  if (windows1252) return new TextDecoder("windows-1252").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function safeImportFileName(value: string) {
  // eslint-disable-next-line no-control-regex -- remover/recusar caracteres de controle no nome do arquivo é o objetivo
  const name = path.basename(value).replace(/[\u0000-\u001f\u007f]/g, "_").trim();
  return (name || "extrato").slice(0, 255);
}
