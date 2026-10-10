import { describe, expect, it } from "vitest";
import { activeFilterCount, listReturnPath, parseTitleListQuery, sortHref } from "./title-list-params";
import { buildCollectionMessage, mailtoHref, whatsappHref } from "./collection-message";

describe("parâmetros da lista de lançamentos", () => {
  it("lê busca, faixa de valor e ordem; descarta o que é inválido", () => {
    const parsed = parseTitleListQuery({ q: "  aluguel ", min: "1.500,00", max: "abc", ordem: "valor", dir: "desc", pessoa: "não-é-uuid", categoria: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" });
    expect(parsed).toMatchObject({ search: "aluguel", minCents: BigInt(150_000), sort: "valor", dir: "desc", categoryId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" });
    expect(parsed.maxCents).toBeUndefined();
    expect(parsed.partyId).toBeUndefined();
    expect(parseTitleListQuery({ ordem: "qualquer-coisa" }).sort).toBeUndefined();
  });

  it("conta os filtros ligados", () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ q: "x", min: "10", max: " " })).toBe(2);
  });

  it("clicar de novo na coluna inverte o sentido e volta para a primeira página", () => {
    expect(sortHref("/saidas", { mes: "2026-10" }, "valor")).toBe("/saidas?mes=2026-10&ordem=valor&dir=asc");
    expect(sortHref("/saidas", { mes: "2026-10", ordem: "valor", dir: "asc", pagina: "3" }, "valor")).toBe("/saidas?mes=2026-10&ordem=valor&dir=desc");
  });
});

describe("retorno das ações da lista", () => {
  it("só aceita telas de entradas e saídas, e troca os parâmetros de resultado", () => {
    expect(listReturnPath("/saidas?mes=2026-10&erro=x", { baixado: "1" })).toBe("/saidas?mes=2026-10&baixado=1");
    expect(listReturnPath("/entradas/3f2504e0-4f89-41d3-9a0c-0305e82c3301", { cobrado: "1" })).toBe("/entradas/3f2504e0-4f89-41d3-9a0c-0305e82c3301?cobrado=1");
  });

  it("recusa endereço de outro site ou de outra área (redirecionamento aberto)", () => {
    for (const evil of ["https://evil.example/entradas", "//evil.example", "/admin", "/entradas/../admin", "javascript:alert(1)"]) {
      expect(listReturnPath(evil, { baixado: "1" })).toBe("/entradas");
    }
  });
});

describe("mensagem de cobrança", () => {
  const base = { companyName: "Ax Cloud", partyName: "Maria", description: "Instalação de rede", remainingCents: BigInt(150_000), dueDate: "2026-10-01" };

  it("cobra o atraso com valor, vencimento e dias, e inclui os dados de pagamento quando existem", () => {
    const message = buildCollectionMessage({ ...base, daysLate: 7, paymentCode: "PIX 12.345.678/0001-90" });
    expect(message.subject).toBe("Pagamento em aberto: Instalação de rede");
    expect(message.body).toContain("Olá, Maria!");
    expect(message.body).toContain("venceu em 01/10/2026 (7 dias de atraso)");
    expect(message.body).toContain("Dados para pagamento: PIX 12.345.678/0001-90");
    expect(message.body.trimEnd().endsWith("Ax Cloud")).toBe(true);
  });

  it("antes do vencimento vira lembrete, sem dados de pagamento quando não há", () => {
    const message = buildCollectionMessage({ ...base, daysLate: 0 });
    expect(message.subject).toBe("Lembrete de vencimento: Instalação de rede");
    expect(message.body).toContain("vence em 01/10/2026");
    expect(message.body).not.toContain("Dados para pagamento");
  });

  it("monta o link de e-mail só quando o cliente tem e-mail", () => {
    const message = buildCollectionMessage({ ...base, daysLate: 1 });
    expect(mailtoHref(null, message)).toBeNull();
    expect(mailtoHref("maria@exemplo.com", message)).toMatch(/^mailto:maria%40exemplo\.com\?subject=.+&body=.+/);
  });

  it("abre o WhatsApp do cliente com a mensagem; sem telefone válido, deixa escolher o contato", () => {
    expect(whatsappHref("(11) 98765-4321", "Olá!")).toBe("https://wa.me/5511987654321?text=Ol%C3%A1!");
    expect(whatsappHref("+55 11 3456-7890", "x")).toBe("https://wa.me/551134567890?text=x");
    expect(whatsappHref(null, "x")).toBe("https://wa.me/?text=x");
    expect(whatsappHref("123", "x")).toBe("https://wa.me/?text=x");
  });
});

describe("sugestão de multa e juros no navegador", () => {
  it("dá o mesmo resultado que a regra do domínio", async () => {
    const { suggestLateCharges } = await import("@ax-finance/domain");
    const { suggestLateChargesClient } = await import("./late-charges");
    const cases = [
      { cents: 100_000, due: "2026-10-01", on: "2026-10-16", fee: 200, interest: 100 },
      { cents: 3_334, due: "2026-01-31", on: "2026-10-08", fee: 200, interest: 100 },
      { cents: 999_999, due: "2026-10-10", on: "2026-10-10", fee: 200, interest: 100 },
      { cents: 50_000, due: "2026-10-10", on: "2026-09-01", fee: 200, interest: 100 },
      { cents: 50_000, due: "2026-09-01", on: "2026-10-01", fee: 0, interest: 0 },
      { cents: 12_345, due: "2026-07-04", on: "2026-10-08", fee: 1_000, interest: 333 },
    ];
    for (const item of cases) {
      const domain = suggestLateCharges({ remainingCents: BigInt(item.cents), dueDate: item.due, effectiveDate: item.on, lateFeeBps: item.fee, lateInterestMonthlyBps: item.interest });
      const client = suggestLateChargesClient({ principalCents: BigInt(item.cents), dueDate: item.due, effectiveDate: item.on, lateFeeBps: item.fee, lateInterestMonthlyBps: item.interest });
      expect(client).toEqual(domain);
    }
  });
});
