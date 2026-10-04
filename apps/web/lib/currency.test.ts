import { describe, expect, it } from "vitest";
import { parseAmountToCents, parseAmountToCentsOrNull } from "./currency";

describe("parseAmountToCents", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234.56", 123456],
    ["R$ 1.234,56", 123456],
    ["1,234.56", 123456],
    ["1.234", 123400],
    ["0,05", 5],
    ["-1.234,56", -123456],
    ["", 0],
  ])("interpreta %s como %i centavos", (input, cents) => {
    expect(parseAmountToCents(input)).toBe(cents);
  });

  it("distingue valor inválido de zero no formulário", () => {
    expect(parseAmountToCentsOrNull("abc")).toBeNull();
    expect(parseAmountToCentsOrNull("0,00")).toBe(0);
    expect(Number.isNaN(parseAmountToCents("abc"))).toBe(true);
  });
});
