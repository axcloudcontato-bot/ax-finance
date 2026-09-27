import { createHash } from "node:crypto";
import Papa from "papaparse";
import { z } from "zod";
import { ImportFileInvalidError, ImportFileTooManyRowsError } from "../errors";

export const MAX_IMPORT_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 100_000;
export const BACKGROUND_IMPORT_BYTES = 512 * 1024;
export const BACKGROUND_IMPORT_ROWS = 2_000;
const ZERO = BigInt(0);
const HUNDRED = BigInt(100);

const optionalColumn = z.string().trim().min(1).max(200).optional();

export const csvColumnMappingSchema = z.object({
  dateColumn: z.string().trim().min(1).max(200),
  descriptionColumn: z.string().trim().min(1).max(200),
  amountColumn: optionalColumn,
  debitColumn: optionalColumn,
  creditColumn: optionalColumn,
}).superRefine((mapping, context) => {
  if (!mapping.amountColumn && !mapping.debitColumn && !mapping.creditColumn) {
    context.addIssue({ code: "custom", message: "Mapeie a coluna de valor ou as colunas de débito/crédito." });
  }
  if (mapping.dateColumn === mapping.descriptionColumn) {
    context.addIssue({ code: "custom", message: "Data e descrição precisam usar colunas diferentes." });
  }
});

export type CsvColumnMapping = z.infer<typeof csvColumnMappingSchema>;
export type ImportFileFormatValue = "CSV" | "OFX";

export interface ParsedStatementRow {
  lineDate: string;
  description: string;
  amountCents: bigint;
  dedupKey: string;
  externalId?: string;
}

export interface InvalidRow {
  rowNumber: number;
  reason: string;
}

export interface ParsedStatement {
  format: ImportFileFormatValue;
  rows: ParsedStatementRow[];
  invalidRows: InvalidRow[];
  totalRows: number;
}

export interface BankStatementPreview {
  format: ImportFileFormatValue;
  headers: string[];
  suggestedMapping?: Partial<CsvColumnMapping>;
  rawRows: Array<Record<string, string>>;
  normalizedRows: Array<Omit<ParsedStatementRow, "dedupKey">>;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  invalidRows: InvalidRow[];
}

const HEADER_SYNONYMS = {
  dateColumn: ["data", "date", "dt", "quando", "data lancamento", "data movimento", "transaction date", "posted date"],
  descriptionColumn: ["descricao", "historico", "lancamento", "memo", "name", "payee", "description"],
  amountColumn: ["valor", "amount", "valor lancamento", "transaction amount", "trnamt"],
  debitColumn: ["debito", "saida", "withdrawal", "debit", "valor debito"],
  creditColumn: ["credito", "entrada", "deposit", "credit", "valor credito"],
} as const;

function normalizedHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function suggestColumn(headers: string[], synonyms: readonly string[]) {
  const exact = headers.find((header) => synonyms.includes(normalizedHeader(header)));
  if (exact) return exact;
  return headers.find((header) => synonyms.some((synonym) => normalizedHeader(header).includes(synonym)));
}

export function suggestCsvMapping(headers: string[]): Partial<CsvColumnMapping> {
  return {
    dateColumn: suggestColumn(headers, HEADER_SYNONYMS.dateColumn),
    descriptionColumn: suggestColumn(headers, HEADER_SYNONYMS.descriptionColumn),
    amountColumn: suggestColumn(headers, HEADER_SYNONYMS.amountColumn),
    debitColumn: suggestColumn(headers, HEADER_SYNONYMS.debitColumn),
    creditColumn: suggestColumn(headers, HEADER_SYNONYMS.creditColumn),
  };
}

function isValidDateOnly(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseLineDate(raw: string): string | null {
  const trimmed = raw.trim();
  let result: string | null = null;
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) result = `${match[1]}-${match[2]}-${match[3]}`;
  match = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(trimmed);
  if (match) result = `${match[3]}-${match[2]}-${match[1]}`;
  return result && isValidDateOnly(result) ? result : null;
}

