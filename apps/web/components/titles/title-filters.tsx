import Link from "next/link";
import { SubmitButton } from "@/components/ui/submit-button";
import { activeFilterCount, type TitleListQuery } from "@/lib/title-list-params";

/** Parâmetros que continuam valendo quando os filtros mudam (período, visão, ordenação, comparação). */
const KEEP = ["mes", "de", "ate", "periodo", "comparar", "filtro", "ordem", "dir"] as const;

/**
 * Busca e filtros da lista de entradas/saídas: texto livre (descrição, documento, observação ou nome da
 * pessoa), categoria, cliente/fornecedor, centro de custo e faixa de valor. É um formulário GET: cada
 * combinação tem endereço próprio, vale para a paginação e é a mesma usada na exportação.
 */
export function TitleFilters({
  basePath,
  params,
  categories,
  parties,
  costCenters,
  partyLabel,
}: {
  basePath: "/entradas" | "/saidas";
  params: Record<string, string | undefined>;
  categories: { id: string; name: string; parentId?: string | null }[];
  parties: { id: string; name: string }[];
  costCenters: { id: string; name: string }[];
  partyLabel: string;
}) {
  const query = params as TitleListQuery;
  const active = activeFilterCount(query);
  const clearQuery = new URLSearchParams();
  for (const key of KEEP) if (params[key]) clearQuery.set(key, params[key]!);
  const clearHref = clearQuery.toString() ? `${basePath}?${clearQuery.toString()}` : basePath;

  return (
    <form method="get" action={basePath} className="title-filters">
      {KEEP.map((key) => (params[key] ? <input key={key} type="hidden" name={key} value={params[key]} /> : null))}
      <div className="title-filters-search">
        <input type="search" name="q" defaultValue={params.q ?? ""} placeholder={`Buscar por descrição, documento, observação ou ${partyLabel.toLowerCase()}`} aria-label="Buscar lançamentos" maxLength={100} />
        <SubmitButton style={{ marginTop: 0 }}>Buscar</SubmitButton>
      </div>
      <details className="title-filters-more" open={active > (params.q ? 1 : 0)}>
        <summary>Mais filtros{active > 0 ? ` · ${active} ativo${active === 1 ? "" : "s"}` : ""}</summary>
        <div className="title-filters-grid">
          <div>
            <label htmlFor="f-categoria">Categoria</label>
            <select id="f-categoria" name="categoria" defaultValue={params.categoria ?? ""}>
              <option value="">Todas</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.parentId ? `  ↳ ${category.name}` : category.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-pessoa">{partyLabel}</label>
            <select id="f-pessoa" name="pessoa" defaultValue={params.pessoa ?? ""}>
              <option value="">Todos</option>
              {parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}
            </select>
          </div>
          {costCenters.length > 0 ? (
            <div>
              <label htmlFor="f-centro">Centro de custo</label>
              <select id="f-centro" name="centro" defaultValue={params.centro ?? ""}>
                <option value="">Todos</option>
                {costCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
              </select>
            </div>
          ) : null}
          <div>
            <label htmlFor="f-min">Valor de (R$)</label>
            <input id="f-min" name="min" type="text" inputMode="decimal" placeholder="0,00" defaultValue={params.min ?? ""} />
          </div>
          <div>
            <label htmlFor="f-max">Valor até (R$)</label>
            <input id="f-max" name="max" type="text" inputMode="decimal" placeholder="sem limite" defaultValue={params.max ?? ""} />
          </div>
        </div>
        <div className="title-filters-actions">
          <SubmitButton style={{ marginTop: 0 }}>Aplicar filtros</SubmitButton>
          {active > 0 ? <Link href={clearHref} className="button-link secondary">Limpar filtros</Link> : null}
        </div>
      </details>
    </form>
  );
}
