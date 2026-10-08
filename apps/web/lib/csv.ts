/** Seção 12: "Exportações CSV devem proteger contra interpretação de campos como fórmulas." */
function escapeCsvField(value: string | number, separator: string): string {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  if (text.includes(separator) || /["\r\n]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** `separator` ";" é o que o Excel em português espera (a vírgula é o decimal). */
export function toCsv(headers: string[], rows: (string | number)[][], separator = ","): string {
  const lines = [headers, ...rows].map((row) => row.map((field) => escapeCsvField(field, separator)).join(separator));
  return lines.join("\r\n");
}
