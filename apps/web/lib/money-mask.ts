import { parseAmountToCentsOrNull } from "./currency";

/**
 * Máscara dos campos de valor em reais ("1.234,56"): milhar com ponto enquanto digita, vírgula como
 * decimal e no máximo duas casas. É só apresentação: o que vai ao servidor continua sendo lido por
 * `parseAmountToCents`, que aceita exatamente esta grafia.
 */

function group(integerDigits: string): string {
  return integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function fromCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const reais = Math.trunc(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${group(String(reais))},${rest}`;
}

/**
 * Formata o que a pessoa digitou. Ao vivo, o ponto é sempre milhar (o campo mesmo o insere), a vírgula
 * é o decimal e tudo o que não é dígito é descartado. Num texto COLADO ("1234.56", "R$ 1.234,56",
 * "1,234.56") o valor é interpretado pela mesma regra do servidor, para não confundir ponto decimal.
 */
export function formatMoneyInput(raw: string, options: { pasted?: boolean } = {}): string {
  const text = raw.trim().replace(/^R\$\s*/, "");
  if (options.pasted) {
    const cents = parseAmountToCentsOrNull(text);
    if (cents !== null && text !== "") return fromCents(cents);
    // Colou algo que o servidor também recusaria (ex.: "2,500", ambíguo): não adivinha nem corta dígitos.
    if (/\d/.test(text)) return raw;
  }

  const negative = text.startsWith("-");
  const body = text.replace(/[^\d,]/g, "");
  const comma = body.indexOf(",");
  const integerPart = (comma < 0 ? body : body.slice(0, comma)).replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  const decimalPart = comma < 0 ? null : body.slice(comma + 1).replace(/\D/g, "").slice(0, 2);

  if (integerPart === "" && decimalPart === null) return negative ? "-" : "";
  return `${negative ? "-" : ""}${integerPart === "" ? "0" : group(integerPart)}${decimalPart === null ? "" : `,${decimalPart}`}`;
}

/** Ao sair do campo (e ao enviar): completa as casas decimais; "-" sozinho ou vazio volta a vazio. */
export function completeMoneyInput(value: string): string {
  // Mais de duas casas só chega aqui por colagem ambígua: deixa como está para o servidor avisar.
  if (/,\d{3,}/.test(value)) return value;
  const formatted = formatMoneyInput(value);
  if (formatted === "" || formatted === "-") return "";
  const comma = formatted.indexOf(",");
  if (comma < 0) return `${formatted},00`;
  return `${formatted}${"0".repeat(2 - (formatted.length - comma - 1))}`;
}

/** Posição do cursor no texto formatado, mantendo a quantidade de dígitos/vírgula que ficavam antes dele. */
export function caretAfterFormat(before: string, caret: number, after: string): number {
  const significant = (before.slice(0, caret).match(/[\d,]/g) ?? []).length;
  if (significant === 0) return after.startsWith("-") ? Math.min(1, caret) : 0;
  let seen = 0;
  for (let index = 0; index < after.length; index += 1) {
    if (/[\d,]/.test(after[index]!)) seen += 1;
    if (seen === significant) return index + 1;
  }
  return after.length;
}
