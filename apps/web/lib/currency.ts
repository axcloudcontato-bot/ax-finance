export function formatCents(cents: bigint, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
    Number(cents) / 100
  );
}

/** Aceita "1.234,56" ou "1234.56" digitados em um input de texto. */
export function parseAmountToCentsOrNull(raw: string): number | null {
  const input = raw.trim().replace(/^R\$\s*/, "").replace(/\s/g, "");
  if (!input) return 0;

  let normalized: string;
  if (/^-?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(input)) {
    normalized = input.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(input)) {
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