export function parseAmountCents(raw: string): bigint | null {
  let value = raw.trim().replace(/\s/g, "");
  if (!value) return null;
  let negative = false;
  if (value.startsWith("(") && value.endsWith(")")) {
    negative = true;
    value = value.slice(1, -1);
  }
  value = value.replace(/R\$/gi, "").replace(/[^0-9,\.\-+]/g, "");
  if (value.startsWith("-")) negative = !negative;
  value = value.replace(/^[+-]/, "");
  if (!value || /[+-]/.test(value)) return null;

  const comma = value.lastIndexOf(",");
  const dot = value.lastIndexOf(".");
  let normalized: string;
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot
      ? value.replace(/\./g, "").replace(",", ".")
      : value.replace(/,/g, "");
  } else if (comma >= 0) {
    normalized = /^\d{1,3}(?:,\d{3})+$/.test(value)
      ? value.replace(/,/g, "")
      : value.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(value)) {
    normalized = value.replace(/\./g, "");
  } else {
    normalized = value;
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, decimal = ""] = normalized.split(".");
  const cents = BigInt(whole!) * HUNDRED + BigInt(decimal.padEnd(2, "0"));
  return negative ? -cents : cents;
}

function normalizeDescription(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

function makeDedupKey(
  format: ImportFileFormatValue,
  row: Omit<ParsedStatementRow, "dedupKey">,
  occurrence: number
) {
  if (format === "OFX" && row.externalId) return `ofx:${row.externalId.slice(0, 190)}`;
  const base = `${row.lineDate}|${row.amountCents}|${normalizeDescription(row.description).toLowerCase()}`;
  if (format === "CSV") return occurrence === 1 ? base : `${base}|#${occurrence}`;
  return `ofx:${createHash("sha256").update(`${base}|${occurrence}`).digest("hex")}`;
}

function addDedupKeys(format: ImportFileFormatValue, rows: Array<Omit<ParsedStatementRow, "dedupKey">>) {
  const occurrences = new Map<string, number>();
  return rows.map((row) => {
    const base = row.externalId || `${row.lineDate}|${row.amountCents}|${normalizeDescription(row.description).toLowerCase()}`;
    const occurrence = (occurrences.get(base) || 0) + 1;
    occurrences.set(base, occurrence);
    return { ...row, dedupKey: makeDedupKey(format, row, occurrence) };
  });
}

function csvRecords(content: string) {
  const parsed = Papa.parse<Record<string, unknown>>(content.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });
  const headers = parsed.meta.fields?.filter(Boolean) || [];
  const records = parsed.data.slice(0, MAX_IMPORT_ROWS + 1).map((record) => Object.fromEntries(
    headers.map((header) => [header, String(record[header] ?? "")])
  ));
  return { headers, records, truncated: parsed.data.length > MAX_IMPORT_ROWS };
}

function parseCsv(content: string, mappingInput: unknown): ParsedStatement {
  const mapping = csvColumnMappingSchema.parse(mappingInput);
  const { headers, records, truncated } = csvRecords(content);
  const mappedColumns = [mapping.dateColumn, mapping.descriptionColumn, mapping.amountColumn, mapping.debitColumn, mapping.creditColumn]
    .filter((column): column is string => Boolean(column));
  if (truncated) throw new ImportFileTooManyRowsError();
  if (mappedColumns.some((column) => !headers.includes(column))) throw new ImportFileInvalidError();

  const valid: Array<Omit<ParsedStatementRow, "dedupKey">> = [];
  const invalidRows: InvalidRow[] = [];
  records.forEach((record, index) => {
    const rowNumber = index + 2;
    const lineDate = parseLineDate(record[mapping.dateColumn] || "");
    if (!lineDate) {
      invalidRows.push({ rowNumber, reason: "Data inválida ou em branco." });
      return;
    }
    const description = normalizeDescription(record[mapping.descriptionColumn] || "").slice(0, 500);
    if (!description) {
      invalidRows.push({ rowNumber, reason: "Descrição em branco." });
      return;
    }
    let amountCents: bigint | null = null;
    if (mapping.amountColumn) {
      amountCents = parseAmountCents(record[mapping.amountColumn] || "");
    } else {
      const debit = mapping.debitColumn ? parseAmountCents(record[mapping.debitColumn] || "") : null;
      const credit = mapping.creditColumn ? parseAmountCents(record[mapping.creditColumn] || "") : null;
      if (debit !== null || credit !== null) amountCents = (credit === null ? ZERO : credit < ZERO ? -credit : credit)
        - (debit === null ? ZERO : debit < ZERO ? -debit : debit);
    }
    if (amountCents === null || amountCents === ZERO) {
      invalidRows.push({ rowNumber, reason: "Valor inválido, em branco ou igual a zero." });
      return;
    }
    valid.push({ lineDate, description, amountCents });
  });
  return { format: "CSV", rows: addDedupKeys("CSV", valid), invalidRows, totalRows: records.length };
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function ofxTag(block: string, tag: string) {
  const closed = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block)?.[1];
  const value = closed ?? new RegExp(`<${tag}[^>]*>\\s*([^<\\r\\n]+)`, "i").exec(block)?.[1];
  return value ? decodeXmlEntities(value.trim()) : "";
}

