import { z } from "zod";
import { prisma } from "@ax-finance/db";
import { EmailAlreadyRegisteredError } from "../errors";
import { hashPassword } from "./password";

export const registerUserInput = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().trim().min(1).max(200),
  password: z.string().min(8).max(200),
});

export type RegisterUserInput = z.infer<typeof registerUserInput>;

export async function registerUser(input: RegisterUserInput) {
  const data = registerUserInput.parse(input);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new EmailAlreadyRegisteredError();
  }

  const passwordHash = await hashPassword(data.password);

  return prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash,
    },
  });
}
