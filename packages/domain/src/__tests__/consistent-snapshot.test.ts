import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, expect, it } from "vitest";
import { withCompanyContext, withCompanyReadSnapshot, withUserContext } from "@ax-finance/db";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { rootClient, resetDatabase } from "./test-db";

beforeEach(resetDatabase);
afterAll(() => rootClient.$disconnect());

it("mantém a mesma visão entre serviços mesmo com uma escrita concorrente confirmada", async () => {
  const user = await registerUser({ email: `${randomUUID()}@snapshot.test`, name: "Teste", password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: "Antes" });
  await withCompanyReadSnapshot(user.id, company.id, async (tx) => {
    expect((await tx.company.findUniqueOrThrow({ where: { id: company.id } })).name).toBe("Antes");
    await rootClient.company.update({ where: { id: company.id }, data: { name: "Depois" } });
    const nested = await withCompanyContext(user.id, company.id, (inner) => inner.company.findUniqueOrThrow({ where: { id: company.id } }));
    expect(nested.name).toBe("Antes");
    await expect(withCompanyContext(user.id, randomUUID(), async () => true)).rejects.toThrow("incompatível");
    await expect(withUserContext(randomUUID(), async () => true)).rejects.toThrow("incompatível");
  });
  expect((await withCompanyContext(user.id, company.id, (tx) => tx.company.findUniqueOrThrow({ where: { id: company.id } }))).name).toBe("Depois");
});

it("o banco recusa uma escrita acidental no escopo de leitura", async () => {
  const user = await registerUser({ email: `${randomUUID()}@snapshot.test`, name: "Teste", password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: "Preservada" });
  await expect(withCompanyReadSnapshot(user.id, company.id, (tx) => tx.company.update({ where: { id: company.id }, data: { name: "Indevida" } }))).rejects.toThrow();
  expect((await rootClient.company.findUniqueOrThrow({ where: { id: company.id } })).name).toBe("Preservada");
});
