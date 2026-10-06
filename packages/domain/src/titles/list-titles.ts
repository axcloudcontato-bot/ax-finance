import { withCompanyContext, type Prisma } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export interface ListTitlesFilter {
  type?: "RECEIVABLE" | "PAYABLE";
  /** Só estes títulos (telas de lote), em vez de carregar todos e filtrar depois. */
  ids?: string[];
}

/**
 * "Vencido" não é um status gravado — é calculado na leitura a partir do
 * vencimento e do saldo aberto (Seção 6: não gravar estado vencido que
 * dependa de atualização manual diária). Por isso devolvemos remainingCents
 * já calculado, e a página decide o rótulo (vencido/hoje/próximas/pagas).
 */
export async function listTitles(
  userId: string,
  companyId: string,
  filter: ListTitlesFilter = {}
) {
  await assertActiveMembership(userId, companyId);

  const titles = await withCompanyContext(userId, companyId, (tx) =>
    tx.title.findMany({
      where: { companyId, deletedAt: null, ...(filter.type ? { type: filter.type } : {}), ...(filter.ids ? { id: { in: filter.ids } } : {}) },
      include: {
        category: true,
        party: true,
        costCenter: true,
        settlements: { where: { reversedAt: null } },
      },
      orderBy: { dueDate: "asc" },
    })
  );

  return titles.map(({ settlements, ...title }) => {
    const settledPrincipalEquivalent = settlements.reduce(
      (sum, settlement) => sum + settlement.principalAmountCents + settlement.discountCents,
      BigInt(0)
    );
    return {
      ...title,
      remainingCents: title.originalAmountCents - settledPrincipalEquivalent,
    };
  });
}

export const TITLE_LIST_VIEWS = ["todas", "vencidas", "hoje", "proximas", "quitadas"] as const;
export type TitleListView = (typeof TITLE_LIST_VIEWS)[number];

export interface ListTitlesPageFilter {
  type: "RECEIVABLE" | "PAYABLE";
  view?: TitleListView;
  /** Período por vencimento ("YYYY-MM-DD"); não vale para "vencidas" e "hoje", que olham todas as datas. */
  from: string;
  to: string;
  /** "Hoje" no fuso da empresa ("YYYY-MM-DD"). */
  today: string;
  page?: number;
  pageSize?: number;
}

const OPEN_STATUSES = ["OPEN", "PARTIALLY_SETTLED"] as const;
export const TITLE_LIST_PAGE_SIZE = 50;

function viewWhere(filter: ListTitlesPageFilter): Prisma.TitleWhereInput {
  const view = filter.view ?? "todas";
  const day = (value: string) => new Date(value);
  if (view === "vencidas") return { status: { in: [...OPEN_STATUSES] }, dueDate: { lt: day(filter.today) } };
  if (view === "hoje") return { status: { in: [...OPEN_STATUSES] }, dueDate: day(filter.today) };
  const inPeriod: Prisma.TitleWhereInput = { dueDate: { gte: day(filter.from), lte: day(filter.to) } };
  if (view === "quitadas") return { ...inPeriod, status: "SETTLED" };
  if (view === "proximas") return { status: { in: [...OPEN_STATUSES] }, dueDate: { gte: day(filter.from), lte: day(filter.to), gt: day(filter.today) } };
  return inPeriod;
}

/**
 * Uma página da lista de entradas/saídas, já filtrada no banco, com o resumo do conjunto INTEIRO
 * (não só da página): saldo em aberto, vencido e o vencimento mais antigo. Antes a tela carregava
 * todos os títulos da empresa e filtrava em memória; com milhares de lançamentos isso não escala.
 * As regras de filtro são as mesmas de antes (ver `viewWhere`) e a RLS segue valendo na consulta.
 */
export async function listTitlesPage(userId: string, companyId: string, filter: ListTitlesPageFilter) {
  await assertActiveMembership(userId, companyId);
  const pageSize = Math.max(1, Math.min(filter.pageSize ?? TITLE_LIST_PAGE_SIZE, 200));

  return withCompanyContext(userId, companyId, async (tx) => {
    const base: Prisma.TitleWhereInput = { companyId, deletedAt: null, type: filter.type, ...viewWhere(filter) };
    const open: Prisma.TitleWhereInput = { AND: [base, { status: { in: [...OPEN_STATUSES] } }] };
    const overdue: Prisma.TitleWhereInput = { AND: [open, { dueDate: { lt: new Date(filter.today) } }] };

    const total = await tx.title.count({ where: base });
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, Math.floor(filter.page ?? 1)), pageCount);

    const remaining = async (where: Prisma.TitleWhereInput) => {
      const [titles, settled] = await Promise.all([
        tx.title.aggregate({ where, _sum: { originalAmountCents: true }, _count: true, _min: { dueDate: true } }),
        tx.settlement.aggregate({ where: { companyId, reversedAt: null, title: where }, _sum: { principalAmountCents: true, discountCents: true } }),
      ]);
      const original = titles._sum.originalAmountCents ?? BigInt(0);
      const paid = (settled._sum.principalAmountCents ?? BigInt(0)) + (settled._sum.discountCents ?? BigInt(0));
      return { count: titles._count, cents: original - paid, oldest: titles._min.dueDate };
    };
    const [openSummary, overdueSummary] = await Promise.all([remaining(open), remaining(overdue)]);

    const rows = await tx.title.findMany({
      where: base,
      include: { category: true, party: true, costCenter: true, settlements: { where: { reversedAt: null } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      titles: rows.map(({ settlements, ...title }) => ({
        ...title,
        remainingCents: title.originalAmountCents - settlements.reduce((sum, item) => sum + item.principalAmountCents + item.discountCents, BigInt(0)),
      })),
      total,
      page,
      pageSize,
      pageCount,
      summary: {
        openCount: openSummary.count,
        openCents: openSummary.cents,
        overdueCount: overdueSummary.count,
        overdueCents: overdueSummary.cents,
        oldestOverdueDate: overdueSummary.oldest,
      },
    };
  });
}
