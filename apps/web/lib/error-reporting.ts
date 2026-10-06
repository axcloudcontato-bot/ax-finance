import { randomBytes } from "node:crypto";
import { logOperationalError, operationalErrorFingerprint, structuredLog } from "@ax-finance/domain";

/**
 * Monitoramento de erro sem serviço externo: cada falha não prevista vira uma linha de log JSON
 * (`web.unhandled_error`) e, se ALERT_WEBHOOK_URL estiver configurada, um alerta no mesmo canal
 * do worker. O que sai é só nome/código do erro, rota-modelo e referência: nunca mensagem, corpo,
 * valores, e-mails nem o caminho com ids (um erro de banco pode carregar dado financeiro no texto).
 *
 * `errorRef` é um código curto que o usuário vê na tela e que também vai no log: com ele o suporte
 * acha a linha exata sem pedir print.
 */

const lastAlertAt = new Map<string, number>();

function cooldownMs(): number {
  const minutes = Number(process.env.ALERT_COOLDOWN_MINUTES);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 30) * 60_000;
}

export function newErrorRef(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export interface ErrorReportContext {
  /** De onde veio: ação de formulário, renderização de página, rota de API... */
  source: "action" | "request" | "boundary";
  /** Rota no formato do Next ("/saidas/[titleId]"), nunca o caminho real. */
  route?: string;
  method?: string;
  /** Digest que o Next gera para erros de renderização; ajuda a casar a tela com o log. */
  digest?: string;
}

/**
 * Registra o erro e devolve a referência. Nunca lança: monitorar não pode derrubar a requisição que
 * já falhou. O alerta externo é deduplicado por tipo de erro + rota (padrão 30 min).
 */
export function reportServerError(error: unknown, context: ErrorReportContext, now: Date = new Date()): string {
  const errorRef = newErrorRef();
  try {
    logOperationalError("web.unhandled_error", error, {
      errorRef,
      source: context.source,
      route: context.route,
      method: context.method,
      digest: context.digest,
    });
    void sendAlert(error, context, errorRef, now);
  } catch {
    // Último recurso: se até o log falhar, o usuário ainda recebe a referência.
  }
  return errorRef;
}

async function sendAlert(error: unknown, context: ErrorReportContext, errorRef: string, now: Date) {
  const webhook = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!webhook) return;

  const fingerprint = operationalErrorFingerprint(error);
  const key = `${fingerprint}|${context.route ?? "-"}`;
  const previous = lastAlertAt.get(key) ?? 0;
  if (now.getTime() - previous < cooldownMs()) return;
  lastAlertAt.set(key, now.getTime());
  // Evita crescer sem limite num processo longo com muitos erros diferentes.
  if (lastAlertAt.size > 500) lastAlertAt.delete(lastAlertAt.keys().next().value as string);

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service: "ax-finance",
        environment: process.env.DEPLOY_ENVIRONMENT || "production",
        alertCode: "web_unhandled_error",
        summary: `Erro não tratado (${fingerprint}) em ${context.route ?? "rota desconhecida"}. Ref ${errorRef}.`,
        value: 1,
        timestamp: now.toISOString(),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw Object.assign(new Error("AlertWebhookRejected"), { code: `HTTP_${response.status}` });
  } catch (alertError) {
    structuredLog("warn", "web.alert_delivery_failed", { errorFingerprint: operationalErrorFingerprint(alertError) });
  }
}

/** Só para testes: zera o controle de repetição dos alertas. */
export function resetErrorReportingForTests() {
  lastAlertAt.clear();
}
