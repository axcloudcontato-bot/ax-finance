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
import { renderDueDateSummaryEmail, renderOutboxEmail, renderWeeklySummaryEmail } from "./email";

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

  it("resumo do dia separa vencidos, do dia e próximos, com valor e cliente, sem misturar entradas e saídas", () => {
    const email = renderDueDateSummaryEmail({
      to: "ana@teste.ax.finance",
      name: "Ana",
      companyName: "Empresa <Teste>",
      baseUrl: "https://financeiro.example.com",
      today: "2026-10-10",
      items: [
        { type: "RECEIVABLE", description: "Mensalidade", dueDate: "2026-10-05", overdue: true, href: "/entradas/a", remainingCents: "185000", currency: "BRL", partyName: "Cliente <b>" },
        { type: "PAYABLE", description: "Aluguel", dueDate: "2026-10-10", overdue: false, href: "/saidas/b", remainingCents: "420000", currency: "BRL", partyName: null },
        { type: "PAYABLE", description: "Energia", dueDate: "2026-10-13", overdue: false, href: "/saidas/c", remainingCents: "10000", currency: "BRL" },
      ],
    });
    expect(email.subject).toBe("2 títulos precisam de atenção — Empresa <Teste>");
    for (const text of ["Vencidos · 1", "Vencem hoje · 1", "Próximos dias · 1", "venceu em 05/10/2026 (5 dias)", "vence hoje", "R$ 4.300,00", "R$ 1.850,00"]) {
      expect(email.html.replace(/\u00a0/g, " ")).toContain(text);
    }
    expect(email.html).toContain('href="https://financeiro.example.com/entradas/a"');
    expect(email.html).toContain("Cliente &lt;b&gt;");
    expect(email.html).not.toContain("Empresa <Teste>");
    expect(email.text).toContain("VENCIDOS (1)");
  });

  it("aviso antigo da fila, sem data de referência nem valores, ainda renderiza", () => {
    const email = renderDueDateSummaryEmail({
      to: "ana@teste.ax.finance",
      name: "Ana",
      companyName: "Empresa",
      baseUrl: "https://financeiro.example.com",
      items: [{ type: "RECEIVABLE", description: "Antigo", dueDate: "2026-10-05", overdue: true, href: "/entradas/a" }],
    });
    expect(email.html).toContain("Vencidos · 1");
    expect(email.html).toContain("venceu em 05/10/2026");
    expect(email.subject).toBe("1 título precisa de atenção — Empresa");
  });

  it("resumo semanal mostra os números em cartões e a diferença entre entradas e saídas", () => {
    const email = renderWeeklySummaryEmail({
      to: "ana@teste.ax.finance",
      name: "Ana",
      companyName: "Empresa",
      baseUrl: "https://financeiro.example.com",
      receivableOpenCents: "100000",
      payableOpenCents: "150000",
      overdueCount: 2,
      dueNext7Count: 0,
    });
    const html = email.html.replace(/\u00a0/g, " ");
    expect(html).toContain("Próximos 7 dias");
    expect(html).toContain("−R$ 500,00");
  });
});
