import type { InvoiceStage } from "@ax-finance/domain";

const STAGE: Record<InvoiceStage, { label: string; className: string }> = {
  OPEN: { label: "Aberta", className: "bg-blue-50 text-blue-700" },
  FUTURE: { label: "Futura", className: "bg-black/5 text-muted-foreground" },
  CLOSED: { label: "Fechada", className: "bg-amber-50 text-amber-700" },
  OVERDUE: { label: "Vencida", className: "bg-red-50 text-red-700" },
  PAID: { label: "Paga", className: "bg-emerald-50 text-emerald-700" },
  EMPTY: { label: "Sem compras", className: "bg-black/5 text-muted-foreground" },
};

export function InvoiceStageBadge({ stage }: { stage: InvoiceStage }) {
  const { label, className } = STAGE[stage];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>;
}
