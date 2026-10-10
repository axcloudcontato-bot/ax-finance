import { buildPixBrCode, normalizePixKey } from "@ax-finance/domain";

export interface PixSettingsView {
  pixKey: string | null;
  pixReceiverName: string;
  pixCity: string | null;
}

/**
 * "PIX copia e cola" de um recebível: chave do próprio lançamento quando a forma prevista é PIX e o
 * campo de dados de pagamento tem uma chave válida; senão, a chave da empresa (Entradas → Recebimento por PIX).
 * Sem chave, null (a cobrança sai só com a mensagem, como antes).
 */
export function pixChargeForTitle(settings: PixSettingsView | null, title: { id: string; description: string; remainingCents: bigint; expectedPaymentMethod?: string | null; paymentCode?: string | null }): string | null {
  if (!settings || title.remainingCents <= BigInt(0)) return null;
  const titleKey = title.expectedPaymentMethod === "PIX" ? normalizePixKey(title.paymentCode)?.key : undefined;
  const key = titleKey ?? settings.pixKey;
  if (!key) return null;
  return buildPixBrCode({
    key,
    receiverName: settings.pixReceiverName,
    city: settings.pixCity ?? "BRASIL",
    amountCents: title.remainingCents,
    txid: title.id.replace(/-/g, "").slice(0, 25),
    description: title.description,
  });
}
