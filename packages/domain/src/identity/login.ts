import { z } from "zod";
import { prisma } from "@ax-finance/db";
import { InvalidCredentialsError } from "../errors";
import { verifyPassword } from "./password";
import { createSession } from "./session";

export const loginInput = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginInput>;

export async function login(input: LoginInput) {
  const data = loginInput.parse(input);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  // Mesma mensagem para "não existe" e "senha errada": não confirmar quais
  // e-mails têm conta (evita enumeração de usuários).
  if (!user || user.status !== "ACTIVE") {
    throw new InvalidCredentialsError();
  }

  const valid = await verifyPassword(data.password, user.passwordHash);
  if (!valid) {
    throw new InvalidCredentialsError();
  }

  const session = await createSession(user.id);
  return { user, session };
}
