import { describe, expect, it } from "vitest";
import { loginPathFor, safeAuthReturnTo } from "./auth-return";

describe("retorno seguro após autenticação", () => {
  it("preserva páginas administrativas, onboarding e convites internos", () => {
    expect(safeAuthReturnTo("/admin")).toBe("/admin");
    expect(safeAuthReturnTo("/admin/operacoes?falhos=1")).toBe("/admin/operacoes?falhos=1");
    expect(safeAuthReturnTo("/convites/token")).toBe("/convites/token");
    expect(safeAuthReturnTo("/onboarding?plano=PERSONAL")).toBe("/onboarding?plano=PERSONAL");
    expect(loginPathFor("/admin")).toBe("/login?retorno=%2Fadmin");
  });

  it("bloqueia redirecionamentos externos ou não autorizados", () => {
    expect(safeAuthReturnTo("https://example.com")).toBe("/");
    expect(safeAuthReturnTo("//example.com/admin")).toBe("/");
    expect(safeAuthReturnTo("/\\example.com/admin")).toBe("/");
    expect(safeAuthReturnTo("/dashboard")).toBe("/");
  });
});
