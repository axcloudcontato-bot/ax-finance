export function formatCents(cents: bigint, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
    Number(cents) / 100
  );
}

/**
 * Lê um valor digitado em um input de texto: "1.234,56", "1234,56", "1234.56" ou "R$ 59,00".
 *
 * A vírgula é o decimal brasileiro. Um grupo de três dígitos depois dela ("2,500", "0,999")
 * NÃO é tratado como milhar: adivinhar isso gravaria um valor mil vezes maior sem aviso, então
 * o texto é recusado (null) e o usuário corrige. A vírgula só funciona como milhar na grafia
 * americana que a comprova ("1,234.56" ou "1,234,567"). Um milhar nunca começa com zero.
 */
export function parseAmountToCentsOrNull(raw: string): number | null {
  const input = raw.trim().replace(/^R\$\s*/, "").replace(/\s/g, "");
  if (!input) return 0;

  let normalized: string;
  if (/^-?[1-9]\d{0,2}(?:\.\d{3})+(?:,\d{1,2})?$/.test(input)) {
    // 1.234 / 1.234,56 / 1.234.567,89: ponto de milhar e vírgula decimal.
    normalized = input.replace(/\./g, "").replace(",", ".");
  } else if (/^-?[1-9]\d{0,2}(?:,\d{3})+\.\d{1,2}$/.test(input) || /^-?[1-9]\d{0,2}(?:,\d{3}){2,}$/.test(input)) {
    // 1,234.56 / 1,234,567: grafia americana, só com decimal ponto ou dois grupos ou mais.
    normalized = input.replace(/,/g, "");
  } else if (/^-?\d+(?:,\d{1,2})?$/.test(input)) {
    normalized = input.replace(",", ".");
  } else if (/^-?\d+(?:\.\d{1,2})?$/.test(input)) {
    normalized = input;
  } else {
    return null;
  }

  const value = Number(normalized);
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function parseAmountToCents(raw: string): number {
  return parseAmountToCentsOrNull(raw) ?? Number.NaN;
}
