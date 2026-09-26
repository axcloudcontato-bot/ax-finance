import Link from "next/link";
import { redirect } from "next/navigation";
import { generateDueOccurrences, listTitles } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { TitleListTable } from "@/components/titles/title-list-table";
import { toDateOnlyString, todayDateOnlyString } from "@/lib/dates";
import { currentYearMonth, monthRange } from "@/lib/month";

type Filter = "vencidas" | "hoje" | "proximas" | "quitadas" | "todas";

const FILTER_LABEL: Record<Filter, string> = {
  vencidas: "Vencidas",
  hoje: "Hoje",
  proximas: "Próximas",
  quitadas: "Pagas",
  todas: "Todas",
};

export default async function SaidasPage({
  searchParams,
}: {
  searchParams: { filtro?: string; mes?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  await generateDueOccurrences(user.id, company.id);
  const allTitles = await listTitles(user.id, company.id, { type: "PAYABLE" });

  const filter = (searchParams.filtro as Filter) ?? "todas";
  const month = searchParams.mes ?? currentYearMonth();
  const { from: monthFrom, to: monthTo } = monthRange(month);
  const today = todayDateOnlyString();

  const titles = allTitles.filter((title) => {
    const due = toDateOnlyString(title.dueDate);
    if (due < monthFrom || due > monthTo) return false;

    if (filter === "todas") return true;
    if (filter === "quitadas") return title.status === "SETTLED";
    if (title.status === "SETTLED" || title.status === "CANCELLED") return false;

    if (filter === "vencidas") return due < today;
    if (filter === "hoje") return due === today;
    if (filter === "proximas") return due > today;
    return true;
  });

  const filterHref = (key: Filter) => {
    const params = new URLSearchParams();
    if (key !== "todas") params.set("filtro", key);
    if (month !== currentYearMonth()) params.set("mes", month);
    const query = params.toString();
    return query ? `/saidas?${query}` : "/saidas";
  };
  return (
    <main className="wide">
      <div className="page-header">
        <h1>Saídas</h1>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link href="/saidas/recorrencias" className="button-link">
            Recorrências
          </Link>
          <Link href="/saidas/parcelado" className="button-link">
            Parcelar
          </Link>
          <Link href="/saidas/novo" className="button-link">
            Novo lançamento
          </Link>
        </div>
      </div>

      <div className="filters">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((key) => (
          <Link key={key} href={filterHref(key)} className={filter === key ? "active" : ""}>
            {FILTER_LABEL[key]}
          </Link>
        ))}
      </div>

      <div className="card">
        <TitleListTable titles={titles} basePath="/saidas" />
      </div>
    </main>
  );
}
