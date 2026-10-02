import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@ax-finance/db";
import {
  createCompany,
  createCompanyInvitation,
  generateSubscriptionNotifications,
  registerUser,
  requestPasswordReset,
} from "@ax-finance/domain";
import { renderOutboxEmail } from "./email";

const rootClient = createPrismaClient(process.env.DATABASE_URL!);

beforeEach(async () => {
  await rootClient.$executeRawUnsafe(
    'TRUNCATE TABLE "outbox_events", "account_tokens", "sessions", "users" RESTART IDENTITY CASCADE'
  );
});
afterAll(async () => rootClient.$disconnect());

describe("renderização dos e-mails da outbox", () => {
  it("aplica o layout da marca com botão, link de fallback e nome escapado", async () => {
    const user = await registerUser({
      email: `layout.${randomUUID()}@teste.ax.finance`,
      name: `<img src=x onerror=alert(1)>`,
      password: "senha-forte-123",
    });
    await requestPasswordReset(user.email, { baseUrl: "https://financeiro.example.com" });

    const event = await rootClient.outboxEvent.findFirstOrThrow();
    const email = renderOutboxEmail(event);

    expect(email.recipient).toBe(user.email);
    expect(email.subject).toBe("Redefinição de senha do AX Finance");
    expect(email.html).toContain("AX Finance");
    expect(email.html).toContain("Redefinir senha");
    expect(email.html).toMatch(/href="https:\/\/financeiro\.example\.com\/redefinir-senha\/[a-f0-9]+"/);
    expect(email.html).toContain("copie e cole este link");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(email.text).toContain("https://financeiro.example.com/redefinir-senha/");
  });

  it("renderiza convite e aviso de assinatura com o mesmo layout", async () => {
    const owner = await registerUser({
      email: `layout-owner.${randomUUID()}@teste.ax.finance`,
      name: "Proprietária",
      password: "senha-forte-123",
    });
    const company = await createCompany(owner.id, { name: "Empresa <Layout>" });
    await createCompanyInvitation(owner.id, company.id, {
      email: `convidado.${randomUUID()}@teste.ax.finance`,
      role: "VIEWER",
    });
    await rootClient.subscription.update({
      where: { companyId: company.id },
      data: { trialEndsAt: new Date("2026-09-30T12:00:00.000Z") },
    });
    await generateSubscriptionNotifications(owner.id, company.id, new Date("2026-09-27T12:00:00.000Z"));

    const events = await rootClient.outboxEvent.findMany({ orderBy: { createdAt: "asc" } });
    const rendered = events.map((event) => ({ type: event.type, email: renderOutboxEmail(event) }));
    const invitation = rendered.find((item) => item.type === "COMPANY_INVITATION")!.email;
    const billing = rendered.find((item) => item.type === "BILLING_NOTICE")!.email;

    expect(invitation.html).toContain("Aceitar convite");
    expect(invitation.html).toContain("Empresa &lt;Layout&gt;");
    expect(invitation.html).not.toContain("Empresa <Layout>");
    expect(invitation.html).toMatch(/\/convites\/[a-f0-9]{64}/);
    expect(billing.html).toContain("Abrir assinatura");
    expect(billing.html).toContain("AX Finance · Gestão financeira");
  });
});
