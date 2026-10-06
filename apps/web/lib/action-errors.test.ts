import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { CompanyAccessDeniedError } from "@ax-finance/domain";
import { actionErrorMessage } from "./action-errors";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mensagem de erro das ações", () => {
  it("erro de regra de negócio mostra a própria mensagem, já escrita para a pessoa", () => {
    expect(actionErrorMessage(new CompanyAccessDeniedError(), "Falhou.")).toBe("Empresa não encontrada ou acesso não autorizado.");
  });

  it("campo inválido vira frase em português, nunca o JSON do validador", () => {
    const schema = z.object({ description: z.string().min(1), originalAmountCents: z.number().int() });
    const result = schema.safeParse({ description: "", originalAmountCents: Number.NaN });
    if (result.success) throw new Error("esperava falha");
    const message = actionErrorMessage(result.error, "Falhou.");
    expect(message).toContain("descrição");
    expect(message).toContain("valor");
    expect(message).not.toContain("{");
  });

  it("mensagem escrita em português no schema é preservada", () => {
    const result = z.object({ lastDigits: z.string().regex(/^\d{4}$/, "Informe só os 4 últimos dígitos.") }).safeParse({ lastDigits: "12" });
    if (result.success) throw new Error("esperava falha");
    expect(actionErrorMessage(result.error, "Falhou.")).toBe("Informe só os 4 últimos dígitos.");
  });

  it("falha inesperada não vaza o texto técnico e devolve um código para o suporte", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const message = actionErrorMessage(new Error('relation "credit_card_invoices" does not exist'), "Não foi possível salvar.");
    expect(message).toMatch(/^Não foi possível salvar\./);
    expect(message).toMatch(/código [0-9A-F]{8}/);
    expect(message).not.toContain("credit_card_invoices");

    const line = JSON.parse(String(log.mock.calls[0]?.[0]));
    expect(line).toMatchObject({ event: "web.unhandled_error", source: "action" });
    expect(message).toContain(line.errorRef);
    expect(JSON.stringify(line)).not.toContain("credit_card_invoices");
  });

  it("devolve o erro de redirecionamento do Next em vez de engoli-lo", () => {
    const redirectLike = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    expect(() => actionErrorMessage(redirectLike, "Falhou.")).toThrow(redirectLike);
  });
});
