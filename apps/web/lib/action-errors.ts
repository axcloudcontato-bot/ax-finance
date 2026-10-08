import { ZodError } from "zod";
import { DomainError } from "@ax-finance/domain";
import { reportServerError } from "./error-reporting";

/** Nomes que o usuário reconhece, para as mensagens de campo inválido. */
const FIELD_LABEL: Record<string, string> = {
  description: "descrição",
  categoryId: "categoria",
  partyId: "cliente/fornecedor",
  costCenterId: "centro de custo",
  financialAccountId: "conta",
  originalAmountCents: "valor",
  totalAmountCents: "valor",
  principalAmountCents: "valor",
  amountCents: "valor",
  limitCents: "limite",
  openingBalanceCents: "saldo",
  targetBalanceCents: "saldo",
  competenceDate: "competência",
  dueDate: "vencimento",
  effectiveDate: "data",
  purchaseDate: "data da compra",
  firstDueDate: "primeiro vencimento",
  openingDate: "data",
  installmentCount: "parcelas",
  closingDay: "dia do fechamento",
  dueDay: "dia do vencimento",
  lastDigits: "final do cartão",
  name: "nome",
  reason: "motivo",
  targetAmountCents: "meta",
  targetDate: "prazo",
  accountId: "conta",
  email: "e-mail",
};

function fieldList(error: ZodError): string {
  const labels = new Set<string>();
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    labels.add(FIELD_LABEL[key] ?? "");
  }
  labels.delete("");
  return [...labels].join(", ");
}

/** Mensagens-padrão do Zod, todas em inglês; só as que o projeto escreveu em português valem para o usuário. */
const ZOD_DEFAULT_MESSAGE = /^(Required|Invalid|String must|Number must|Array must|Expected|Too (small|big)|Unrecognized|Input not)/;

function customMessages(error: ZodError): string[] {
  return [...new Set(error.issues.map((issue) => issue.message).filter((message) => !ZOD_DEFAULT_MESSAGE.test(message)))];
}

/** Next sinaliza redirect/notFound lançando um erro especial: quem o captura por engano precisa devolvê-lo. */
function isNextControlFlow(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND") || digest.startsWith("NEXT_HTTP_ERROR"));
}

/**
 * Texto que o usuário vê quando uma server action falha.
 * - Erro de regra de negócio (DomainError): a mensagem já é escrita para a pessoa.
 * - Campo inválido (Zod): uma frase em português, nunca o JSON do validador.
 * - Qualquer outra coisa é falha nossa (banco, bug): vai para o log e para o canal de alerta, e a
 *   pessoa recebe uma frase simples com um código para informar ao suporte, sem vazar o texto técnico.
 */
export function actionErrorMessage(error: unknown, fallback: string): string {
  if (isNextControlFlow(error)) throw error;
  if (error instanceof DomainError) return error.message;
  if (error instanceof ZodError) {
    const custom = customMessages(error);
    if (custom.length > 0) return custom.join(" ");
    const fields = fieldList(error);
    return fields ? `Confira os campos: ${fields}. Algum valor está vazio ou em formato inválido.` : "Confira os dados informados: algum valor está vazio ou em formato inválido.";
  }
  const ref = reportServerError(error, { source: "action" });
  return `${fallback} Tente novamente; se continuar, informe o código ${ref} ao suporte.`;
}
