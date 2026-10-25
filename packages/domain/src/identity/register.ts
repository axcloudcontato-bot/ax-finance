import { z } from "zod";
import { prisma } from "@ax-finance/db";
import { EmailAlreadyRegisteredError } from "../errors";
import { createAccountTokenWithClient, issueEmailVerificationToken, type AccountEmailDelivery } from "./account-tokens";
import { enqueueAccountExistsEmail } from "../outbox/events";
import { hashPassword } from "./password";

export const registerUserInput = z.object({
  email: z.string().trim().email().toLowerCase(),
  name: z.string().trim().min(1).max(200),
  password: z.string().min(8).max(200),
});

export type RegisterUserInput = z.infer<typeof registerUserInput>;

export async function registerUser(
  input: RegisterUserInput,
  options: { requireEmailVerification?: boolean; verificationDelivery?: AccountEmailDelivery } = {}
) {
  const data = registerUserInput.parse(input);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new EmailAlreadyRegisteredError();
  }

  const passwordHash = await hashPassword(data.password);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: {
      email: data.email,
      name: data.name,
      passwordHash,
      emailVerifiedAt: options.requireEmailVerification || options.verificationDelivery ? null : new Date(),
    } });
    const verification = options.verificationDelivery
      ? await createAccountTokenWithClient(
          tx,
          user,
          "EMAIL_VERIFICATION",
          24 * 60 * 60 * 1000,
          options.verificationDelivery
        )
      : undefined;
    return { ...user, verification };
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

/**
 * Cadastro público (tela e API): responde do mesmo jeito tenha ou não conta com o e-mail, para não
 * revelar quem é cliente. E-mail novo cria a conta e envia a confirmação. E-mail já cadastrado e
 * ainda não confirmado recebe uma nova confirmação; já confirmado recebe um aviso para entrar ou
 * redefinir a senha (no máximo um por hora). O hash da senha roda nos dois caminhos para o tempo de
 * resposta não denunciar a diferença.
 */
export async function requestSignUp(input: RegisterUserInput, options: { verificationDelivery: AccountEmailDelivery }) {
  const data = registerUserInput.parse(input);
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (!existing) {
    try {
      const user = await registerUser(data, { requireEmailVerification: true, verificationDelivery: options.verificationDelivery });
      return { createdUser: user };
    } catch (error) {
      // Dois cadastros simultâneos com o mesmo e-mail: o segundo segue como "já existe".
      if (!(error instanceof EmailAlreadyRegisteredError) && !isUniqueViolation(error)) throw error;
    }
  } else {
    await hashPassword(data.password);
  }

  const user = existing ?? (await prisma.user.findUnique({ where: { email: data.email } }));
  if (!user || user.status !== "ACTIVE") return { createdUser: null };
  if (!user.emailVerifiedAt) {
    await issueEmailVerificationToken(user.id, options.verificationDelivery);
    return { createdUser: null };
  }
  const hour = new Date().toISOString().slice(0, 13);
  await prisma.$transaction((tx) => enqueueAccountExistsEmail(tx, `account-exists:${user.id}:${hour}`, {
    to: user.email,
    name: user.name,
    baseUrl: options.verificationDelivery.baseUrl.replace(/\/$/, ""),
  }));
  return { createdUser: null };
}
