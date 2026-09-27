import { z } from "zod";
import { prisma } from "@ax-finance/db";
import { EmailNotVerifiedError, InvalidCredentialsError, TooManyLoginAttemptsError } from "../errors";
import { verifyPassword } from "./password";
import { createSession } from "./session";
import { createMfaChallenge } from "./mfa";
import { assertLoginAllowed, clearLoginFailures, recordLoginFailure } from "./login-rate-limit";

export const loginInput = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginInput>;

export async function login(
  input: LoginInput,
  context: { ipAddress?: string; rememberSession?: boolean } = {}
) {
  const data = loginInput.parse(input);
  await assertLoginAllowed(data.email, context.ipAddress);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  // Mesma mensagem para "não existe" e "senha errada": não confirmar quais
  // e-mails têm conta (evita enumeração de usuários).
  if (!user || user.status !== "ACTIVE") {
    if (await recordLoginFailure(data.email, context.ipAddress)) {
      throw new TooManyLoginAttemptsError();
    }
    throw new InvalidCredentialsError();
  }

  const valid = await verifyPassword(data.password, user.passwordHash);
  if (!valid) {
    if (await recordLoginFailure(data.email, context.ipAddress)) {
      throw new TooManyLoginAttemptsError();
    }
    throw new InvalidCredentialsError();
  }

  if (!user.emailVerifiedAt) {
    throw new EmailNotVerifiedError();
  }

  await clearLoginFailures(data.email, context.ipAddress);

  if (user.mfaEnabledAt) {
    const challenge = await createMfaChallenge(user.id, context.rememberSession ?? false);
    return { user, mfaRequired: true as const, challenge };
  }

  const session = await createSession(user.id);
  return { user, mfaRequired: false as const, session };
}
