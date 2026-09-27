import { describe, expect, it } from "vitest";
import { addMonths, isDateOnly, isYearMonth, monthLabel, monthRange, resolvePeriodRange } from "./month";

describe("addMonths", () => {
  it("vira o ano pra frente", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });

  it("vira o ano pra trás", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("soma vários meses de uma vez", () => {
    expect(addMonths("2026-09", 5)).toBe("2027-02");
  });
});

describe("monthRange", () => {
  it("devolve o primeiro e o último dia do mês", () => {
    expect(monthRange("2026-09")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("lida com fevereiro (ano não bissexto)", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("lida com fevereiro bissexto", () => {
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
});

describe("monthLabel", () => {
  it("formata em português com a primeira letra maiúscula", () => {
    expect(monthLabel("2026-09")).toBe("Setembro de 2026");
  });
});

describe("resolvePeriodRange", () => {
  it("prioriza um intervalo personalizado válido", () => {
    expect(resolvePeriodRange({ mes: "2026-09", de: "2026-10-03", ate: "2026-11-12" }))
      .toEqual({ mode: "custom", month: "2026-10", from: "2026-10-03", to: "2026-11-12" });
  });

  it("ignora intervalo invertido e usa o mês", () => {
    expect(resolvePeriodRange({ mes: "2026-10", de: "2026-11-01", ate: "2026-10-01" }))
      .toEqual({ mode: "month", month: "2026-10", from: "2026-10-01", to: "2026-10-31" });
  });

  it("valida datas e meses reais", () => {
    expect(isDateOnly("2026-02-29")).toBe(false);
    expect(isDateOnly("2028-02-29")).toBe(true);
    expect(isYearMonth("2026-13")).toBe(false);
  });
});
