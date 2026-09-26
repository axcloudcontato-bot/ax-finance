import { toDateOnlyString, todayDateOnlyString } from "@/lib/dates";

const TONE_CLASSES: Record<string, string> = {
  danger: "bg-red-50 text-red-700",
  warning: "bg-amber-50 text-amber-700",
  info: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  neutral: "bg-black/5 text-muted-foreground",
};

/**
 * "Vencido" nunca é um status gravado (Seção 6) — é calculado aqui, na
 * leitura, comparando vencimento com a data de hoje. Só CANCELLED/SETTLED
 * vêm prontos do banco.
 */
export function TitleStatusBadge({
  status,
  dueDate,
}: {
  status: "OPEN" | "PARTIALLY_SETTLED" | "SETTLED" | "CANCELLED";
  dueDate: Date | string;
}) {
  let label: string;
  let tone: keyof typeof TONE_CLASSES;

  if (status === "CANCELLED") {
    label = "Cancelado";
    tone = "neutral";
  } else if (status === "SETTLED") {
    label = "Quitado";
    tone = "success";
  } else {
    const due = toDateOnlyString(dueDate);
    const today = todayDateOnlyString();

    if (due < today) {
      label = "Vencido";
      tone = "danger";
    } else if (due === today) {
      label = "Vence hoje";
      tone = "warning";
    } else {
      label = "Em aberto";
      tone = "info";
    }

    if (status === "PARTIALLY_SETTLED") {
      label += " · parcial";
    }
  }

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}
