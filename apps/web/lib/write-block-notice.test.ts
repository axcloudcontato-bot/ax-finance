import { describe, expect, it } from "vitest";
import { writeBlockNotice } from "./write-block-notice";

describe("aviso de bloqueio de escrita", () => {
  it("não há aviso quando a empresa não está bloqueada", () => {
    expect(writeBlockNotice(null, true)).toBeNull();
    expect(writeBlockNotice(null, false)).toBeNull();
  });

  it("o proprietário recebe o caminho para regularizar", () => {
    const notice = writeBlockNotice("TRIAL_ENDED", true)!;
    expect(notice).toMatchObject({ title: "Avaliação encerrada", href: "/configuracoes/assinatura" });
    expect(notice.body).toContain("Assine um plano para voltar a lançar.");
    expect(notice.body).toContain("consulta e exporta");

    expect(writeBlockNotice("SUSPENDED", true)).toMatchObject({ title: "Lançamentos bloqueados", href: "/configuracoes/assinatura" });
    expect(writeBlockNotice("ENDED", true)).toMatchObject({ title: "Assinatura encerrada", href: "/configuracoes/assinatura" });
  });

  it("os demais membros são orientados a falar com o proprietário, sem link", () => {
    for (const reason of ["TRIAL_ENDED", "SUSPENDED", "ENDED"] as const) {
      const notice = writeBlockNotice(reason, false)!;
      expect(notice.href).toBeNull();
      expect(notice.body).toContain("Fale com o proprietário da empresa.");
      expect(notice.body).not.toContain("Assine");
    }
  });

  it("o id muda com o motivo e com o papel, para o aviso fechado reaparecer quando algo muda", () => {
    const ids = new Set([
      writeBlockNotice("SUSPENDED", true)!.id,
      writeBlockNotice("SUSPENDED", false)!.id,
      writeBlockNotice("ENDED", true)!.id,
      writeBlockNotice("TRIAL_ENDED", true)!.id,
    ]);
    expect(ids.size).toBe(4);
  });
});
