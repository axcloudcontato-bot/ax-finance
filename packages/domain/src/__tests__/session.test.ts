import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { login } from "../identity/login";
import { resolveSession, revokeSession } from "../identity/session";
import { InvalidCredentialsError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("sessão (Seção 17: sessões revogáveis)", () => {
  it("logout revoga a sessão; requisições seguintes com o mesmo token falham", async () => {
    const email = uniqueEmail("sessao");
    await registerUser({ email, name: "Usuária Sessão", password: "senha-forte-abc" });

    const { session } = await login({ email, password: "senha-forte-abc" });

    const resolvedBefore = await resolveSession(session.rawToken);
    expect(resolvedBefore?.user.email).toBe(email);

    await revokeSession(session.rawToken);

    const resolvedAfter = await resolveSession(session.rawToken);
    expect(resolvedAfter).toBeNull();
  });

  it("rejeita e-mail ou senha incorretos sem revelar qual dos dois", async () => {
    const email = uniqueEmail("credenciais");
    await registerUser({ email, name: "Usuária", password: "senha-forte-correta" });

    await expect(login({ email, password: "senha-errada" })).rejects.toBeInstanceOf(
      InvalidCredentialsError
    );
    await expect(
      login({ email: uniqueEmail("inexistente"), password: "qualquer" })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
