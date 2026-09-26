import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createCategory } from "../categories/create-category";
import { createTitle } from "../titles/create-title";
import { registerSettlement } from "../titles/register-settlement";
import { reverseSettlement } from "../titles/reverse-settlement";
import { closePeriod } from "../closures/close-period";
import { reopenPeriod } from "../closures/reopen-period";
import { listPeriodClosures } from "../closures/list-period-closures";
import { listAuditEvents } from "../audit/list-audit-events";
import { PeriodClosedError, PeriodClosureNotFoundError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

async function setupCompanyWithAccount(label: string) {
  const user = await registerUser({
    email: uniqueEmail(label),
    name: `Usuária ${label}`,
    password: "senha-forte-123",
  });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const account = await createFinancialAccount(user.id, company.id, {
    name: "Conta A",
    type: "BANK",
    openingBalanceCents: 100_000,
    openingDate: "2026-01-01",
  });
  const category = await createCategory(user.id, company.id, {
    name: "Serviços",
    nature: "OPERATING_REVENUE",
  });
  return { user, company, account, category };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("fechamento de período (Seção 18 regra 8)", () => {
  it("fechar um período bloqueia registrar baixa com data efetiva naquele mês, mas não afeta outro mês", async () => {
    const { user, company, account, category } = await setupCompanyWithAccount("fecha-baixa");

    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Serviço de setembro",
      categoryId: category.id,
      originalAmountCents: 50_000,
      competenceDate: "2026-09-10",
      dueDate: "2026-09-10",
    });

    await closePeriod(user.id, company.id, { period: "2026-09" });

    await expect(
      registerSettlement(user.id, company.id, title.id, {
        financialAccountId: account.id,
        principalAmountCents: 50_000,
        effectiveDate: "2026-09-15",
      })
    ).rejects.toThrow(PeriodClosedError);

    const settlement = await registerSettlement(user.id, company.id, title.id, {
      financialAccountId: account.id,
      principalAmountCents: 50_000,
      effectiveDate: "2026-10-01",
    });
    expect(settlement.id).toBeDefined();
  });

  it("fechar bloqueia estorno de baixa cuja effectiveDate está no mês fechado", async () => {
    const { user, company, account, category } = await setupCompanyWithAccount("fecha-estorno");

    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Serviço de setembro",
      categoryId: category.id,
      originalAmountCents: 50_000,
      competenceDate: "2026-09-10",
      dueDate: "2026-09-10",
    });

    const settlement = await registerSettlement(user.id, company.id, title.id, {
      financialAccountId: account.id,
      principalAmountCents: 50_000,
      effectiveDate: "2026-09-15",
    });

    await closePeriod(user.id, company.id, { period: "2026-09" });

    await expect(
      reverseSettlement(user.id, company.id, settlement.id, { reason: "Registrado por engano" })
    ).rejects.toThrow(PeriodClosedError);
  });

  it("reabrir com motivo libera baixa/estorno de novo; reabrir período não fechado lança erro", async () => {
    const { user, company, account, category } = await setupCompanyWithAccount("reabre");

    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Serviço de setembro",
      categoryId: category.id,
      originalAmountCents: 50_000,
      competenceDate: "2026-09-10",
      dueDate: "2026-09-10",
    });

    await closePeriod(user.id, company.id, { period: "2026-09" });

    await expect(
      reopenPeriod(user.id, company.id, { period: "2026-08", reason: "Nunca foi fechado" })
    ).rejects.toThrow(PeriodClosureNotFoundError);

    await reopenPeriod(user.id, company.id, { period: "2026-09", reason: "Ajuste retroativo autorizado" });

    const settlement = await registerSettlement(user.id, company.id, title.id, {
      financialAccountId: account.id,
      principalAmountCents: 50_000,
      effectiveDate: "2026-09-15",
    });
    expect(settlement.id).toBeDefined();
  });

  it("fechar/reabrir aparecem na trilha de auditoria com o eventType certo", async () => {
    const { user, company } = await setupCompanyWithAccount("audita-fechamento");

    await closePeriod(user.id, company.id, { period: "2026-09" });
    await reopenPeriod(user.id, company.id, { period: "2026-09", reason: "Ajuste retroativo autorizado" });

    const events = await listAuditEvents(user.id, company.id, { resourceType: "Period", resourceId: "2026-09" });
    expect(events.map((e) => e.eventType)).toEqual(["PERIOD_REOPENED", "PERIOD_CLOSED"]);
    expect(events[0]?.summary).toBe("Ajuste retroativo autorizado");
  });

  it("isola fechamentos entre empresas", async () => {
    const owner = await setupCompanyWithAccount("iso-fechamento-owner");
    const outsider = await setupCompanyWithAccount("iso-fechamento-outsider");

    await closePeriod(owner.user.id, owner.company.id, { period: "2026-09" });

    const outsiderClosures = await listPeriodClosures(outsider.user.id, outsider.company.id);
    expect(outsiderClosures).toHaveLength(0);
  });
});
