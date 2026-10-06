import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createCategory } from "../categories/create-category";
import { createTitle } from "../titles/create-title";
import { listDueSoonTitles } from "../titles/list-due-soon-titles";
import { getOpenTitlesAgingReport } from "../reports/aging-report";
import { DEFAULT_TIME_ZONE, getCompanyToday, todayInTimeZone } from "../shared/today";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

async function setup(label: string, timezone?: string) {
  const user = await registerUser({ email: uniqueEmail(label), name: `Usuária ${label}`, password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: `Empresa ${label}`, ...(timezone ? { timezone } : {}) });
  const category = await createCategory(user.id, company.id, { name: "Aluguel", nature: "EXPENSE" });
  return { user, company, category };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("hoje no fuso da empresa", () => {
  it("em Brasília ainda é o dia anterior depois das 21h, ao contrário de UTC", () => {
    const lateEvening = new Date("2026-10-06T00:30:00Z");
    expect(lateEvening.toISOString().slice(0, 10)).toBe("2026-10-06");
    expect(todayInTimeZone(DEFAULT_TIME_ZONE, lateEvening)).toBe("2026-10-05");
    expect(todayInTimeZone(DEFAULT_TIME_ZONE, new Date("2026-10-06T03:00:00Z"))).toBe("2026-10-06");
  });

  it("segue o fuso cadastrado em cada empresa", async () => {
    const instant = new Date("2026-10-06T00:30:00Z");
    const brasilia = await setup("sp");
    const auckland = await setup("nz", "Pacific/Auckland");
    expect(await getCompanyToday(brasilia.user.id, brasilia.company.id, instant)).toBe("2026-10-05");
    expect(await getCompanyToday(auckland.user.id, auckland.company.id, instant)).toBe("2026-10-06");
  });

  it("vencidos e relatório de atraso usam o dia da empresa", async () => {
    const { user, company, category } = await setup("vencidos");
    const today = await getCompanyToday(user.id, company.id);
    await createTitle(user.id, company.id, {
      type: "PAYABLE", description: "Vence hoje", categoryId: category.id, originalAmountCents: 10_000, competenceDate: today, dueDate: today,
    });

    const dueSoon = await listDueSoonTitles(user.id, company.id);
    expect(dueSoon.map((title) => title.description)).toEqual(["Vence hoje"]);

    const aging = await getOpenTitlesAgingReport(user.id, company.id, {});
    expect(aging.entries[0]?.bucket).toBe("A_VENCER");
    expect(aging.asOfDate.toISOString().slice(0, 10)).toBe(today);
  });
});
