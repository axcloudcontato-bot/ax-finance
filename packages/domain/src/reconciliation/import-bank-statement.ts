import Papa from "papaparse";
import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { FinancialAccountNotFoundError, ImportFileInvalidError } from "../errors";

export const importBankStatementInput = z.object({
  financialAccountId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255),
  csvContent: z.string().min(1),
});

export type ImportBankStatementInput = z.infer<typeof importBankStatementInput>;

interface ParsedRow {
  lineDate: string;
  description: string;
  amountCents: bigint;
  dedupKey: string;
}

export interface InvalidRow {
  rowNumber: number;
  reason: string;
}

const DATE_BR = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Só formatos não ambíguos (Seção 12: "datas ambíguas exigem escolha" — outros formatos viram linha inválida, não um chute). */
function parseLineDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (DATE_ISO.test(trimmed)) return trimmed;
  const br = DATE_BR.exec(trimmed);
  if (br) {
    const [, dd, mm, yyyy] = br;
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

/** Aceita "1.234,56" (pt-BR) ou "1234.56" — em branco NUNCA vira zero (Seção 12). */
function parseAmountCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

function normalizeDescription(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Importa um extrato CSV (cabeçalho fixo `data,descricao,valor`) pra uma
 * conta. Valor negativo = saída, positivo = entrada. Cada linha válida
 * ganha uma dedupKey determinística (data|valor|descrição normalizada);
 * reimportar o mesmo arquivo não duplica — a linha já existente é contada
 * como duplicata e pulada (Seção 12: "importar novamente o mesmo arquivo
 * não altera saldo").
 */
export async function importBankStatement(userId: string, companyId: string, input: unknown) {
  const data = importBankStatementInput.parse(input);
  await assertActiveMembership(userId, companyId);

  const parsed = Papa.parse<Record<string, string>>(data.csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  const validRows: ParsedRow[] = [];
  const invalidRows: InvalidRow[] = [];

  parsed.data.forEach((row, index) => {
    const rowNumber = index + 2; // +1 cabeçalho, +1 pra ficar 1-based
    const lineDate = parseLineDate(row.data ?? "");
    if (!lineDate) {
      invalidRows.push({ rowNumber, reason: "Data inválida ou em branco (use DD/MM/AAAA ou AAAA-MM-DD)." });
      return;
    }

    const amountCents = parseAmountCents(row.valor ?? "");
    if (amountCents === null) {
      invalidRows.push({ rowNumber, reason: "Valor inválido ou em branco." });
      return;
    }

    const description = (row.descricao ?? "").trim();
    if (!description) {
      invalidRows.push({ rowNumber, reason: "Descrição em branco." });
      return;
    }

    const dedupKey = `${lineDate}|${amountCents}|${normalizeDescription(description)}`;
    validRows.push({ lineDate, description, amountCents: BigInt(amountCents), dedupKey });
  });

  if (validRows.length === 0) {
    throw new ImportFileInvalidError();
  }

  const result = await withCompanyContext(userId, companyId, async (tx) => {
    const account = await tx.financialAccount.findFirst({
      where: { id: data.financialAccountId, companyId },
    });
    if (!account) {
      throw new FinancialAccountNotFoundError();
    }

    const batch = await tx.importBatch.create({
      data: {
        companyId,
        financialAccountId: data.financialAccountId,
        fileName: data.fileName,
        rowCount: parsed.data.length,
        importedCount: 0,
        duplicateCount: 0,
        invalidCount: invalidRows.length,
      },
    });

    let importedCount = 0;
    let duplicateCount = 0;

    for (const row of validRows) {
      const existing = await tx.bankStatementLine.findFirst({
        where: { companyId, financialAccountId: data.financialAccountId, dedupKey: row.dedupKey },
      });
      if (existing) {
        duplicateCount++;
        continue;
      }

      await tx.bankStatementLine.create({
        data: {
          companyId,
          financialAccountId: data.financialAccountId,
          importBatchId: batch.id,
          lineDate: new Date(row.lineDate),
          description: row.description,
          amountCents: row.amountCents,
          dedupKey: row.dedupKey,
        },
      });
      importedCount++;
    }

    const updatedBatch = await tx.importBatch.update({
      where: { id: batch.id },
      data: { importedCount, duplicateCount },
    });

    return updatedBatch;
  });

  return { batch: result, invalidRows };
}
