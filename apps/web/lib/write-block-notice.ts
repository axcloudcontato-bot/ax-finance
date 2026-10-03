export type WriteBlockReason = "SUSPENDED" | "ENDED" | "TRIAL_ENDED";

export interface WriteBlockNotice {
  /** Muda quando o motivo ou a quem se dirige muda, para um aviso fechado voltar a aparecer. */
  id: string;
  title: string;
  body: string;
  /** Página para regularizar; ausente para quem não pode gerenciar a assinatura. */
  href: string | null;
}

const READ_ONLY = "Você ainda consulta e exporta os dados.";

/**
 * Texto do aviso discreto mostrado enquanto a empresa está bloqueada para escrita. Só o
 * proprietário alcança a página de Assinatura; os demais membros são orientados a falar com ele.
 */
export function writeBlockNotice(reason: WriteBlockReason | null, canManageSubscription: boolean): WriteBlockNotice | null {
  if (!reason) return null;
  const action = canManageSubscription ? null : "Fale com o proprietário da empresa.";
  const href = canManageSubscription ? "/configuracoes/assinatura" : null;
  const id = `${reason}:${canManageSubscription ? "owner" : "member"}`;

  if (reason === "TRIAL_ENDED") {
    return {
      id,
      title: "Avaliação encerrada",
      body: `${canManageSubscription ? "Assine um plano para voltar a lançar." : action} ${READ_ONLY}`,
      href,
    };
  }
  if (reason === "SUSPENDED") {
    return {
      id,
      title: "Lançamentos bloqueados",
      body: `${canManageSubscription ? "A assinatura está suspensa por falta de pagamento. Regularize para voltar a lançar." : `A assinatura está suspensa. ${action}`} ${READ_ONLY}`,
      href,
    };
  }
  return {
    id,
    title: "Assinatura encerrada",
    body: `${canManageSubscription ? "Assine novamente para voltar a lançar." : action} ${READ_ONLY}`,
    href,
  };
}
