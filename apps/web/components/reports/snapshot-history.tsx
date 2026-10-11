import Link from "next/link";
import { listReportSnapshots } from "@ax-finance/domain";
import { formatDateOnly } from "@/lib/dates";

export async function SnapshotHistory({ userId, companyId, period }: { userId: string; companyId: string; period?: string }) {
  const versions = await listReportSnapshots(userId, companyId, period);
  return <section className="card"><h2>Versões preservadas</h2>
    <p className="report-caption">Fechar guarda o resultado do mês e a posição da carteira no dia da captura. Reabrir e fechar novamente cria outra versão. PDFs emitidos a partir desta melhoria também ficam disponíveis aqui.</p>
    {versions.length ? <div className="table-scroll"><table className="workspace-table"><thead><tr><th>Mês</th><th>Versão</th><th>Posição da carteira</th><th>Consultar</th></tr></thead><tbody>{versions.map((version) => <tr key={version.id}>
      <td>{version.period}</td><td>{version.kind === "CLOSING" ? "Fechamento" : "PDF"} · {version.version}</td><td>{formatDateOnly(version.asOfDate)}</td>
      <td><div className="report-version-links"><Link href={`/relatorios/mensal?mes=${version.period}&versao=${version.id}`}>Resumo</Link><Link href={`/relatorios/em-aberto?versao=${version.id}`}>Carteira</Link><Link href={`/relatorios/dre?mes=${version.period}&versao=${version.id}`}>DRE</Link><Link href={`/relatorios/rentabilidade?mes=${version.period}&versao=${version.id}`}>Rentabilidade</Link><a href={`/api/reports/monthly-pdf?mes=${version.period}&versao=${version.id}`} target="_blank" rel="noopener">PDF original</a></div></td>
    </tr>)}</tbody></table></div> : <p className="muted">Nenhuma versão guardada. O primeiro fechamento ou a primeira emissão de PDF inicia o histórico.</p>}
  </section>;
}
