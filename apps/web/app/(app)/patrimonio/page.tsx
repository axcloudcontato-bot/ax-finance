import Link from "next/link";
import { redirect } from "next/navigation";
import { getNetWorth } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly, todayDateOnlyString } from "@/lib/dates";
import { ActionModal } from "@/components/ui/action-modal";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { SubmitButton } from "@/components/ui/submit-button";
import { ASSET_KIND_LABEL } from "@/lib/wealth-labels";
import { createAssetAction, deleteAssetAction, updateAssetAction } from "../dividas/actions";

const ZERO = BigInt(0);

function toInput(cents: bigint): string {
  return (Number(cents) / 100).toFixed(2).replace(".", ",");
}

function AssetForm({ action, defaults, idPrefix, submitLabel }: { action: (formData: FormData) => void | Promise<void>; defaults?: { name: string; kind: string; valueCents: bigint; valuedAt: Date; notes: string | null }; idPrefix: string; submitLabel: string }) {
  return (
    <form action={action}>
      <div className="form-grid">
        <div className="span-2"><label htmlFor={`${idPrefix}-name`}>Nome</label><input id={`${idPrefix}-name`} name="name" type="text" required maxLength={120} placeholder="Ex.: Tesouro Selic, Apartamento, Carro" defaultValue={defaults?.name} /></div>
        <div><label htmlFor={`${idPrefix}-kind`}>Tipo</label><select id={`${idPrefix}-kind`} name="kind" defaultValue={defaults?.kind ?? "INVESTMENT"}>{Object.entries(ASSET_KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div><label htmlFor={`${idPrefix}-value`}>Valor atual (R$)</label><input id={`${idPrefix}-value`} name="value" type="text" inputMode="decimal" placeholder="0,00" required defaultValue={defaults ? toInput(defaults.valueCents) : undefined} /></div>
        <div><label htmlFor={`${idPrefix}-date`}>Valor em</label><input id={`${idPrefix}-date`} name="valuedAt" type="date" required defaultValue={defaults ? defaults.valuedAt.toISOString().slice(0, 10) : todayDateOnlyString()} /></div>
        <div><label htmlFor={`${idPrefix}-notes`}>Observação (opcional)</label><input id={`${idPrefix}-notes`} name="notes" type="text" maxLength={500} defaultValue={defaults?.notes ?? ""} /></div>
      </div>
      <p className="field-note">Use o valor de mercado ou o saldo do extrato da corretora. Atualize de tempos em tempos para o patrimônio ficar fiel.</p>
      <div className="form-actions"><SubmitButton>{submitLabel}</SubmitButton></div>
    </form>
  );
}

export default async function NetWorthPage(props: { searchParams: Promise<{ erro?: string; acao?: string; bem?: string; bemSalvo?: string; bemExcluido?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  const worth = await getNetWorth(user.id, company.id);
  const refreshKey = [searchParams.erro, searchParams.bemSalvo, searchParams.bemExcluido].join("|");

  const assetRows = [
    { label: "Contas", cents: worth.accountsCents, href: "/contas" },
    { label: "Cofrinhos", cents: worth.savingsCents, href: "/cofrinhos" },
    { label: "Bens e investimentos", cents: worth.assetsCents, href: "#bens" },
  ];
  const liabilityRows = [
    { label: "Dívidas (saldo devedor)", cents: worth.debtsCents, href: "/dividas" },
    ...(worth.cardsAvailable ? [{ label: "Cartões (faturas e parcelas)", cents: worth.cardDebtCents, href: "/cartoes" }] : []),
  ];
  const share = (cents: bigint, total: bigint) => (total > ZERO && cents > ZERO ? Math.max(1, Number((cents * BigInt(1000)) / total) / 10) : 0);

  return (
    <main className="wide wealth-page">
      <div className="page-header">
        <div>
          <h1>Patrimônio</h1>
          <p className="subtitle">Tudo o que você tem menos tudo o que você deve, na posição de {formatDateOnly(worth.today)}.</p>
        </div>
        <ActionModal key={`novo-${refreshKey}`} triggerLabel="+ Bem ou investimento" triggerClassName="button-link workspace-primary-action" title="Novo bem ou investimento" size="wide" initiallyOpen={Boolean(searchParams.erro) && searchParams.acao === "novo"}>
          {searchParams.erro && searchParams.acao === "novo" ? <p className="error">{searchParams.erro}</p> : null}
          <AssetForm action={createAssetAction} idPrefix="novo-bem" submitLabel="Cadastrar" />
        </ActionModal>
      </div>

      {searchParams.erro && !searchParams.acao && !searchParams.bem ? <p className="error">{searchParams.erro}</p> : null}
      {searchParams.bemSalvo ? <p className="success-box">Bem salvo. O patrimônio já foi recalculado.</p> : null}
      {searchParams.bemExcluido ? <p className="success-box">Bem excluído.</p> : null}

      <section className="workspace-metrics" aria-label="Patrimônio">
        <div className="workspace-metric workspace-metric-primary"><span className="workspace-metric-label">Patrimônio líquido</span><strong className={worth.netWorthCents < ZERO ? "negative" : undefined}>{formatCents(worth.netWorthCents)}</strong><span className="workspace-metric-detail">O que tem − o que deve</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">O que você tem</span><strong className="positive">{formatCents(worth.totalAssetsCents)}</strong><span className="workspace-metric-detail">Contas, cofrinhos, bens e investimentos</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">O que você deve</span><strong className="negative">{formatCents(worth.totalLiabilitiesCents)}</strong><span className="workspace-metric-detail">Dívidas e cartões</span></div>
      </section>

      <div className="dashboard-insight-grid">
        <section className="card dashboard-insight-section">
          <div className="dashboard-section-heading"><div><h2>O que você tem</h2><p>{formatCents(worth.totalAssetsCents)}</p></div></div>
          <ul className="wealth-bars">
            {assetRows.map((row) => (
              <li key={row.label}>
                <Link href={row.href}>{row.label}</Link>
                <span className="wealth-bar is-asset"><i style={{ width: `${share(row.cents, worth.totalAssetsCents)}%` }} /></span>
                <strong className={row.cents < ZERO ? "negative" : undefined}>{formatCents(row.cents)}</strong>
              </li>
            ))}
          </ul>
        </section>
        <section className="card dashboard-insight-section">
          <div className="dashboard-section-heading"><div><h2>O que você deve</h2><p>{formatCents(worth.totalLiabilitiesCents)}</p></div></div>
          <ul className="wealth-bars">
            {liabilityRows.map((row) => (
              <li key={row.label}>
                <Link href={row.href}>{row.label}</Link>
                <span className="wealth-bar is-liability"><i style={{ width: `${share(row.cents, worth.totalLiabilitiesCents)}%` }} /></span>
                <strong>{formatCents(row.cents)}</strong>
              </li>
            ))}
          </ul>
          {worth.debts.length ? <p className="field-note">{worth.debts.map((debt) => `${debt.name}: ${formatCents(debt.balanceCents)}`).join(" · ")}</p> : null}
          <p className="field-note">Contas a pagar do dia a dia não entram aqui: são gastos, não dívida. As parcelas das dívidas cadastradas já estão no saldo devedor.</p>
        </section>
      </div>

      <section className="card" id="bens">
        <div className="workspace-card-heading"><div><h2>Bens e investimentos</h2><p>Valores que você informa: aplicações, imóveis, veículos e outros bens.</p></div></div>
        {worth.assets.length === 0 ? <p className="muted">Nenhum bem ou investimento cadastrado. Use &ldquo;+ Bem ou investimento&rdquo; no topo.</p> : (
          <div className="table-scroll">
            <table className="workspace-table">
              <thead><tr><th>Nome</th><th>Tipo</th><th className="money">Valor</th><th>Atualizado em</th><th><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {worth.assets.map((asset) => (
                  <tr key={asset.id}>
                    <td><strong>{asset.name}</strong>{asset.notes ? <small className="title-row-meta"><span>{asset.notes}</span></small> : null}</td>
                    <td>{ASSET_KIND_LABEL[asset.kind]}</td>
                    <td className="money">{formatCents(asset.valueCents)}</td>
                    <td>{formatDateOnly(asset.valuedAt)}</td>
                    <td>
                      <RowActionsMenu>
                        <ActionModal key={`editar-${asset.id}-${refreshKey}`} triggerLabel="Atualizar valor" title={`Atualizar — ${asset.name}`} size="wide" initiallyOpen={searchParams.bem === asset.id && Boolean(searchParams.erro)}>
                          {searchParams.bem === asset.id && searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
                          <AssetForm action={updateAssetAction.bind(null, asset.id)} defaults={asset} idPrefix={`bem-${asset.id}`} submitLabel="Salvar" />
                        </ActionModal>
                        <form action={deleteAssetAction.bind(null, asset.id)} className="inline"><SubmitButton className="secondary">Excluir</SubmitButton></form>
                      </RowActionsMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
