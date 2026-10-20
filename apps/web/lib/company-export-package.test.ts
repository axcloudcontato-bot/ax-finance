import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { companyExportZip, exportCsv } from "./company-export-package";
import type { buildCompanyFinalExport } from "@ax-finance/domain";

type Archive = Awaited<ReturnType<typeof buildCompanyFinalExport>>;
const content = Buffer.from("%PDF-1.4 teste");
const attachment = {
  id: "a", originalName: "../../arquivo.pdf", sizeBytes: content.length,
  sha256: createHash("sha256").update(content).digest("hex"), mimeType: "application/pdf",
  storageKey: "chave-interna", scanStatus: "CLEAN", storageBackend: "LOCAL",
};
function archive(attachments: unknown[] = [attachment]) {
  return { company: { id: "empresa", name: "Empresa" }, exportedAt: "2026-10-20T12:00:00Z", attachmentMetadata: attachments,
    titles: [{ id: "t", description: "=HYPERLINK(\"malicioso\")", originalAmountCents: BigInt("9007199254740993") }],
    reportSnapshots: [{ id: "v1", payload: { pdfBase64: content.toString("base64") } }],
  } as unknown as Archive;
}
async function collect(value: Archive, read = async () => content, scanRequired = false) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of companyExportZip(value, read, scanRequired)) chunks.push(chunk);
  return unzipSync(Buffer.concat(chunks));
}
it("exporta valores exatos, PDFs e anexos com manifesto verificável e nomes seguros", async () => {
  const zip = await collect(archive());
  const data = JSON.parse(strFromU8(zip["dados.json"]!));
  expect(data.titles[0].originalAmountCents).toBe("9007199254740993");
  expect(data.attachmentMetadata[0].storageKey).toBeUndefined();
  expect(Buffer.from(zip["anexos/a.pdf"]!)).toEqual(content);
  expect(Buffer.from(zip["relatorios/v1.pdf"]!)).toEqual(content);
  expect(strFromU8(zip["planilhas/titles.csv"]!)).toContain("'=HYPERLINK");
  const manifest = JSON.parse(strFromU8(zip["manifesto.json"]!));
  expect(manifest.status).toBe("complete");
  for (const file of manifest.files) {
    expect(zip[file.path]!.length).toBe(file.bytes);
    expect(createHash("sha256").update(zip[file.path]!).digest("hex")).toBe(file.sha256);
  }
});
it("identifica arquivos ausentes, corrompidos e bloqueados sem mascarar pacote parcial", async () => {
  const zip = await collect(archive([
    { ...attachment, id: "ausente" }, { ...attachment, id: "corrompido" }, { ...attachment, id: "bloqueado", scanStatus: "INFECTED" },
  ]), async (...args: unknown[]) => {
    const item = args[0] as { id: string };
    if (item.id === "ausente") throw new Error("Não existe");
    return Buffer.from("corrompido");
  });
  const manifest = JSON.parse(strFromU8(zip["manifesto.json"]!));
  expect(manifest.status).toBe("partial");
  expect(manifest.unavailableAttachments).toHaveLength(3);
  expect(Object.keys(zip).some((name) => name.startsWith("anexos/"))).toBe(false);
});
it("CSV neutraliza fórmulas e preserva aspas, quebras de linha e acentos", () => {
  const csv = exportCsv([{ name: 'Ação;"teste"\nsegunda linha', formula: "\t=1+1" }]);
  expect(csv).toContain('"Ação;""teste""\nsegunda linha"');
  expect(csv).toContain("\"'\t=1+1\"");
});
