import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export type AccountMovementKind = "SETTLEMENT" | "REFUND" | "TRANSFER_OUT" | "TRANSFER_IN" | "ADJUSTMENT";

export interface AccountMovement {
  accountId: string;
  date: string;
  kind: AccountMovementKind;
  description: string;
  /** Efeito no saldo da conta: positivo entra, negativo sai (mesma regra de `computeAccountBalanceDeltas`). */
  cents: bigint;
  titleId: string | null;
  titleType: "RECEIVABLE" | "PAYABLE" | null;
}

/**
 * Últimos movimentos efetivados de cada conta (baixas, devoluções, transferências e ajustes não
 * estornados), para o detalhe da conta. Uma consulta só para todas as contas, com no máximo
 * `limit` por conta, do mais recente para o mais antigo.
 */
export async function listRecentAccountMovements(userId: string, companyId: string, options: { limit?: number } = {}) {
  await assertActiveMembership(userId, companyId);
  const limit = Math.min(Math.max(options.limit ?? 8, 1), 50);

  return withCompanyContext(userId, companyId, async (tx) => {
    const rows = await tx.$queryRaw<{ account_id: string; date: Date; kind: AccountMovementKind; description: string; cents: bigint; title_id: string | null; title_type: "RECEIVABLE" | "PAYABLE" | null }[]>`
      WITH movements AS (
        SELECT s."financial_account_id" AS account_id, s."effective_date" AS date, s."created_at" AS created_at,
               'SETTLEMENT'::text AS kind, t."description" AS description,
               (CASE WHEN t."type" = 'RECEIVABLE'
                 THEN s."principal_amount_cents" + s."interest_penalty_cents" - s."fees_cents"
                 ELSE -(s."principal_amount_cents" + s."interest_penalty_cents" + s."fees_cents") END)::bigint AS cents,
               t."id" AS title_id, t."type"::text AS title_type
        FROM "settlements" s JOIN "titles" t ON t."id" = s."title_id"
        WHERE s."company_id" = ${companyId} AND s."reversed_at" IS NULL
        UNION ALL
        SELECT r."financial_account_id", r."effective_date", r."created_at", 'REFUND', 'Devolução: ' || t."description",
               (CASE WHEN t."type" = 'RECEIVABLE' THEN -r."amount_cents" ELSE r."amount_cents" END)::bigint,
               t."id", t."type"::text
        FROM "settlement_refunds" r JOIN "settlements" s ON s."id" = r."settlement_id" JOIN "titles" t ON t."id" = s."title_id"
        WHERE r."company_id" = ${companyId} AND r."reversed_at" IS NULL
        UNION ALL
        SELECT tr."from_account_id", tr."transfer_date", tr."created_at", 'TRANSFER_OUT',
               COALESCE(NULLIF(tr."description", ''), 'Transferência para ' || dest."name"),
               (-(tr."amount_cents" + tr."fee_cents"))::bigint, NULL, NULL
        FROM "transfers" tr JOIN "financial_accounts" dest ON dest."id" = tr."to_account_id"
        WHERE tr."company_id" = ${companyId} AND tr."reversed_at" IS NULL
        UNION ALL
        SELECT tr."to_account_id", tr."transfer_date", tr."created_at", 'TRANSFER_IN',
               COALESCE(NULLIF(tr."description", ''), 'Transferência de ' || src."name"),
               tr."amount_cents"::bigint, NULL, NULL
        FROM "transfers" tr JOIN "financial_accounts" src ON src."id" = tr."from_account_id"
        WHERE tr."company_id" = ${companyId} AND tr."reversed_at" IS NULL
        UNION ALL
        SELECT a."financial_account_id", a."effective_date", a."created_at", 'ADJUSTMENT', 'Ajuste de saldo: ' || a."reason",
               a."amount_cents"::bigint, NULL, NULL
        FROM "balance_adjustments" a
        WHERE a."company_id" = ${companyId} AND a."reversed_at" IS NULL
      ), ranked AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY date DESC, created_at DESC) AS position
        FROM movements
      )
      SELECT account_id, date, kind, description, cents, title_id, title_type
      FROM ranked WHERE position <= ${limit}::int
      ORDER BY account_id, date DESC, created_at DESC`;

    const byAccount = new Map<string, AccountMovement[]>();
    for (const row of rows) {
      const list = byAccount.get(row.account_id) ?? [];
      list.push({
        accountId: row.account_id,
        date: row.date.toISOString().slice(0, 10),
        kind: row.kind,
        description: row.description,
        cents: row.cents,
        titleId: row.title_id,
        titleType: row.title_type,
      });
      byAccount.set(row.account_id, list);
    }
    return byAccount;
  });
}
