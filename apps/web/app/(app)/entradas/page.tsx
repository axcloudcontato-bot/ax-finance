import Link from "next/link";
import { redirect } from "next/navigation";
import { generateDueOccurrences, listTitles } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { TitleListTable } from "@/components/titles/title-list-table";
import { toDateOnlyString, todayDateOnlyString } from "@/lib/dates";

type Filter = "vencidas" | "hoje" | "proximas" | "quitadas" | "todas";

const FILTER_LABEL: Record<Filter, string> = {
  vencidas: "Vencidas",
  hoje: "Hoje",
  proximas: "Próximas",
  quitadas: "Quitadas",
  todas: "Todas",
};

export default async function EntradasPage({
  searchParams,
}: {
  searchParams: { filtro?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  await generateDueOccurrences(user.id, company.id);
  const allTitles = await listTitles(user.id, company.id, { type: "RECEIVABLE" });

  const filter = (searchParams.filtro as Filter) ?? "todas";
  const today = todayDateOnlyString();

  const titles = allTitles.filter((title) => {
    if (filter === "todas") return true;
    if (filter === "quitadas") return title.status === "SETTLED";
    if (title.status === "SETTLED" || title.status === "CANCELLED") return false;

    const due = toDateOnlyString(title.dueDate);

    if (filter === "vencidas") return due < today;
    if (filter === "hoje") return due === today;
    if (filter === "proximas") return due > today;
    return true;
  });

  return (
    <main className="wide">
      <div className="page-header">
        <h1>Entradas</h1>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link href="/entradas/recorrencias" className="button-link">
            Recorrências
          </Link>
          <Link href="/entradas/parcelado" className="button-link">
            Parcelar
          </Link>
          <Link href="/entradas/novo" className="button-link">
            Novo lançamento
          </Link>
        </div>
      </div>

      <div className="filters">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((key) => (
          <Link
            key={key}
            href={key === "todas" ? "/entradas" : `/entradas?filtro=${key}`}
            className={filter === key ? "active" : ""}
          >
            {FILTER_LABEL[key]}
          </Link>
        ))}
      </div>

      <div className="card">
        <TitleListTable titles={titles} basePath="/entradas" />
      </div>
    </main>
  );
}
