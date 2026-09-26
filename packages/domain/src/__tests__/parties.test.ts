import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createCategory } from "../categories/create-category";
import { createParty } from "../parties/create-party";
import { listParties } from "../parties/list-parties";
import { getParty } from "../parties/get-party";
import { deactivateParty } from "../parties/deactivate-party";
import { createTitle } from "../titles/create-title";
import { getTitle } from "../titles/get-title";
import { PartyDocumentAlreadyExistsError, PartyRoleRequiredError } from "../errors";
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
  const category = await createCategory(user.id, company.id, {
    name: "Serviços",
    nature: "OPERATING_REVENUE",
  });
  return { user, company, category };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("clientes e fornecedores (Seção 10)", () => {
  it("exige ao menos um papel: cliente ou fornecedor", async () => {
    const { user, company } = await setupCompany("roles");

    await expect(
      createParty(user.id, company.id, { name: "Sem papel", isClient: false, isSupplier: false })
    ).rejects.toBeInstanceOf(PartyRoleRequiredError);

    const party = await createParty(user.id, company.id, {
      name: "Cliente e fornecedor",
      isClient: true,
      isSupplier: true,
    });
    expect(party.isClient).toBe(true);
    expect(party.isSupplier).toBe(true);
  });

  it("rejeita documento duplicado na mesma empresa, mas permite entre empresas e homônimos sem documento", async () => {
    const { user, company } = await setupCompany("doc-a");
    const other = await setupCompany("doc-b");

    await createParty(user.id, company.id, {
      name: "Fornecedor Um",
      document: "111.222.333-44",
      isSupplier: true,
    });

    await expect(
      createParty(user.id, company.id, {
        name: "Outro nome, mesmo documento",
        document: "111 222 333 44",
        isSupplier: true,
      })
    ).rejects.toBeInstanceOf(PartyDocumentAlreadyExistsError);

    // Mesmo documento, empresa diferente: permitido.
    const otherCompanyParty = await createParty(other.user.id, other.company.id, {
      name: "Mesmo documento, outra empresa",
      document: "111.222.333-44",
      isSupplier: true,
    });
    expect(otherCompanyParty.documentNormalized).toBe("11122233344");

    // Homônimos sem documento: permitido dentro da mesma empresa.
    const homonym1 = await createParty(user.id, company.id, { name: "Sem Documento", isClient: true });
    const homonym2 = await createParty(user.id, company.id, { name: "Sem Documento", isClient: true });
    expect(homonym1.id).not.toBe(homonym2.id);
  });

  it("isola pessoas entre empresas", async () => {
    const { user, company } = await setupCompany("iso-a");
    const other = await setupCompany("iso-b");

    await createParty(user.id, company.id, { name: "Cliente A", isClient: true });
    await createParty(other.user.id, other.company.id, { name: "Cliente B", isClient: true });

    const partiesForA = await listParties(user.id, company.id);
    expect(partiesForA.map((p) => p.name)).toEqual(["Cliente A"]);
  });

  it("inativação preserva o vínculo com títulos existentes", async () => {
    const { user, company, category } = await setupCompany("inactive");

    const client = await createParty(user.id, company.id, { name: "Cliente Fiel", isClient: true });

    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Serviço prestado",
      categoryId: category.id,
      partyId: client.id,
      originalAmountCents: 10_000,
      competenceDate: "2026-01-10",
      dueDate: "2026-01-20",
    });

    await deactivateParty(user.id, company.id, client.id);

    const activeClients = await listParties(user.id, company.id, { role: "CLIENT", status: "ACTIVE" });
    expect(activeClients).toHaveLength(0);

    const fetchedTitle = await getTitle(user.id, company.id, title.id);
    expect(fetchedTitle.party?.id).toBe(client.id);
    expect(fetchedTitle.party?.status).toBe("INACTIVE");
  });

  it("agrega saldo aberto e vencidos por pessoa", async () => {
    const { user, company, category } = await setupCompany("aggregate");

    const client = await createParty(user.id, company.id, { name: "Cliente Agregado", isClient: true });

    await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Vencido",
      categoryId: category.id,
      partyId: client.id,
      originalAmountCents: 5_000,
      competenceDate: "2026-01-01",
      dueDate: "2026-01-05",
    });
    await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Não vencido",
      categoryId: category.id,
      partyId: client.id,
      originalAmountCents: 7_000,
      competenceDate: "2026-01-01",
      dueDate: "2099-01-01",
    });

    const result = await getParty(user.id, company.id, client.id);
    expect(result.titles).toHaveLength(2);
    expect(result.openTotalCents).toBe(12_000n);
    expect(result.overdueTotalCents).toBe(5_000n);
    expect(result.overdueCount).toBe(1);
  });
});
