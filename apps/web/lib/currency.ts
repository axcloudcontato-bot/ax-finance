export function formatCents(cents: bigint, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
    Number(cents) / 100
  );
}

/** Aceita "1.234,56" ou "1234.56" digitados em um input de texto. */
export function parseAmountToCents(raw: string): number {
  const normalized = raw.trim().replace(/\./g, "").replace(",", ".");
  const value = Number(normalized || raw);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}
