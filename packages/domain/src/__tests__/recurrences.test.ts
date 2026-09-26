import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createCategory } from "../categories/create-category";
import { createRecurrenceRule } from "../recurrences/create-recurrence-rule";
import { listRecurrenceRules } from "../recurrences/list-recurrence-rules";
import { listOccurrenceTitles } from "../recurrences/list-occurrence-titles";
import { pauseRecurrenceRule } from "../recurrences/pause-recurrence-rule";
import { cancelRecurrenceRule } from "../recurrences/cancel-recurrence-rule";
import { generateDueOccurrences } from "../recurrences/generate-due-occurrences";
import { computeOccurrenceDates } from "../recurrences/recurrence-dates";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

async function setupCompany(label: string) {
  const user = await registerUser({
    email: uniqueEmail(label),
    name: `Usuária ${label}`,
    password: "senha-forte-123",
  });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const category = await createCategory(user.id, company.id, {
    name: "Serviços",
    nature: "OPERATING_REVENUE",
  });
  return { user, company, category };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("computeOccurrenceDates (Seção 11)", () => {
  it("pula a primeira ocorrência do próprio mês quando o dia-âncora já passou no início", () => {
    const dates = computeOccurrenceDates("2026-01-15", 5, null, "2026-04-30");
    expect(dates).toEqual(["2026-02-05", "2026-03-05", "2026-04-05"]);
  });

  it("respeita o término da regra", () => {
    const dates = computeOccurrenceDates("2026-01-05", 5, "2026-02-28", "2026-06-30");
    expect(dates).toEqual(["2026-01-05", "2026-02-05"]);
  });
});

describe("recorrência (Seção 11)", () => {
  it("gera os títulos pendentes de forma idempotente", async () => {
    const { user, company, category } = await setupCompany("gen");
    const today = new Date().toISOString().slice(0, 10);
    const todayDay = Number(today.slice(8, 10));

    const rule = await createRecurrenceRule(user.id, company.id, {
      type: "PAYABLE",
      description: "Aluguel",
      categoryId: category.id,
      amountCents: 150_000,
      dayOfMonth: todayDay,
      startDate: today,
    });

    const first = await generateDueOccurrences(user.id, company.id);
    expect(first.createdCount).toBeGreaterThan(0);

    const second = await generateDueOccurrences(user.id, company.id);
    expect(second.createdCount).toBe(0);

    const occurrences = await listOccurrenceTitles(user.id, company.id, rule.id);
    expect(occurrences.length).toBe(first.createdCount);
    expect(occurrences[0]?.description).toBe("Aluguel");
  });

  it("regra pausada não gera novos títulos, mas preserva os já gerados", async () => {
    const { user, company, category } = await setupCompany("pause");
    const today = new Date().toISOString().slice(0, 10);
    const todayDay = Number(today.slice(8, 10));

    const rule = await createRecurrenceRule(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Mensalidade",
      categoryId: category.id,
      amountCents: 20_000,
      dayOfMonth: todayDay,
      startDate: today,
    });

    await generateDueOccurrences(user.id, company.id);
    const beforePause = await listOccurrenceTitles(user.id, company.id, rule.id);
    expect(beforePause.length).toBeGreaterThan(0);

    await pauseRecurrenceRule(user.id, company.id, rule.id);
    const resultAfterPause = await generateDueOccurrences(user.id, company.id);
    expect(resultAfterPause.createdCount).toBe(0);

    const afterPause = await listOccurrenceTitles(user.id, company.id, rule.id);
    expect(afterPause.length).toBe(beforePause.length);
  });

  it("cancela títulos abertos gerados só quando alsoCancelOpenTitles é true", async () => {
    const { user, company, category } = await setupCompany("cancel");
    const today = new Date().toISOString().slice(0, 10);
    const todayDay = Number(today.slice(8, 10));

    const rule = await createRecurrenceRule(user.id, company.id, {
      type: "PAYABLE",
      description: "Assinatura",
      categoryId: category.id,
      amountCents: 5_000,
      dayOfMonth: todayDay,
      startDate: today,
    });

    await generateDueOccurrences(user.id, company.id);

    await cancelRecurrenceRule(user.id, company.id, rule.id, {
      reason: "Contrato encerrado",
      alsoCancelOpenTitles: true,
    });

    const titles = await listOccurrenceTitles(user.id, company.id, rule.id);
    expect(titles.every((t) => t.status === "CANCELLED")).toBe(true);

    const rules = await listRecurrenceRules(user.id, company.id);
    expect(rules.find((r) => r.id === rule.id)?.status).toBe("CANCELLED");
  });

  it("não cancela títulos quando alsoCancelOpenTitles é omitido", async () => {
    const { user, company, category } = await setupCompany("keep-open");
    const today = new Date().toISOString().slice(0, 10);
    const todayDay = Number(today.slice(8, 10));

    const rule = await createRecurrenceRule(user.id, company.id, {
      type: "PAYABLE",
      description: "Internet",
      categoryId: category.id,
      amountCents: 8_000,
      dayOfMonth: todayDay,
      startDate: today,
    });

    await generateDueOccurrences(user.id, company.id);
    await cancelRecurrenceRule(user.id, company.id, rule.id, { reason: "Encerrado" });

    const titles = await listOccurrenceTitles(user.id, company.id, rule.id);
    expect(titles.every((t) => t.status === "OPEN")).toBe(true);
  });

  it("isola regras entre empresas", async () => {
    const { user, company, category } = await setupCompany("iso-a");
    const other = await setupCompany("iso-b");

    await createRecurrenceRule(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Regra A",
      categoryId: category.id,
      amountCents: 1_000,
      dayOfMonth: 10,
      startDate: "2026-01-01",
    });
    await createRecurrenceRule(other.user.id, other.company.id, {
      type: "RECEIVABLE",
      description: "Regra B",
      categoryId: other.category.id,
      amountCents: 1_000,
      dayOfMonth: 10,
      startDate: "2026-01-01",
    });

    const rulesForA = await listRecurrenceRules(user.id, company.id);
    expect(rulesForA.map((r) => r.description)).toEqual(["Regra A"]);
  });
});
