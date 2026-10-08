import { TITLE_LIST_SORTS, type TitleListSort } from "@ax-finance/domain";
import { parseAmountToCentsOrNull } from "./currency";

/** Parâmetros de busca, filtro e ordenação da lista de entradas/saídas (o que vai na URL). */
export interface TitleListQuery {
  q?: string;
  categoria?: string;
  pessoa?: string;
  centro?: string;
  min?: string;
  max?: string;
  ordem?: string;
  dir?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Só valor positivo: texto vazio ou inválido vira "sem limite" em vez de erro. */
function cents(value: string | undefined): bigint | undefined {
  if (!value?.trim()) return undefined;
  const parsed = parseAmountToCentsOrNull(value);
  return parsed !== null && parsed > 0 ? BigInt(parsed) : undefined;
}

export function parseTitleListQuery(query: TitleListQuery) {
  const sort = (TITLE_LIST_SORTS as readonly string[]).includes(query.ordem ?? "") ? (query.ordem as TitleListSort) : undefined;
  return {
    search: query.q?.trim().slice(0, 100) || undefined,
    categoryId: query.categoria && UUID.test(query.categoria) ? query.categoria : undefined,
    partyId: query.pessoa && UUID.test(query.pessoa) ? query.pessoa : undefined,
    costCenterId: query.centro && UUID.test(query.centro) ? query.centro : undefined,
    minCents: cents(query.min),
    maxCents: cents(query.max),
    sort,
    dir: query.dir === "desc" ? ("desc" as const) : ("asc" as const),
  };
}

/** Quantos filtros avançados estão ligados (para o resumo do painel de filtros). */
export function activeFilterCount(query: TitleListQuery): number {
  return [query.q, query.categoria, query.pessoa, query.centro, query.min, query.max].filter((value) => Boolean(value?.trim())).length;
}

/** Href do cabeçalho de uma coluna ordenável: clicar de novo na mesma coluna inverte o sentido. */
export function sortHref(basePath: string, params: Record<string, string | undefined>, column: TitleListSort): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value && key !== "pagina" && key !== "ordem" && key !== "dir") next.set(key, value);
  const current = params.ordem === column;
  next.set("ordem", column);
  next.set("dir", current && params.dir !== "desc" ? "desc" : "asc");
  return `${basePath}?${next.toString()}`;
}

/**
 * Caminho de retorno seguro para as ações da lista e do lançamento (só telas de entradas e saídas, nunca outro endereço),
 * com parâmetros de resultado trocados. Evita redirecionamento aberto vindo de um campo escondido.
 */
export function listReturnPath(returnTo: string, set: Record<string, string> = {}, remove: string[] = ["erro", "erroBaixa", "baixado", "cobrado", "agendado", "multaSalva"]): string {
  const fallback = "/entradas";
  if (!/^\/(entradas|saidas)(\/[0-9a-f-]{36})?(\?[^#]*)?$/i.test(returnTo)) return fallback;
  const url = new URL(returnTo, "http://local.invalid");
  for (const key of remove) url.searchParams.delete(key);
  for (const [key, value] of Object.entries(set)) url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}
