/**
 * Emissores (bancos e fintechs) que o cartão pode ter. O sistema não guarda logo nenhuma: as marcas
 * são registradas de cada banco, então a tela mostra um selo na cor aproximada da marca com a
 * sigla. A chave é o que vai para o banco; nome, sigla e cores são só apresentação.
 */
export interface CreditCardIssuer {
  key: string;
  name: string;
  /** Até 3 letras no selo. */
  initials: string;
  /** Fundo do selo. */
  color: string;
  /** Cor do texto do selo, escolhida para ter contraste com o fundo. */
  textColor: string;
}

export const CREDIT_CARD_ISSUERS: readonly CreditCardIssuer[] = [
  { key: "NUBANK", name: "Nubank", initials: "Nu", color: "#820AD1", textColor: "#FFFFFF" },
  { key: "ITAU", name: "Itaú", initials: "It", color: "#EC7000", textColor: "#FFFFFF" },
  { key: "BRADESCO", name: "Bradesco", initials: "Br", color: "#CC092F", textColor: "#FFFFFF" },
  { key: "SANTANDER", name: "Santander", initials: "Sa", color: "#EC0000", textColor: "#FFFFFF" },
  { key: "BANCO_DO_BRASIL", name: "Banco do Brasil", initials: "BB", color: "#FAE128", textColor: "#003DA5" },
  { key: "CAIXA", name: "Caixa", initials: "Cx", color: "#005CA9", textColor: "#FFFFFF" },
  { key: "INTER", name: "Inter", initials: "In", color: "#FF7A00", textColor: "#FFFFFF" },
  { key: "C6", name: "C6 Bank", initials: "C6", color: "#242424", textColor: "#FFFFFF" },
  { key: "XP", name: "XP", initials: "XP", color: "#111111", textColor: "#FFD400" },
  { key: "BTG", name: "BTG Pactual", initials: "BTG", color: "#001E62", textColor: "#FFFFFF" },
  { key: "MERCADO_PAGO", name: "Mercado Pago", initials: "MP", color: "#00B1EA", textColor: "#FFFFFF" },
  { key: "PICPAY", name: "PicPay", initials: "Pic", color: "#21C25E", textColor: "#FFFFFF" },
  { key: "PAGBANK", name: "PagBank", initials: "Pag", color: "#2DC15C", textColor: "#FFFFFF" },
  { key: "NEON", name: "Neon", initials: "Ne", color: "#00E5E5", textColor: "#0B3B3B" },
  { key: "NEXT", name: "Next", initials: "Nx", color: "#00FF5F", textColor: "#0B2E17" },
  { key: "WILL", name: "Will Bank", initials: "Wi", color: "#FFE500", textColor: "#222222" },
  { key: "ORIGINAL", name: "Original", initials: "Or", color: "#00A859", textColor: "#FFFFFF" },
  { key: "SAFRA", name: "Safra", initials: "Sf", color: "#0A2D5B", textColor: "#FFFFFF" },
  { key: "SICREDI", name: "Sicredi", initials: "Si", color: "#3FA535", textColor: "#FFFFFF" },
  { key: "SICOOB", name: "Sicoob", initials: "Sc", color: "#003641", textColor: "#FFFFFF" },
  { key: "BANRISUL", name: "Banrisul", initials: "Ba", color: "#0A4DA2", textColor: "#FFFFFF" },
  { key: "BRB", name: "BRB", initials: "BRB", color: "#0A5CA8", textColor: "#FFFFFF" },
  { key: "OTHER", name: "Outro emissor", initials: "•••", color: "#64748B", textColor: "#FFFFFF" },
] as const;

export const CREDIT_CARD_ISSUER_KEYS = CREDIT_CARD_ISSUERS.map((issuer) => issuer.key) as [string, ...string[]];

export function findCreditCardIssuer(key: string | null | undefined): CreditCardIssuer | null {
  return CREDIT_CARD_ISSUERS.find((issuer) => issuer.key === key) ?? null;
}
