import { describe, expect, it } from "vitest";
import {
  cycleClosingInMonth,
  cycleForPurchaseDate,
  cyclesForInstallments,
  installmentCompetenceDate,
  invoiceStage,
  splitInstallments,
} from "../credit-cards/invoice-cycle";
import { todayInTimeZone } from "../shared/today";

const card = { closingDay: 10, dueDay: 20 };

describe("ciclo da fatura do cartão", () => {
  it("compra antes do fechamento entra na fatura do mês; no dia do fechamento ou depois, na seguinte", () => {
    expect(cycleForPurchaseDate(card, "2026-10-09")).toEqual({ referenceMonth: "2026-10", closingDate: "2026-10-10", dueDate: "2026-10-20" });
    expect(cycleForPurchaseDate(card, "2026-10-10")).toEqual({ referenceMonth: "2026-11", closingDate: "2026-11-10", dueDate: "2026-11-20" });
    expect(cycleForPurchaseDate(card, "2026-10-31")).toEqual({ referenceMonth: "2026-11", closingDate: "2026-11-10", dueDate: "2026-11-20" });
  });

  it("vencimento antes do fechamento no calendário cai no mês seguinte ao fechamento", () => {
    const late = { closingDay: 25, dueDay: 5 };
    expect(cycleForPurchaseDate(late, "2026-10-20")).toEqual({ referenceMonth: "2026-11", closingDate: "2026-10-25", dueDate: "2026-11-05" });
    expect(cycleForPurchaseDate(late, "2026-12-30")).toEqual({ referenceMonth: "2027-02", closingDate: "2027-01-25", dueDate: "2027-02-05" });
  });

  it("mês sem o dia configurado usa o último dia, sem arrastar o ajuste para os meses seguintes", () => {
    const end = { closingDay: 31, dueDay: 10 };
    expect(cycleForPurchaseDate(end, "2026-02-10")).toEqual({ referenceMonth: "2026-03", closingDate: "2026-02-28", dueDate: "2026-03-10" });
    expect(cycleForPurchaseDate(end, "2026-02-28")).toEqual({ referenceMonth: "2026-04", closingDate: "2026-03-31", dueDate: "2026-04-10" });
    expect(cycleClosingInMonth(end, 2026, 4).closingDate).toBe("2026-04-30");
    expect(cycleClosingInMonth(end, 2026, 5).closingDate).toBe("2026-05-31");
  });

  it("fechamento e vencimento nunca colapsam no mesmo dia (fevereiro com fecha 30 / vence 31)", () => {
    const squeeze = { closingDay: 30, dueDay: 31 };
    const cycle = cycleClosingInMonth(squeeze, 2026, 2);
    expect(cycle.closingDate).toBe("2026-02-28");
    expect(cycle.dueDate > cycle.closingDate).toBe(true);
    expect(cycle.dueDate).toBe("2026-03-31");
  });

  it("vira o ano ao gerar um ciclo por parcela", () => {
    const cycles = cyclesForInstallments(card, "2026-11-15", 3);
    expect(cycles.map((cycle) => cycle.closingDate)).toEqual(["2026-12-10", "2027-01-10", "2027-02-10"]);
    expect(cycles.map((cycle) => cycle.referenceMonth)).toEqual(["2026-12", "2027-01", "2027-02"]);
  });
});

describe("parcelas", () => {
  it("o resto da divisão vai para as primeiras parcelas e a soma fecha o total", () => {
    expect(splitInstallments(10_000, 3)).toEqual([3334, 3333, 3333]);
    const parts = splitInstallments(99_999, 7);
    expect(parts.reduce((sum, value) => sum + value, 0)).toBe(99_999);
    expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
  });

  it("a competência de cada parcela anda um mês por vez, presa ao fim do mês", () => {
    expect(installmentCompetenceDate("2026-01-31", 0)).toBe("2026-01-31");
    expect(installmentCompetenceDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(installmentCompetenceDate("2026-01-31", 2)).toBe("2026-03-31");
    expect(installmentCompetenceDate("2026-11-15", 2)).toBe("2027-01-15");
  });
});

describe("situação da fatura", () => {
  const invoice = { referenceMonth: "2026-10", closingDate: "2026-10-10", dueDate: "2026-10-20" };
  const owed = BigInt(5000);

  it("paga quando não resta nada", () => {
    expect(invoiceStage(card, invoice, BigInt(0), "2026-10-05")).toBe("PAID");
  });

  it("sem compras ativas não é paga nem a pagar: é vazia", () => {
    expect(invoiceStage(card, invoice, BigInt(0), "2026-10-25", BigInt(0))).toBe("EMPTY");
    expect(invoiceStage(card, invoice, BigInt(0), "2026-10-25", BigInt(5000))).toBe("PAID");
  });

  it("aberta enquanto o ciclo está em andamento", () => {
    expect(invoiceStage(card, invoice, owed, "2026-10-05")).toBe("OPEN");
    expect(invoiceStage(card, invoice, owed, "2026-10-09")).toBe("OPEN");
  });

  it("fechada a partir do dia de fechamento e vencida depois do vencimento", () => {
    expect(invoiceStage(card, invoice, owed, "2026-10-10")).toBe("CLOSED");
    expect(invoiceStage(card, invoice, owed, "2026-10-20")).toBe("CLOSED");
    expect(invoiceStage(card, invoice, owed, "2026-10-21")).toBe("OVERDUE");
  });

  it("futura quando é um ciclo depois do que está em andamento (parcelas já lançadas)", () => {
    expect(invoiceStage(card, { referenceMonth: "2026-12", closingDate: "2026-12-10", dueDate: "2026-12-20" }, owed, "2026-10-05")).toBe("FUTURE");
    expect(invoiceStage(card, { referenceMonth: "2026-11", closingDate: "2026-11-10", dueDate: "2026-11-20" }, owed, "2026-10-12")).toBe("OPEN");
  });
});

describe("hoje no fuso da empresa", () => {
  it("depois das 21h em Brasília ainda é o mesmo dia, ao contrário de UTC", () => {
    const lateEvening = new Date("2026-10-06T00:30:00Z");
    expect(todayInTimeZone("America/Sao_Paulo", lateEvening)).toBe("2026-10-05");
    expect(lateEvening.toISOString().slice(0, 10)).toBe("2026-10-06");
    expect(todayInTimeZone("America/Sao_Paulo", new Date("2026-10-06T03:00:00Z"))).toBe("2026-10-06");
  });
});
