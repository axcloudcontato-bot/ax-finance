import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTitleAttachment, deleteTitleAttachment, getTitleAttachment, listTitleAttachments } from "../attachments";
import { createCategory } from "../categories/create-category";
import { createCompany } from "../companies/create-company";
import { AttachmentNotFoundError } from "../errors";
import { registerUser } from "../identity/register";
import { createTitle } from "../titles/create-title";
import { deleteTitle } from "../titles/delete-title";
import { rootClient, resetDatabase } from "./test-db";

async function setup(label: string) {
  const user = await registerUser({
    email: `attachment.${label}.${randomUUID()}@teste.ax.finance`,
    name: `Pessoa ${label}`,
    password: "senha-forte-123",
  });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const category = await createCategory(user.id, company.id, { name: "Documentos", nature: "OPERATING_REVENUE" });
  const title = await createTitle(user.id, company.id, {
    type: "RECEIVABLE",
    description: "Título com comprovante",
    categoryId: category.id,
    originalAmountCents: 10_000,
    competenceDate: "2026-09-01",
    dueDate: "2026-09-30",
    idempotencyKey: randomUUID(),
  });
  return { user, company, title };
}

function metadata(companyId: string, titleId: string) {
  const id = randomUUID();
  return {
    id,
    originalName: "nota-fiscal.pdf",
    mimeType: "application/pdf" as const,
    sizeBytes: 1234,
    sha256: "a".repeat(64),
    storageKey: `${companyId}/${titleId}/${id}`,
  };
}

beforeEach(async () => resetDatabase());
afterAll(async () => rootClient.$disconnect());

describe("anexos privados de títulos", () => {
  it("cria, lista, consulta e remove metadados com auditoria", async () => {
    const { user, company, title } = await setup("crud");
    const created = await createTitleAttachment(user.id, company.id, title.id, metadata(company.id, title.id));
    expect((await listTitleAttachments(user.id, company.id, title.id))[0]).toMatchObject({
      id: created.id,
      originalName: "nota-fiscal.pdf",
    });
    expect(await getTitleAttachment(user.id, company.id, created.id)).toMatchObject({ titleId: title.id });
    expect(await rootClient.auditEvent.count({ where: { eventType: "ATTACHMENT_ADDED" } })).toBe(1);

    await deleteTitleAttachment(user.id, company.id, created.id);
    await expect(getTitleAttachment(user.id, company.id, created.id)).rejects.toBeInstanceOf(AttachmentNotFoundError);
    expect(await rootClient.auditEvent.count({ where: { eventType: "ATTACHMENT_DELETED" } })).toBe(1);
  });

  it("isola anexos entre empresas", async () => {
    const owner = await setup("owner");
    const outsider = await setup("outsider");
    const created = await createTitleAttachment(
      owner.user.id,
      owner.company.id,
      owner.title.id,
      metadata(owner.company.id, owner.title.id)
    );
    await expect(getTitleAttachment(outsider.user.id, outsider.company.id, created.id))
      .rejects.toBeInstanceOf(AttachmentNotFoundError);
  });

  it("o soft delete do título preserva metadados e o objeto para auditoria", async () => {
    const { user, company, title } = await setup("cascade");
    const input = metadata(company.id, title.id);
    await createTitleAttachment(user.id, company.id, title.id, input);
    await deleteTitle(user.id, company.id, title.id, { reason: "Teste de retenção" });
    expect(await rootClient.attachment.count()).toBe(1);
    expect(await rootClient.title.findUnique({ where: { id: title.id } })).toMatchObject({
      deleteReason: "Teste de retenção",
    });
  });
});
