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

  return (
    <main className="wide">
      <div className="page-header">
        <h1>Transferências</h1>
        <Link href="/transferencias/novo" className="button-link">
          Nova transferência
        </Link>
      </div>

      {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}

      <div className="card">
        {transfers.length === 0 ? (
          <p className="muted">Nenhuma transferência ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Origem</th>
                <th>Destino</th>
                <th>Valor</th>
                <th>Tarifa</th>
                <th></th>
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
                    <td>{formatCents(transfer.amountCents)}</td>
                    <td>{formatCents(transfer.feeCents)}</td>
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
          </table>
        )}
      </div>
    </main>
  );
}
