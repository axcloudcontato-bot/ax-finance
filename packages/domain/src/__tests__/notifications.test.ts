import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createCategory } from "../categories/create-category";
import { createCompany } from "../companies/create-company";
import { registerUser } from "../identity/register";
import {
  generateDueNotifications,
  generateWeeklySummary,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  getNotificationPreference,
  updateNotificationPreference,
} from "../notifications";
import { createTitle } from "../titles/create-title";
import { claimScheduledJobs, completeScheduledJob } from "../scheduled-jobs/jobs";
import { rootClient, resetDatabase } from "./test-db";

async function setup() {
  const user = await registerUser({
    email: `notifications.${randomUUID()}@teste.ax.finance`,
    name: "Pessoa Notificada",
    password: "senha-forte-123",
  });
  const company = await createCompany(user.id, { name: "Empresa Notificações" });
  const category = await createCategory(user.id, company.id, {
    name: "Serviços",
    nature: "OPERATING_REVENUE",
  });
  return { user, company, category };
}

beforeEach(async () => resetDatabase());
afterAll(async () => rootClient.$disconnect());

describe("notificações financeiras persistentes", () => {
  it("gera alerta e e-mail uma única vez e permite marcar como lido", async () => {
    const { user, company, category } = await setup();
    await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Mensalidade vencida",
      categoryId: category.id,
      originalAmountCents: 25_000,
      competenceDate: "2026-09-10",
      dueDate: "2026-09-20",
      idempotencyKey: randomUUID(),
    });

    const first = await generateDueNotifications(
      user.id,
      company.id,
      "https://financeiro.example.com",
      new Date("2026-09-26T12:00:00Z")
    );
    expect(first).toEqual({ notificationsCreated: 1, emailsQueued: 1 });
    expect(await rootClient.outboxEvent.count({ where: { type: "DUE_DATE_SUMMARY" } })).toBe(1);

    const notification = (await listNotifications(user.id, company.id))[0]!;
    expect(notification).toMatchObject({ type: "TITLE_OVERDUE", readAt: null });
    expect(await markNotificationRead(user.id, company.id, notification.id)).toMatchObject({ count: 1 });
    expect((await listNotifications(user.id, company.id))[0]!.readAt).toBeInstanceOf(Date);

    const second = await generateDueNotifications(
      user.id,
      company.id,
      "https://financeiro.example.com",
      new Date("2026-09-26T18:00:00Z")
    );
    expect(second).toEqual({ notificationsCreated: 0, emailsQueued: 0 });
  });

  it("deduplica o resumo semanal e marca todas as notificações como lidas", async () => {
    const { user, company } = await setup();
    const now = new Date("2026-09-28T12:00:00Z");
    const first = await generateWeeklySummary(user.id, company.id, "https://financeiro.example.com", now);
    const second = await generateWeeklySummary(user.id, company.id, "https://financeiro.example.com", now);
    expect(first).toEqual({ notificationsCreated: 1, emailsQueued: 1 });
    expect(second).toEqual({ notificationsCreated: 0, emailsQueued: 0 });
    expect(await markAllNotificationsRead(user.id, company.id)).toMatchObject({ count: 1 });
  });

  it("respeita canais, antecedência e horário configurados pelo usuário", async () => {
    const { user, company, category } = await setup();
    await createTitle(user.id, company.id, {
      type: "PAYABLE",
      description: "Imposto futuro",
      categoryId: category.id,
      originalAmountCents: 10_000,
      competenceDate: "2026-09-26",
      dueDate: "2026-09-29",
      idempotencyKey: randomUUID(),
    });
    expect(await getNotificationPreference(user.id, company.id)).toMatchObject({
      dueDaysAhead: 0,
      deliveryHour: 8,
    });
    await updateNotificationPreference(user.id, company.id, {
      inAppDue: true,
      emailDue: false,
      inAppWeekly: false,
      emailWeekly: false,
      dueDaysAhead: 3,
      deliveryHour: 10,
    });

    // 09h em São Paulo: ainda não deve entregar.
    expect(await generateDueNotifications(user.id, company.id, "https://financeiro.example.com", new Date("2026-09-26T12:00:00Z")))
      .toEqual({ notificationsCreated: 0, emailsQueued: 0 });
    // 11h em São Paulo: alerta antecipado na campainha, mas sem e-mail.
    expect(await generateDueNotifications(user.id, company.id, "https://financeiro.example.com", new Date("2026-09-26T14:00:00Z")))
      .toEqual({ notificationsCreated: 1, emailsQueued: 0 });
    expect((await listNotifications(user.id, company.id))[0]).toMatchObject({ type: "TITLE_DUE_SOON" });
  });
});

describe("agendamentos do worker", () => {
  it("cria os jobs por empresa e impede dois workers de reivindicarem o mesmo job", async () => {
    await setup();
    expect(await rootClient.scheduledJob.count()).toBe(3);

    const [workerA, workerB] = await Promise.all([
      claimScheduledJobs("worker-a", 10),
      claimScheduledJobs("worker-b", 10),
    ]);
    expect(workerA.length + workerB.length).toBe(2);
    const claimed = workerA[0] ?? workerB[0]!;
    const workerId = workerA.length ? "worker-a" : "worker-b";
    expect(await completeScheduledJob(claimed, workerId)).toBe(true);
    expect((await rootClient.scheduledJob.findUniqueOrThrow({ where: { id: claimed.id } })).lockedBy).toBeNull();
  });
});
