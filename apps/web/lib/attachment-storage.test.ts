import { describe, expect, it } from "vitest";
import { detectAttachmentMime, safeOriginalFileName } from "./attachment-storage";

describe("validação de conteúdo de anexos", () => {
  it("detecta os formatos permitidos pela assinatura binária", () => {
    expect(detectAttachmentMime(Buffer.from("%PDF-1.7\nconteudo"))).toBe("application/pdf");
    expect(detectAttachmentMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectAttachmentMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
  });

  it("rejeita executável renomeado e remove caminhos do nome original", () => {
    expect(detectAttachmentMime(Buffer.from("MZ executavel"))).toBeNull();
    expect(safeOriginalFileName("../../nota fiscal.pdf")).toBe("nota fiscal.pdf");
  });
});
