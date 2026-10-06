import { describe, expect, it } from "vitest";
import { calendarNow, todayDateOnlyString } from "./dates";
import { currentYearMonth, resolvePeriodRange } from "./month";

describe("hoje no fuso de Brasília", () => {
  it("depois das 21h o dia ainda não virou, ao contrário de UTC", () => {
    const lateEvening = new Date("2026-10-31T23:30:00Z"); // 20h30 em Brasília
    expect(todayDateOnlyString(lateEvening)).toBe("2026-10-31");
    const afterMidnightUtc = new Date("2026-11-01T01:00:00Z"); // 22h do dia 31 em Brasília
    expect(afterMidnightUtc.toISOString().slice(0, 10)).toBe("2026-11-01");
    expect(todayDateOnlyString(afterMidnightUtc)).toBe("2026-10-31");
  });

  it("calendarNow devolve o dia de Brasília em componentes UTC, inclusive na virada de mês", () => {
    const now = calendarNow(new Date("2026-11-01T01:00:00Z"));
    expect(now.getUTCFullYear()).toBe(2026);
    expect(now.getUTCMonth()).toBe(9); // outubro
    expect(now.getUTCDate()).toBe(31);
  });

  it("os atalhos de período usam o dia de Brasília", () => {
    const now = calendarNow(new Date("2026-11-01T01:00:00Z"));
    expect(resolvePeriodRange({ periodo: "hoje" }, now)).toMatchObject({ from: "2026-10-31", to: "2026-10-31" });
    expect(resolvePeriodRange({ periodo: "trimestre" }, now)).toMatchObject({ from: "2026-10-01", to: "2026-12-31" });
  });

  it("o mês corrente tem o formato YYYY-MM", () => {
    expect(currentYearMonth()).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });
});
