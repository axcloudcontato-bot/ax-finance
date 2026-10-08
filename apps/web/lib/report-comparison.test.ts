import { describe, expect, it } from "vitest";
import { alignRealizedComparison } from "./report-comparison";

describe("comparação do caixa realizado", () => {
  const previous = { from: "2026-09-01", to: "2026-09-30", label: "Período anterior" };
  it("compara oito dias realizados com oito dias anteriores", () => {
    expect(alignRealizedComparison({ from: "2026-10-01", to: "2026-10-31" }, previous, "2026-10-08")?.to).toBe("2026-09-08");
  });
  it("mantém seleção histórica e desativa comparação totalmente futura", () => {
    expect(alignRealizedComparison({ from: "2026-10-01", to: "2026-10-31" }, previous, "2026-11-01")).toEqual(previous);
    expect(alignRealizedComparison({ from: "2026-11-01", to: "2026-11-30" }, previous, "2026-10-08")).toBeNull();
  });
  it("não ultrapassa o fim do intervalo anterior nem falha na virada do ano", () => {
    expect(alignRealizedComparison({ from: "2026-12-01", to: "2027-01-31" }, previous, "2026-12-31")?.to).toBe("2026-09-30");
    expect(alignRealizedComparison({ from: "2026-12-30", to: "2027-01-08" }, { from: "2026-01-01", to: "2026-01-10", label: "Anterior" }, "2027-01-01")?.to).toBe("2026-01-03");
  });
});
