import { describe, expect, it } from "vitest";
import { caretAfterFormat, completeMoneyInput, formatMoneyInput } from "./money-mask";
import { parseAmountToCents } from "./currency";

describe("máscara de valor em reais", () => {
  it("insere o ponto de milhar enquanto digita e mantém a vírgula decimal com até duas casas", () => {
    expect(formatMoneyInput("3000")).toBe("3.000");
    expect(formatMoneyInput("1234567")).toBe("1.234.567");
    expect(formatMoneyInput("3.0004")).toBe("30.004");
    expect(formatMoneyInput("3000,5")).toBe("3.000,5");
    expect(formatMoneyInput("3000,567")).toBe("3.000,56");
    expect(formatMoneyInput(",")).toBe("0,");
    expect(formatMoneyInput("007")).toBe("7");
    expect(formatMoneyInput("abc")).toBe("");
    expect(formatMoneyInput("")).toBe("");
  });

  it("aceita sinal negativo (ajuste de saldo) e ignora R$ e letras", () => {
    expect(formatMoneyInput("-1500")).toBe("-1.500");
    expect(formatMoneyInput("-")).toBe("-");
    expect(formatMoneyInput("R$ 59,9")).toBe("59,9");
  });

  it("ao colar, entende ponto decimal pela regra do servidor", () => {
    expect(formatMoneyInput("1234.56", { pasted: true })).toBe("1.234,56");
    expect(formatMoneyInput("R$ 1.234,56", { pasted: true })).toBe("1.234,56");
    expect(formatMoneyInput("1,234.56", { pasted: true })).toBe("1.234,56");
    expect(formatMoneyInput("59.9", { pasted: true })).toBe("59,90");
    // Ambíguo ("2,500"): o servidor recusa, então não adivinha nem corta dígitos.
    expect(formatMoneyInput("2,500", { pasted: true })).toBe("2,500");
    expect(completeMoneyInput("2,500")).toBe("2,500");
  });

  it("ao sair do campo completa as casas decimais", () => {
    expect(completeMoneyInput("3.000")).toBe("3.000,00");
    expect(completeMoneyInput("3.000,5")).toBe("3.000,50");
    expect(completeMoneyInput("3.000,")).toBe("3.000,00");
    expect(completeMoneyInput(",")).toBe("0,00");
    expect(completeMoneyInput("-")).toBe("");
    expect(completeMoneyInput("")).toBe("");
    expect(completeMoneyInput("-1.500")).toBe("-1.500,00");
  });

  it("o que a máscara produz é lido do mesmo jeito pelo servidor", () => {
    for (const [typed, cents] of [["3000", 300_000], ["3000,5", 300_050], ["1234567,89", 123_456_789], ["0,07", 7], ["-250", -25_000]] as const) {
      expect(parseAmountToCents(completeMoneyInput(formatMoneyInput(typed)))).toBe(cents);
    }
  });

  it("mantém o cursor depois do mesmo dígito quando o ponto de milhar é inserido", () => {
    // "3000|" -> "3.000|"
    expect(caretAfterFormat("3000", 4, "3.000")).toBe(5);
    // "30|00" -> "3.0|00": dois dígitos antes do cursor
    expect(caretAfterFormat("3000", 2, "3.000")).toBe(3);
    expect(caretAfterFormat("", 0, "")).toBe(0);
  });
});
