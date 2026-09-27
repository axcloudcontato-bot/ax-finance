import { afterEach, describe, expect, it } from "vitest";
import { hasOperationsToken } from "./operations-auth";

const originalToken = process.env.OPERATIONS_TOKEN;

afterEach(() => {
  if (originalToken === undefined) delete process.env.OPERATIONS_TOKEN;
  else process.env.OPERATIONS_TOKEN = originalToken;
});

describe("autenticação das rotas operacionais", () => {
  it("recusa token ausente, curto ou incorreto", () => {
    delete process.env.OPERATIONS_TOKEN;
    expect(hasOperationsToken(new Request("http://localhost"), "OPERATIONS_TOKEN")).toBe(false);
    process.env.OPERATIONS_TOKEN = "curto";
    expect(hasOperationsToken(new Request("http://localhost", {
      headers: { authorization: "Bearer curto" },
    }), "OPERATIONS_TOKEN")).toBe(false);
    process.env.OPERATIONS_TOKEN = "token-operacional-com-mais-de-24-caracteres";
    expect(hasOperationsToken(new Request("http://localhost", {
      headers: { authorization: "Bearer incorreto" },
    }), "OPERATIONS_TOKEN")).toBe(false);
  });

  it("aceita somente Bearer com igualdade exata", () => {
    process.env.OPERATIONS_TOKEN = "token-operacional-com-mais-de-24-caracteres";
    expect(hasOperationsToken(new Request("http://localhost", {
      headers: { authorization: `Bearer ${process.env.OPERATIONS_TOKEN}` },
    }), "OPERATIONS_TOKEN")).toBe(true);
  });
});
