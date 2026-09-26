import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";
import {
  CompanyAccessDeniedError,
  assertActiveMembership,
  generateDueOccurrences,
  getMonthlyCashFlowSeries,
  listActiveCategories,
  listCompaniesForUser,
  listFinancialAccountsWithBalance,
  listParties,
  listTitles,
} from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { formatCents } from "@/lib/currency";
import { toDateOnlyString, todayDateOnlyString } from "@/lib/dates";
import { currentYearMonth, monthRange } from "@/lib/month";
import { filterCategoriesByTitleType, sortCategoriesTree } from "@/lib/categories";
import { Reveal } from "@/components/gsap/reveal";
import { StatCard } from "@/components/dashboard/stat-card";
import { TitleDetailList } from "@/components/dashboard/title-detail-list";
import { CashFlowLineChart } from "@/components/dashboard/cash-flow-line-chart";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { Modal } from "@/components/ui/modal";
import { TitleForm } from "@/components/titles/title-form";
import { createEntradaAction, createEntradaAndContinueAction } from "../entradas/actions";
import { createSaidaAction, createSaidaAndContinueAction } from "../saidas/actions";

type TitleList = Awaited<ReturnType<typeof listTitles>>;

function summarizeOpenTitles(titles: TitleList) {
  const today = todayDateOnlyString();

  const open = titles.filter((title) => title.status === "OPEN" || title.status === "PARTIALLY_SETTLED");
  const totalCents = open.reduce((sum, title) => sum + title.remainingCents, BigInt(0));
  const overdue = open.filter((title) => toDateOnlyString(title.dueDate) < today);
  const overdueCount = overdue.length;
  const overdueCents = overdue.reduce((sum, title) => sum + title.remainingCents, BigInt(0));

  return { totalCents, overdueCount, overdueCents, open, overdue };
}

