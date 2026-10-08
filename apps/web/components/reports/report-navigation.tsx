import Link from "next/link";

export function ReportNavigation({ active, from, to, comparison }: { active: "cash" | "aging" | "dre"; from?: string; to?: string; comparison?: string }) {
  const query = new URLSearchParams();
  if (from && to) { query.set("de", from); query.set("ate", to); }
  if (comparison) query.set("comparar", comparison);
  const suffix = query.size ? `?${query}` : "";
  return <nav className="report-navigation" aria-label="Relatórios financeiros">
    <Link href={`/relatorios/fluxo-de-caixa${suffix}`} aria-current={active === "cash" ? "page" : undefined}>Fluxo de caixa</Link>
    <Link href="/relatorios/em-aberto" aria-current={active === "aging" ? "page" : undefined}>Contas a receber/pagar</Link>
    <Link href={`/relatorios/dre${suffix}`} aria-current={active === "dre" ? "page" : undefined}>DRE gerencial</Link>
  </nav>;
}
