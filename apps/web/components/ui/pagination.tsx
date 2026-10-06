import Link from "next/link";

/**
 * Paginação por links (`?pagina=N`), preservando os demais parâmetros da URL (período, filtro, comparação).
 * Funciona sem JavaScript e deixa cada página com endereço próprio.
 */
export function Pagination({
  basePath,
  params,
  page,
  pageCount,
  total,
  pageSize,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
}) {
  if (pageCount <= 1) return null;

  const hrefFor = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "pagina") query.set(key, value);
    }
    if (target > 1) query.set("pagina", String(target));
    const text = query.toString();
    return text ? `${basePath}?${text}` : basePath;
  };
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav className="workspace-pagination" aria-label="Paginação da lista">
      <span>{first}–{last} de {total}</span>
      <span className="workspace-pagination-links">
        {page > 1 ? <Link href={hrefFor(page - 1)} rel="prev">← Anterior</Link> : <span aria-disabled="true">← Anterior</span>}
        <span>Página {page} de {pageCount}</span>
        {page < pageCount ? <Link href={hrefFor(page + 1)} rel="next">Próxima →</Link> : <span aria-disabled="true">Próxima →</span>}
      </span>
    </nav>
  );
}
