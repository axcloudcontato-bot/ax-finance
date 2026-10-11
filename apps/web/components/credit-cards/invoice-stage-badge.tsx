import type { InvoiceStage } from "@ax-finance/domain";

const STAGE: Record<InvoiceStage, { label: string; className: string }> = {
  OPEN: { label: "Aberta", className: "bg-blue-50 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300" },
  FUTURE: { label: "Futura", className: "bg-black/5 text-muted-foreground dark:bg-white/10" },
  CLOSED: { label: "Fechada", className: "bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300" },
  OVERDUE: { label: "Vencida", className: "bg-red-50 text-red-700 dark:bg-red-400/15 dark:text-red-300" },
  PAID: { label: "Paga", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300" },
  EMPTY: { label: "Sem compras", className: "bg-black/5 text-muted-foreground dark:bg-white/10" },
};

export function InvoiceStageBadge({ stage }: { stage: InvoiceStage }) {
  const { label, className } = STAGE[stage];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>;
}
