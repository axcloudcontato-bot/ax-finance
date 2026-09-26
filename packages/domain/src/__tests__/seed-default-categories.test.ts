import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createCategory } from "../categories/create-category";
import { listCategories } from "../categories/list-categories";
import { seedDefaultCategories } from "../categories/seed-default-categories";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

async function setupCompany(label: string) {
  const user = await registerUser({
    email: uniqueEmail(label),
    name: `Usuária ${label}`,
    password: "senha-forte-123",
  });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  return { user, company };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("categorias padrão (onboarding)", () => {
  it("cria categorias e subcategorias de topo prontas pra usar", async () => {
    const { user, company } = await setupCompany("seed-cat");

    await seedDefaultCategories(user.id, company.id);

    const categories = await listCategories(user.id, company.id);
    expect(categories.length).toBeGreaterThan(10);

    const topLevel = categories.filter((c) => !c.parentId);
    const subLevel = categories.filter((c) => c.parentId);
    expect(topLevel.length).toBeGreaterThan(0);
    expect(subLevel.length).toBeGreaterThan(0);

    const receita = topLevel.find((c) => c.name === "Receita de serviços");
    expect(receita?.nature).toBe("OPERATING_REVENUE");
    expect(subLevel.some((c) => c.parentId === receita?.id && c.name === "Serviços prestados")).toBe(true);

    // São categorias comuns — dá pra arquivar/recriar por cima normalmente.
    expect(categories.every((c) => c.status === "ACTIVE")).toBe(true);
  });

  it("não duplica se a empresa já tiver alguma categoria", async () => {
    const { user, company } = await setupCompany("seed-cat-dup");

    await createCategory(user.id, company.id, { name: "Manual", nature: "EXPENSE" });
    await seedDefaultCategories(user.id, company.id);

    const categories = await listCategories(user.id, company.id);
    expect(categories).toHaveLength(1);
    expect(categories[0]?.name).toBe("Manual");
  });

  it("isola entre empresas", async () => {
    const owner = await setupCompany("seed-cat-iso-owner");
    const outsider = await setupCompany("seed-cat-iso-outsider");

    await seedDefaultCategories(owner.user.id, owner.company.id);

    const outsiderCategories = await listCategories(outsider.user.id, outsider.company.id);
    expect(outsiderCategories).toHaveLength(0);
  });
});
