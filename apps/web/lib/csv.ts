/** Seção 12: "Exportações CSV devem proteger contra interpretação de campos como fórmulas." */
function escapeCsvField(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  if (/["\r\n,]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(","));
  return lines.join("\r\n");
}
