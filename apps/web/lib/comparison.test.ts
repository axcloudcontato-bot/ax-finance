import { describe, expect, it } from "vitest";
import { formatPercentageChange } from "./comparison";

describe("formatPercentageChange", () => {
  it("formata aumentos e reduções", () => {
    expect(formatPercentageChange(BigInt(15_000), BigInt(10_000))).toBe("+50%");
    expect(formatPercentageChange(BigInt(7_500), BigInt(10_000))).toBe("-25%");
  });

  it("trata base zero sem divisão inválida", () => {
    expect(formatPercentageChange(BigInt(0), BigInt(0))).toBe("0%");
    expect(formatPercentageChange(BigInt(1), BigInt(0))).toBe("Sem base comparável");
  });
});
