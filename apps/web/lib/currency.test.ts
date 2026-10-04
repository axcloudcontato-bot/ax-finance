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
  it("não adivinha milhar quando a vírgula é decimal: valor ambíguo é recusado, não multiplicado por mil", () => {
    for (const ambiguous of ["0,999", "2,500", "1,234", "0.999", "1.2345"]) {
      expect(parseAmountToCentsOrNull(ambiguous), ambiguous).toBeNull();
    }
  });

  it("aceita a grafia americana só quando ela se comprova, e milhar nunca começa com zero", () => {
    expect(parseAmountToCents("1,234.56")).toBe(123456);
    expect(parseAmountToCents("1,234,567")).toBe(123456700);
    expect(parseAmountToCents("1.234.567,89")).toBe(123456789);
    expect(parseAmountToCents("1,5")).toBe(150);
    expect(parseAmountToCents("2,50")).toBe(250);
    expect(parseAmountToCents("10.5")).toBe(1050);
    expect(parseAmountToCents("59,90")).toBe(5990);
    expect(parseAmountToCents("1.000")).toBe(100000);
    expect(parseAmountToCentsOrNull("5,")).toBeNull();
  });
});
