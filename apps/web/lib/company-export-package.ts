import { createHash } from "node:crypto";
import { Zip, ZipDeflate, ZipPassThrough } from "fflate";
import type { buildCompanyFinalExport } from "@ax-finance/domain";

type Archive = Awaited<ReturnType<typeof buildCompanyFinalExport>>;
type Attachment = Archive["attachmentMetadata"][number];
type FileEntry = { path: string; bytes: number; sha256: string };
export const exportJson = (value: unknown) => JSON.stringify(value, (_key, v) => typeof v === "bigint" ? v.toString() : v, 2);

export function publicCompanyExport(archive: Archive) {
  return { ...archive, attachmentMetadata: archive.attachmentMetadata.map(({ storageKey: _key, ...metadata }) => metadata) };
}

// Cada valor é uma célula literal: descrições não podem virar fórmulas no Excel.
export function exportCsv(rows: Record<string, unknown>[]) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const cell = (value: unknown) => {
    let text = value == null ? "" : value instanceof Date ? value.toISOString() : typeof value === "object" ? exportJson(value) : String(value);
    if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return "\uFEFF" + [columns.map(cell).join(";"), ...rows.map((row) => columns.map((column) => cell(row[column])).join(";"))].join("\r\n");
}

/**
 * ZIP incremental: mantém em memória somente um arquivo de anexo por vez.
 * O manifesto distingue arquivo ausente/bloqueado de exportação completa.
 * A leitura do armazenamento é injetada e sempre limitada ao inventário autorizado.
 */
export async function* companyExportZip(
  archive: Archive,
  readAttachment: (attachment: Attachment) => Promise<Uint8Array>,
  scanRequired: boolean,
): AsyncGenerator<Uint8Array> {
  const output: Uint8Array[] = [];
  const zip = new Zip((error, bytes) => { if (error) throw error; output.push(bytes); });
  const files: FileEntry[] = [];
  const unavailable: { id: string; name: string; reason: string }[] = [];
  const encode = (value: string) => Buffer.from(value, "utf8");
  function* add(path: string, bytes: Uint8Array, compress = true): Generator<Uint8Array> {
    const entry = compress ? new ZipDeflate(path, { level: 6 }) : new ZipPassThrough(path);
    files.push({ path, bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") });
    zip.add(entry);
    for (let offset = 0; offset < bytes.length; offset += 65536) {
      entry.push(bytes.subarray(offset, offset + 65536), false);
      while (output.length) yield output.shift()!;
    }
    entry.push(new Uint8Array(), true);
    while (output.length) yield output.shift()!;
  }
  try {
    const data = publicCompanyExport(archive);
    yield* add("dados.json", encode(exportJson(data)));
    for (const [name, rows] of Object.entries(data)) {
      if (Array.isArray(rows) && rows.length && name !== "reportSnapshots") {
        yield* add(`planilhas/${name}.csv`, encode(exportCsv(rows as Record<string, unknown>[])));
      }
    }
    for (const snapshot of archive.reportSnapshots) {
      const payload = snapshot.payload as { pdfBase64?: unknown } | null;
      if (typeof payload?.pdfBase64 === "string") {
        yield* add(`relatorios/${snapshot.id}.pdf`, Buffer.from(payload.pdfBase64, "base64"), false);
      }
    }
    for (const attachment of archive.attachmentMetadata) {
      if (attachment.scanStatus === "INFECTED" || (scanRequired && attachment.scanStatus !== "CLEAN")) {
        unavailable.push({ id: attachment.id, name: attachment.originalName, reason: "Não liberado pelo antivírus." });
        continue;
      }
      let bytes: Uint8Array;
      try {
        bytes = await readAttachment(attachment);
        if (bytes.byteLength !== attachment.sizeBytes || createHash("sha256").update(bytes).digest("hex") !== attachment.sha256) {
          unavailable.push({ id: attachment.id, name: attachment.originalName, reason: "Tamanho ou SHA-256 diverge do cadastro." });
          continue;
        }
      } catch {
        unavailable.push({ id: attachment.id, name: attachment.originalName, reason: "Arquivo indisponível no armazenamento." });
        continue;
      }
      const extension = ({ "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as Record<string, string>)[attachment.mimeType] ?? "bin";
      yield* add(`anexos/${attachment.id}.${extension}`, bytes, false);
    }
    yield* add("LEIA-ME.txt", encode(
      `Openfix — exportação da empresa ${archive.company.name}\nGerada em ${archive.exportedAt}\n\n` +
      `Situação: ${unavailable.length ? "PARCIAL — confira unavailableAttachments em manifesto.json." : "COMPLETA para os registros e anexos inventariados."}\n\n` +
      "dados.json: registros estruturados, vínculos por ID e versões dos relatórios.\n" +
      "planilhas/: CSV UTF-8, separados por ponto e vírgula; colunas Cents são centavos inteiros.\n" +
      "relatorios/: PDFs originais preservados, identificados pelo ID da versão em reportSnapshots.\n" +
      "anexos/: arquivos identificados pelo ID de attachmentMetadata, que contém o nome original.\n" +
      "manifesto.json: contagens, tamanho e SHA-256 de cada arquivo; lista explícita de anexos não incluídos.\n\n" +
      "Esta é uma exportação para consulta e portabilidade, não um backup restaurável do servidor.\n"
    ));
    yield* add("manifesto.json", encode(exportJson({
      format: "ax-finance-export-manifest", version: 1, exportedAt: archive.exportedAt,
      companyId: archive.company.id, status: unavailable.length ? "partial" : "complete",
      recordCounts: Object.fromEntries(Object.entries(data).filter(([, rows]) => Array.isArray(rows)).map(([name, rows]) => [name, (rows as unknown[]).length])),
      files: [...files], unavailableAttachments: unavailable,
    })));
    zip.end();
    while (output.length) yield output.shift()!;
  } finally {
    zip.terminate();
  }
}
