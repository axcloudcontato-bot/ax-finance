import Link from "next/link";
import { addMonths, monthLabel } from "@/lib/month";

export function MonthSelector({
  month,
  buildHref,
}: {
  month: string;
  buildHref: (month: string) => string;
}) {
  return (
    <div className="month-selector">
      <Link href={buildHref(addMonths(month, -1))} aria-label="Mês anterior">
        ‹
      </Link>
      <span>{monthLabel(month)}</span>
      <Link href={buildHref(addMonths(month, 1))} aria-label="Próximo mês">
        ›
      </Link>
    </div>
  );
}
