import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { listFinancialAccountsWithBalance } from "../financial-accounts/account-balances";
import { createBalanceAdjustment } from "../financial-accounts/create-balance-adjustment";
import { reverseBalanceAdjustment } from "../financial-accounts/reverse-balance-adjustment";
import { listBalanceAdjustments } from "../financial-accounts/list-balance-adjustments";
import { closePeriod } from "../closures/close-period";
import { listAuditEvents } from "../audit/list-audit-events";
import {
  BalanceAdjustmentAlreadyReversedError,
  BalanceAdjustmentNotFoundError,
  BalanceAdjustmentNotNeededError,
  FinancialAccountNotFoundError,
  PeriodClosedError,
} from "../errors";
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
    name: "Conta principal",
    type: "BANK",
    openingBalanceCents: 100_000,
    openingDate: "2026-01-01",
  });
  return { user, company, account };
}

async function balanceOf(userId: string, companyId: string, accountId: string) {
  const accounts = await listFinancialAccountsWithBalance(userId, companyId);
  return accounts.find((a) => a.id === accountId)!.currentBalanceCents;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("ajuste de saldo", () => {
  it("informa o saldo real e o sistema calcula o delta sozinho", async () => {
    const { user, company, account } = await setupCompanyWithAccount("ajuste-basico");

    expect(await balanceOf(user.id, company.id, account.id)).toBe(100_000n);

    await createBalanceAdjustment(user.id, company.id, {
      financialAccountId: account.id,
      targetBalanceCents: 97_500,
      reason: "Divergência com o extrato do banco",
      effectiveDate: "2026-09-10",
    });

    expect(await balanceOf(user.id, company.id, account.id)).toBe(97_500n);

    const adjustments = await listBalanceAdjustments(user.id, company.id);
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0]?.amountCents).toBe(-2_500n);
    expect(adjustments[0]?.reason).toBe("Divergência com o extrato do banco");
  });

  it("recusa ajuste quando o saldo alvo já é o saldo atual", async () => {
    const { user, company, account } = await setupCompanyWithAccount("ajuste-desnecessario");

    await expect(
      createBalanceAdjustment(user.id, company.id, {
        financialAccountId: account.id,
        targetBalanceCents: 100_000,
        reason: "Tentando ajustar pro mesmo valor",
        effectiveDate: "2026-09-10",
      })
    ).rejects.toBeInstanceOf(BalanceAdjustmentNotNeededError);
  });

  it("conta inexistente lança FinancialAccountNotFoundError", async () => {
    const { user, company } = await setupCompanyWithAccount("ajuste-conta-inexistente");

    await expect(
      createBalanceAdjustment(user.id, company.id, {
        financialAccountId: randomUUID(),
        targetBalanceCents: 500,
        reason: "Qualquer",
        effectiveDate: "2026-09-10",
      })
    ).rejects.toBeInstanceOf(FinancialAccountNotFoundError);
  });

  it("estornar um ajuste devolve o saldo de antes; estornar de novo é bloqueado", async () => {
    const { user, company, account } = await setupCompanyWithAccount("ajuste-estorno");

    const adjustment = await createBalanceAdjustment(user.id, company.id, {
      financialAccountId: account.id,
      targetBalanceCents: 120_000,
      reason: "Depósito não registrado",
      effectiveDate: "2026-09-10",
    });
    expect(await balanceOf(user.id, company.id, account.id)).toBe(120_000n);

    await reverseBalanceAdjustment(user.id, company.id, adjustment.id, {
      reason: "Lançado por engano",
    });
    expect(await balanceOf(user.id, company.id, account.id)).toBe(100_000n);

    await expect(
      reverseBalanceAdjustment(user.id, company.id, adjustment.id, { reason: "De novo" })
    ).rejects.toBeInstanceOf(BalanceAdjustmentAlreadyReversedError);
  });

  it("ajuste inexistente lança BalanceAdjustmentNotFoundError", async () => {
    const { user, company } = await setupCompanyWithAccount("ajuste-estorno-inexistente");

    await expect(
      reverseBalanceAdjustment(user.id, company.id, randomUUID(), { reason: "Qualquer" })
    ).rejects.toBeInstanceOf(BalanceAdjustmentNotFoundError);
  });

  it("bloqueia criar e estornar ajuste em período fechado", async () => {
    const { user, company, account } = await setupCompanyWithAccount("ajuste-fechado");

    await closePeriod(user.id, company.id, { period: "2026-09" });

    await expect(
      createBalanceAdjustment(user.id, company.id, {
        financialAccountId: account.id,
        targetBalanceCents: 90_000,
        reason: "Tentando ajustar mês fechado",
        effectiveDate: "2026-09-10",
      })
    ).rejects.toBeInstanceOf(PeriodClosedError);
  });

  it("grava evento de auditoria com o motivo", async () => {
    const { user, company, account } = await setupCompanyWithAccount("ajuste-auditoria");

    await createBalanceAdjustment(user.id, company.id, {
      financialAccountId: account.id,
      targetBalanceCents: 90_000,
      reason: "Taxa de manutenção não lançada",
      effectiveDate: "2026-09-10",
    });

    const events = await listAuditEvents(user.id, company.id, {
      resourceType: "FinancialAccount",
      resourceId: account.id,
    });
    expect(events.map((e) => e.eventType)).toEqual(["BALANCE_ADJUSTMENT_CREATED"]);
    expect(events[0]?.summary).toBe("Taxa de manutenção não lançada");
  });

  it("isola ajustes entre empresas", async () => {
    const owner = await setupCompanyWithAccount("ajuste-iso-owner");
    const outsider = await setupCompanyWithAccount("ajuste-iso-outsider");

    await createBalanceAdjustment(owner.user.id, owner.company.id, {
      financialAccountId: owner.account.id,
      targetBalanceCents: 50_000,
      reason: "Ajuste do dono",
      effectiveDate: "2026-09-10",
    });

    const outsiderAdjustments = await listBalanceAdjustments(outsider.user.id, outsider.company.id);
    expect(outsiderAdjustments).toHaveLength(0);
  });
});
