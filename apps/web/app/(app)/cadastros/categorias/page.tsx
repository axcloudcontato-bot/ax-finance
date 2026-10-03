import { redirect } from "next/navigation";
import { Tag } from "@/components/ui/animated-icons";
import { listCategories } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { sortCategoriesTree } from "@/lib/categories";
import { NATURE_LABEL } from "@/lib/category-labels";
import { Modal } from "@/components/ui/modal";
import { ActionModal } from "@/components/ui/action-modal";
import { archiveCategoryAction, createCategoryAction, reactivateCategoryAction, updateCategoryAction } from "./actions";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function CategoriasPage(
  props: {
    searchParams: Promise<{ erro?: string; atualizado?: string }>;
  }
) {
  const searchParams = await props.searchParams;
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
        <Modal
          triggerLabel="+ Nova categoria"
          title="Nova categoria"
          icon={<Tag className="size-5" strokeWidth={1.5} />}
        >
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

            <SubmitButton>Criar categoria</SubmitButton>
          </form>
        </Modal>
      </div>

      <div className="card">
        {searchParams.atualizado ? <p className="success-box">Categoria atualizada.</p> : null}
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
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <ActionModal triggerLabel="Editar" title={`Editar categoria — ${category.name}`}>
                      <form action={updateCategoryAction.bind(null, category.id)}>
                        <label htmlFor={`name-${category.id}`}>Nome</label><input id={`name-${category.id}`} name="name" defaultValue={category.name} required maxLength={200} />
                        <label htmlFor={`nature-${category.id}`}>Natureza</label><select id={`nature-${category.id}`} name="nature" defaultValue={category.nature}>{Object.entries(NATURE_LABEL).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
                        <label htmlFor={`parent-${category.id}`}>Categoria pai</label><select id={`parent-${category.id}`} name="parentId" defaultValue={category.parentId ?? ""}><option value="">Nenhuma</option>{topLevelActive.filter((item) => item.id !== category.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                        <label htmlFor={`group-${category.id}`}>Grupo gerencial</label><input id={`group-${category.id}`} name="managerialGroup" defaultValue={category.managerialGroup ?? ""} maxLength={200} />
                        <SubmitButton>Salvar alterações</SubmitButton>
                      </form>
                    </ActionModal>
                    {category.status === "ACTIVE" ? (
                      <form action={archiveCategoryAction} className="inline">
                        <input type="hidden" name="categoryId" value={category.id} />
                        <SubmitButton className="secondary">
                          Arquivar
                        </SubmitButton>
                      </form>
                    ) : <form action={reactivateCategoryAction.bind(null, category.id)} className="inline"><SubmitButton className="secondary">Reativar</SubmitButton></form>}
                    </div>
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