function filterByDueMonth(titles: TitleList, from: string, to: string): TitleList {
  return titles.filter((title) => {
    const due = toDateOnlyString(title.dueDate);
    return due >= from && due <= to;
  });
}

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  BANK: "Conta bancária",
  CASH: "Dinheiro em caixa",
  WALLET: "Carteira de recebimentos",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { empresa?: string; mes?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const companies = await listCompaniesForUser(user.id);
  if (companies.length === 0) {
    redirect("/onboarding");
  }

  const activeCompanyId = searchParams.empresa ?? companies[0]!.id;
  const month = searchParams.mes ?? currentYearMonth();
  const { from: monthFrom, to: monthTo } = monthRange(month);

  let accounts: Awaited<ReturnType<typeof listFinancialAccountsWithBalance>>;
  try {
    await assertActiveMembership(user.id, activeCompanyId);
    await generateDueOccurrences(user.id, activeCompanyId);
    accounts = await listFinancialAccountsWithBalance(user.id, activeCompanyId);
  } catch (error) {
    if (error instanceof CompanyAccessDeniedError) {
      // Empresa na URL não existe ou não é sua: cai de volta para a primeira
      // que você realmente tem acesso, sem confirmar se o id era válido.
      redirect(`/dashboard?empresa=${companies[0]!.id}&mes=${month}`);
    }
    throw error;
  }

  const totalCents = accounts
    .filter((account) => account.includedInAvailableTotal)
    .reduce((sum, account) => sum + account.currentBalanceCents, BigInt(0));

  const [receivables, payables, cashFlowSeries, categories, clients, suppliers] = await Promise.all([
    listTitles(user.id, activeCompanyId, { type: "RECEIVABLE" }),
    listTitles(user.id, activeCompanyId, { type: "PAYABLE" }),
    getMonthlyCashFlowSeries(user.id, activeCompanyId, { months: 6, endMonth: month }),
    listActiveCategories(user.id, activeCompanyId),
    listParties(user.id, activeCompanyId, { role: "CLIENT", status: "ACTIVE" }),
    listParties(user.id, activeCompanyId, { role: "SUPPLIER", status: "ACTIVE" }),
  ]);

  // Cards do topo: só títulos com vencimento dentro do mês selecionado.
  const toReceiveMonth = summarizeOpenTitles(filterByDueMonth(receivables, monthFrom, monthTo));
  const toPayMonth = summarizeOpenTitles(filterByDueMonth(payables, monthFrom, monthTo));
  const overdueTotalCents = toReceiveMonth.overdueCents + toPayMonth.overdueCents;
  const overdueTotalCount = toReceiveMonth.overdueCount + toPayMonth.overdueCount;
  const overdueTitlesMonth = [...toReceiveMonth.overdue, ...toPayMonth.overdue].sort((a, b) =>
    toDateOnlyString(a.dueDate) < toDateOnlyString(b.dueDate) ? -1 : 1
  );

  // Donuts: posição de hoje, independente do mês selecionado no topo.
  const toReceiveToday = summarizeOpenTitles(receivables);
  const toPayToday = summarizeOpenTitles(payables);

  const balanceByType = new Map<string, bigint>();
  for (const account of accounts) {
    balanceByType.set(account.type, (balanceByType.get(account.type) ?? BigInt(0)) + account.currentBalanceCents);
  }
  const accountDonut = [
    { label: "Bancária", value: Number(balanceByType.get("BANK") ?? BigInt(0)) / 100, color: "#4680ff" },
    { label: "Caixa", value: Number(balanceByType.get("CASH") ?? BigInt(0)) / 100, color: "#0bc7b9" },
    { label: "Carteira", value: Number(balanceByType.get("WALLET") ?? BigInt(0)) / 100, color: "#ffa235" },
  ];
  const titlesDonut = [
    { label: "A receber", value: Number(toReceiveToday.totalCents) / 100, color: "#0bc7b9" },
    { label: "A pagar", value: Number(toPayToday.totalCents) / 100, color: "#fc5296" },
  ];

  return (
    <main className="wide">
      <div className="quick-actions">
        <Modal
          triggerLabel={
            <>
              <span className="quick-action-icon">
                <ArrowDownCircle className="size-5" strokeWidth={1.5} />
              </span>
              Nova receita
            </>
          }
          triggerClassName="quick-action-card revenue"
          title="Nova entrada"
          icon={<ArrowDownCircle className="size-5" strokeWidth={1.5} />}
          maxWidth="720px"
        >
          <TitleForm
            action={createEntradaAction}
            actionAndContinue={createEntradaAndContinueAction}
            categories={sortCategoriesTree(filterCategoriesByTitleType(categories, "RECEIVABLE"))}
            parties={clients}
            partyLabel="Cliente"
          />
        </Modal>

        <Modal
          triggerLabel={
            <>
              <span className="quick-action-icon">
                <ArrowUpCircle className="size-5" strokeWidth={1.5} />
              </span>
              Nova despesa
            </>
          }
          triggerClassName="quick-action-card expense"
          title="Nova saída"
          icon={<ArrowUpCircle className="size-5" strokeWidth={1.5} />}
          maxWidth="720px"
        >
          <TitleForm
            action={createSaidaAction}
            actionAndContinue={createSaidaAndContinueAction}
            categories={sortCategoriesTree(filterCategoriesByTitleType(categories, "PAYABLE"))}
            parties={suppliers}
            partyLabel="Fornecedor"
          />
        </Modal>
      </div>

      <Reveal className="stat-grid">
        <StatCard
          icon={<Wallet className="size-5" />}
          label="Saldo disponível (hoje)"
          value={formatCents(totalCents)}
          footerLabel="Contas ativas"
          footerValue={String(accounts.length)}
          gradient="blue"
          modalTitle="Saldo por conta"
        >
          {accounts.length === 0 ? (
            <p className="muted">Nenhuma conta cadastrada ainda.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Saldo atual</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td>{ACCOUNT_TYPE_LABEL[account.type] ?? account.type}</td>
                    <td style={{ fontWeight: 600 }}>
                      {formatCents(account.currentBalanceCents, account.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </StatCard>
        <StatCard
          icon={<ArrowDownCircle className="size-5" />}
          label="A receber no mês"
          value={formatCents(toReceiveMonth.totalCents)}
          footerLabel="Vencidos"
          footerValue={String(toReceiveMonth.overdueCount)}
          gradient="teal"
          modalTitle="A receber no mês"
        >
          <TitleDetailList titles={toReceiveMonth.open} />
        </StatCard>
        <StatCard
          icon={<ArrowUpCircle className="size-5" />}
          label="A pagar no mês"
          value={formatCents(toPayMonth.totalCents)}
          footerLabel="Vencidos"
          footerValue={String(toPayMonth.overdueCount)}
          gradient="orange"
          modalTitle="A pagar no mês"
        >
          <TitleDetailList titles={toPayMonth.open} />
        </StatCard>
        <StatCard
          icon={<AlertTriangle className="size-5" />}
          label="Vencido no mês"
          value={formatCents(overdueTotalCents)}
          footerLabel="Título(s)"
          footerValue={String(overdueTotalCount)}
          gradient="pink"
          modalTitle="Vencidos no mês"
        >
          <TitleDetailList titles={overdueTitlesMonth} />
        </StatCard>
      </Reveal>

      <Reveal className="dashboard-charts">
        <div className="card">
          <h1>Fluxo de caixa</h1>
          <p className="subtitle">Entradas e saídas realizadas nos 6 meses até o mês selecionado (Seção 13).</p>
          <CashFlowLineChart data={cashFlowSeries} />
        </div>

        <div className="card">
          <h1>Contas</h1>
          <p className="subtitle">Saldo atual por tipo (hoje)</p>
          <DonutChart segments={accountDonut} />
        </div>

        <div className="card">
          <h1>Títulos em aberto</h1>
          <p className="subtitle">A receber vs. a pagar (hoje)</p>
          <DonutChart segments={titlesDonut} />
        </div>
      </Reveal>

      <div className="card">
        <div className="page-header" style={{ marginBottom: "0.5rem" }}>
          <h1>Contas</h1>
          <Link href="/contas" className="button-link">
            Gerenciar contas
          </Link>
        </div>
        {accounts.length === 0 ? (
          <p className="muted">Nenhuma conta cadastrada ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Saldo atual</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.name}</td>
                  <td>{ACCOUNT_TYPE_LABEL[account.type] ?? account.type}</td>
                  <td style={{ fontWeight: 600 }}>
                    {formatCents(account.currentBalanceCents, account.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