function parseOfx(content: string): ParsedStatement {
  const blocks = [...content.matchAll(/<STMTTRN(?:\s[^>]*)?>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN(?:\s|>))|(?=<\/BANKTRANLIST>))/gi)]
    .slice(0, MAX_IMPORT_ROWS + 1);
  if (blocks.length > MAX_IMPORT_ROWS) throw new ImportFileTooManyRowsError();
  if (blocks.length === 0) throw new ImportFileInvalidError();
  const valid: Array<Omit<ParsedStatementRow, "dedupKey">> = [];
  const invalidRows: InvalidRow[] = [];
  blocks.forEach((match, index) => {
    const block = match[1] || "";
    const dateRaw = ofxTag(block, "DTPOSTED").slice(0, 8);
    const lineDate = /^(\d{4})(\d{2})(\d{2})$/.test(dateRaw)
      ? `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
      : null;
    const amountCents = parseAmountCents(ofxTag(block, "TRNAMT"));
    const name = ofxTag(block, "NAME");
    const memo = ofxTag(block, "MEMO");
    const transactionType = ofxTag(block, "TRNTYPE");
    const description = normalizeDescription(
      [name, memo].filter((item, position, list) => item && list.indexOf(item) === position).join(" — ")
      || transactionType
      || "Lançamento bancário"
    ).slice(0, 500);
    if (!lineDate || !isValidDateOnly(lineDate) || amountCents === null || amountCents === ZERO || !description) {
      invalidRows.push({ rowNumber: index + 1, reason: "Transação OFX sem data, valor ou descrição válidos." });
      return;
    }
    valid.push({ lineDate, amountCents, description, externalId: ofxTag(block, "FITID") || undefined });
  });
  return { format: "OFX", rows: addDedupKeys("OFX", valid), invalidRows, totalRows: blocks.length };
}

export function detectBankStatementFormat(fileName: string, content: string): ImportFileFormatValue {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".ofx") || /<(OFX|STMTTRN)>/i.test(content)) return "OFX";
  if (lowerName.endsWith(".csv")) return "CSV";
  throw new ImportFileInvalidError();
}

export function parseBankStatementContent(
  format: ImportFileFormatValue,
  content: string,
  mapping?: unknown
): ParsedStatement {
  const parsed = format === "OFX" ? parseOfx(content) : parseCsv(content, mapping);
  if (parsed.rows.length === 0) throw new ImportFileInvalidError();
  return parsed;
}

export function previewBankStatement(fileName: string, content: string): BankStatementPreview {
  const format = detectBankStatementFormat(fileName, content);
  if (format === "OFX") {
    const parsed = parseOfx(content);
    if (parsed.rows.length === 0) throw new ImportFileInvalidError();
    return {
      format,
      headers: [],
      rawRows: [],
      normalizedRows: parsed.rows.slice(0, 10).map(({ dedupKey: _dedupKey, ...row }) => row),
      totalRows: parsed.totalRows,
      validCount: parsed.rows.length,
      invalidCount: parsed.invalidRows.length,
      invalidRows: parsed.invalidRows.slice(0, 20),
    };
  }

  const { headers, records, truncated } = csvRecords(content);
  if (truncated) throw new ImportFileTooManyRowsError();
  if (headers.length === 0 || records.length === 0) throw new ImportFileInvalidError();
  const suggestedMapping = suggestCsvMapping(headers);
  let parsed: ParsedStatement | null = null;
  if (suggestedMapping.dateColumn && suggestedMapping.descriptionColumn
    && (suggestedMapping.amountColumn || suggestedMapping.debitColumn || suggestedMapping.creditColumn)) {
    parsed = parseCsv(content, suggestedMapping);
  }
  return {
    format,
    headers,
    suggestedMapping,
    rawRows: records.slice(0, 10),
    normalizedRows: parsed?.rows.slice(0, 10).map(({ dedupKey: _dedupKey, ...row }) => row) || [],
    totalRows: records.length,
    validCount: parsed?.rows.length || 0,
    invalidCount: parsed?.invalidRows.length || 0,
    invalidRows: parsed?.invalidRows.slice(0, 20) || [],
  };
}
