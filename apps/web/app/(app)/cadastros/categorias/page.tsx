import { redirect } from "next/navigation";
import { listCategories } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { sortCategoriesTree } from "@/lib/categories";
import { NATURE_LABEL } from "@/lib/category-labels";
import { Modal } from "@/components/ui/modal";
import { archiveCategoryAction, createCategoryAction } from "./actions";

export default async function CategoriasPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const categories = await listCategories(user.id, company.id);
  const ordered = sortCategoriesTree(categories);
  const topLevelActive = categories.filter((c) => !c.parentId && c.status === "ACTIVE");

  return (
    <main className="wide">
      <div className="page-header">
        <h1>Categorias</h1>
        <Modal triggerLabel="+ Nova categoria" title="Nova categoria">
          <p className="subtitle">
            Só dois níveis: categoria e subcategoria (Seção 9). Para uma subcategoria, selecione a
            categoria pai.
          </p>

          {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}

          <form action={createCategoryAction}>
            <label htmlFor="name">Nome</label>
            <input id="name" name="name" type="text" required maxLength={200} />

            <label htmlFor="nature">Natureza</label>
            <select id="nature" name="nature" required defaultValue="">
              <option value="" disabled>
                Selecione
              </option>
              {Object.entries(NATURE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <label htmlFor="parentId">Categoria pai (opcional)</label>
            <select id="parentId" name="parentId" defaultValue="">
              <option value="">Nenhuma — categoria de topo</option>
              {topLevelActive.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <label htmlFor="managerialGroup">Grupo gerencial (opcional)</label>
            <input
              id="managerialGroup"
              name="managerialGroup"
              type="text"
              maxLength={200}
              placeholder="Ex.: Receita de serviços, Pessoal, Estrutura..."
            />

            <button type="submit">Criar categoria</button>
          </form>
        </Modal>
      </div>

      <div className="card">
        {ordered.length === 0 ? (
          <p className="muted">Nenhuma categoria ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Natureza</th>
                <th>Grupo gerencial</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((category) => (
                <tr key={category.id}>
                  <td>{category.parentId ? `↳ ${category.name}` : category.name}</td>
                  <td>{NATURE_LABEL[category.nature] ?? category.nature}</td>
                  <td>{category.managerialGroup ?? "—"}</td>
                  <td>{category.status === "ACTIVE" ? "Ativa" : "Arquivada"}</td>
                  <td>
                    {category.status === "ACTIVE" ? (
                      <form action={archiveCategoryAction} className="inline">
                        <input type="hidden" name="categoryId" value={category.id} />
                        <button type="submit" className="secondary">
                          Arquivar
                        </button>
                      </form>
                    ) : null}
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
