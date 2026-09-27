import { describe, expect, it } from "vitest";
import {
  addMonths,
  comparisonRange,
  isDateOnly,
  isYearMonth,
  monthLabel,
  monthRange,
  periodQuery,
  resolveComparison,
  resolvePeriodRange,
} from "./month";

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

  it("resolve atalhos de hoje, últimos 7 dias, trimestre e ano", () => {
    const now = new Date("2026-09-27T12:00:00.000Z");
    expect(resolvePeriodRange({ periodo: "hoje" }, now)).toMatchObject({ from: "2026-09-27", to: "2026-09-27" });
    expect(resolvePeriodRange({ periodo: "ultimos-7-dias" }, now)).toMatchObject({ from: "2026-09-21", to: "2026-09-27" });
    expect(resolvePeriodRange({ periodo: "trimestre" }, now)).toMatchObject({ from: "2026-07-01", to: "2026-09-30" });
    expect(resolvePeriodRange({ periodo: "ano" }, now)).toMatchObject({ from: "2026-01-01", to: "2026-12-31" });
  });
});

describe("comparações", () => {
  it("compara mês com o mês anterior e intervalo com duração equivalente", () => {
    const month = resolvePeriodRange({ mes: "2026-03" });
    expect(comparisonRange(month, "anterior")).toMatchObject({ from: "2026-02-01", to: "2026-02-28" });
    const custom = resolvePeriodRange({ de: "2026-09-10", ate: "2026-09-16" });
    expect(comparisonRange(custom, "anterior")).toMatchObject({ from: "2026-09-03", to: "2026-09-09" });
  });

  it("desloca para o ano anterior tratando dia bissexto", () => {
    const leap = resolvePeriodRange({ de: "2028-02-29", ate: "2028-03-02" });
    expect(comparisonRange(leap, "ano-anterior")).toMatchObject({ from: "2027-02-28", to: "2027-03-02" });
    expect(resolveComparison({ comparar: "ano-anterior" }, leap)?.mode).toBe("ano-anterior");
  });

  it("preserva atalho e comparação na query", () => {
    const period = resolvePeriodRange({ periodo: "trimestre" }, new Date("2026-09-27T12:00:00Z"));
    expect(periodQuery(period, "anterior")).toBe("periodo=trimestre&comparar=anterior");
  });
});
