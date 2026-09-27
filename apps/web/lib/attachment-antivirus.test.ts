import { afterEach, describe, expect, it } from "vitest";
import { scanAttachment } from "./attachment-antivirus";

const originalHost = process.env.CLAMAV_HOST;
const originalRequired = process.env.ATTACHMENT_SCAN_REQUIRED;

afterEach(() => {
  if (originalHost === undefined) delete process.env.CLAMAV_HOST;
  else process.env.CLAMAV_HOST = originalHost;
  if (originalRequired === undefined) delete process.env.ATTACHMENT_SCAN_REQUIRED;
  else process.env.ATTACHMENT_SCAN_REQUIRED = originalRequired;
});

describe("scanAttachment", () => {
  it("marca como não verificado quando antivírus é opcional e não está configurado", async () => {
    delete process.env.CLAMAV_HOST;
    process.env.ATTACHMENT_SCAN_REQUIRED = "false";
    await expect(scanAttachment(Buffer.from("arquivo"))).resolves.toEqual({ status: "NOT_SCANNED" });
  });

  it("falha de forma segura quando a verificação é obrigatória", async () => {
    delete process.env.CLAMAV_HOST;
    process.env.ATTACHMENT_SCAN_REQUIRED = "true";
    await expect(scanAttachment(Buffer.from("arquivo"))).rejects.toThrow("Antivírus obrigatório");
  });
});
