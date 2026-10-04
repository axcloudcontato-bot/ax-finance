import Link from "next/link";
import { redirect } from "next/navigation";
import { listTransfers } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { reverseTransferAction } from "./actions";
import { resolvePeriodRange } from "@/lib/month";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function TransferenciasPage(
  props: {
    searchParams: Promise<{ erro?: string; mes?: string; de?: string; ate?: string; periodo?: string; comparar?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const period = resolvePeriodRange(searchParams);
  const transfers = await listTransfers(user.id, company.id, period);
  const effectiveTransfers = transfers.filter((transfer) => !transfer.reversedAt);
  const movedCents = effectiveTransfers.reduce((sum, transfer) => sum + transfer.amountCents, BigInt(0));
  const feeCents = effectiveTransfers.reduce((sum, transfer) => sum + transfer.feeCents, BigInt(0));

  return (
    <main className="wide">
      <div className="page-header">
        <h1>Transferências</h1>
        <Link href="/transferencias/novo" className="button-link workspace-primary-action">
          Nova transferência
        </Link>
      </div>

      <section className="workspace-metrics" aria-label="Resumo das transferências do período">
        <div className="workspace-metric"><span className="workspace-metric-label">Transferido entre contas</span><strong>{formatCents(movedCents)}</strong><span className="workspace-metric-detail">Movimento interno, sem receita ou despesa</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Tarifas</span><strong>{formatCents(feeCents)}</strong><span className="workspace-metric-detail">Custo das transferências efetivas</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Transferências efetivas</span><strong>{effectiveTransfers.length}</strong><span className="workspace-metric-detail">No período selecionado</span></div>
      </section>

      {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}

      <div className="card">
        {transfers.length === 0 ? (
          <div className="workspace-empty"><strong>Nenhuma transferência neste período</strong><p>Movimente valores entre suas contas sem registrar receita ou despesa.</p><Link href="/transferencias/novo" className="button-link">Nova transferência</Link></div>
        ) : (
          <div className="table-scroll"><table className="workspace-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Origem</th>
                <th>Destino</th>
                <th className="money">Valor</th>
                <th className="money">Tarifa</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer) => {
                const reverseAction = reverseTransferAction.bind(null, transfer.id);
                return (
                  <tr key={transfer.id} style={transfer.reversedAt ? { opacity: 0.5 } : undefined}>
                    <td>{formatDateOnly(transfer.transferDate)}</td>
                    <td>{transfer.fromAccount.name}</td>
                    <td>{transfer.toAccount.name}</td>
                    <td className="money">{formatCents(transfer.amountCents)}</td>
                    <td className="money">{formatCents(transfer.feeCents)}</td>
                    <td>
                      {transfer.reversedAt ? (
                        "Estornada"
                      ) : (
                        <form action={reverseAction} className="inline">
                          <input type="hidden" name="reason" value="Estornado pelo usuário" />
                          <SubmitButton className="secondary">
                            Estornar
                          </SubmitButton>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>
    </main>
  );
}
