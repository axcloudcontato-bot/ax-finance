import Link from "next/link";

export function ReportNavigation({ active, from, to, comparison, snapshotId, snapshotMonth }: { active: "cash" | "aging" | "dre" | "profitability"; from?: string; to?: string; comparison?: string; snapshotId?: string; snapshotMonth?: string }) {
  const query = new URLSearchParams();
  if (from && to) { query.set("de", from); query.set("ate", to); }
  if (comparison) query.set("comparar", comparison);
  const suffix = query.size ? `?${query}` : "";
  const preserved = new URLSearchParams(query);
  if (snapshotMonth) preserved.set("mes", snapshotMonth);
  if (snapshotId) preserved.set("versao", snapshotId);
  const reportSuffix = preserved.size ? `?${preserved}` : "";
  return <nav className="report-navigation" aria-label="Relatórios financeiros">
    <Link href={`/relatorios/fluxo-de-caixa${suffix}`} aria-current={active === "cash" ? "page" : undefined}>Fluxo de caixa{snapshotId ? " (atual)" : ""}</Link>
    <Link href={`/relatorios/em-aberto${snapshotId ? `?versao=${snapshotId}` : ""}`} aria-current={active === "aging" ? "page" : undefined}>Contas a receber/pagar</Link>
    <Link href={`/relatorios/dre${reportSuffix}`} aria-current={active === "dre" ? "page" : undefined}>DRE gerencial</Link>
    <Link href={`/relatorios/rentabilidade${reportSuffix}`} aria-current={active === "profitability" ? "page" : undefined}>Rentabilidade</Link>
  </nav>;
}
