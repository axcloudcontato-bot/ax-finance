import { redirect } from "next/navigation";
import { CategoryIcon } from "@/components/categories/category-icon";
import { Tag } from "@/components/ui/animated-icons";
import { listCategories } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { sortCategoriesTree } from "@/lib/categories";
import { NATURE_LABEL } from "@/lib/category-labels";
import { Modal } from "@/components/ui/modal";
import { ActionModal } from "@/components/ui/action-modal";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { archiveCategoryAction, createCategoryAction, reactivateCategoryAction, updateCategoryAction } from "./actions";
import { SubmitButton } from "@/components/ui/submit-button";

type Category = Awaited<ReturnType<typeof listCategories>>[number];

/** Receita: o que entra. Despesa: custo, despesa, investimento, financiamento e patrimônio. */
const SECTIONS = [
  { key: "revenue", title: "Receitas", hint: "Categorias de entrada de dinheiro.", natures: ["OPERATING_REVENUE"] },
  { key: "expense", title: "Despesas", hint: "Categorias de saída: custos, despesas, investimentos e financiamentos.", natures: ["COST", "EXPENSE", "INVESTMENT", "FINANCING", "EQUITY"] },
  { key: "other", title: "Outras", hint: "Movimentos técnicos que não são receita nem despesa.", natures: ["TECHNICAL_TRANSFER"] },
] as const;

const sectionOf = (nature: string) => SECTIONS.find((section) => (section.natures as readonly string[]).includes(nature)) ?? SECTIONS[2];

/** Opções de "Categoria pai" separadas em receitas e despesas. */
function ParentOptions({ categories, exclude }: { categories: Category[]; exclude?: string }) {
  return (
    <>
      {SECTIONS.map((section) => {
        const items = categories.filter((item) => item.id !== exclude && sectionOf(item.nature).key === section.key);
        return items.length ? <optgroup key={section.key} label={section.title}>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup> : null;
      })}
    </>
  );
}

export default async function CategoriasPage(
  props: {
    searchParams: Promise<{ erro?: string; atualizado?: string; busca?: string }>;
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
  const search = (searchParams.busca ?? "").trim().slice(0, 100);
  const searchable = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const query = searchable(search);
  const visibleCategories = query
    ? ordered.filter((category) => searchable(`${category.name} ${category.managerialGroup ?? ""} ${NATURE_LABEL[category.nature] ?? ""}`).includes(query))
    : ordered;

  return (
    <main className="wide">
      <div className="page-header">
        <h1>Categorias</h1>
        <Modal
          triggerLabel="+ Nova categoria"
          triggerClassName="button-link workspace-primary-action"
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
              <ParentOptions categories={topLevelActive} />
            </select>

            <label htmlFor="managerialGroup">Grupo gerencial (opcional)</label>
            <input
              id="managerialGroup"
              name="managerialGroup"
              type="text"
              maxLength={200}
              placeholder="Ex.: Receita de serviços, Pessoal, Estrutura..."
            />

            <label htmlFor="costBehavior">Comportamento do gasto</label><select id="costBehavior" name="costBehavior" defaultValue="UNCLASSIFIED"><option value="UNCLASSIFIED">Não classificado</option><option value="FIXED">Fixo</option><option value="VARIABLE">Variável</option></select><p className="muted">Usado em custos e despesas para calcular margem de contribuição. Escolha conforme o gasto varia com as vendas; a natureza não determina o comportamento.</p>
            <SubmitButton>Criar categoria</SubmitButton>
          </form>
        </Modal>
      </div>

      <div className="card">
        {searchParams.atualizado ? <p className="success-box">Categoria atualizada.</p> : null}
        <div className="workspace-list-toolbar">
          <p>{visibleCategories.length} {visibleCategories.length === 1 ? "categoria exibida" : "categorias exibidas"}</p>
          <form method="get" action="/cadastros/categorias"><input name="busca" type="search" defaultValue={search} placeholder="Buscar categoria ou grupo" aria-label="Buscar categoria ou grupo" /><button type="submit" className="secondary">Buscar</button>{search ? <a href="/cadastros/categorias">Limpar</a> : null}</form>
        </div>
        {visibleCategories.length === 0 ? (
          <div className="workspace-empty"><strong>{search ? "Nenhuma categoria encontrada" : "Nenhuma categoria cadastrada"}</strong><p>{search ? "Tente outro termo ou limpe a busca." : "Crie categorias para organizar lançamentos e relatórios."}</p></div>
        ) : null}
      </div>

      {SECTIONS.map((section) => {
        const items = visibleCategories.filter((category) => sectionOf(category.nature).key === section.key);
        if (items.length === 0 && (section.key === "other" || search)) return null;
        return (
          <section key={section.key} className={`card category-section is-${section.key}`} aria-labelledby={`categorias-${section.key}`}>
            <div className="workspace-card-heading">
              <div>
                <h2 id={`categorias-${section.key}`}>{section.title} <span className="muted">({items.length})</span></h2>
                <p>{section.hint}</p>
              </div>
            </div>
            {items.length === 0 ? (
              <div className="workspace-empty"><strong>Nenhuma categoria de {section.title.toLowerCase()}</strong><p>Crie em &ldquo;+ Nova categoria&rdquo;.</p></div>
            ) : (
          <div className="table-scroll"><table className="workspace-table">
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
              {items.map((category) => (
                <tr key={category.id}>
                  <td><span className="category-name">{category.parentId ? <span className="muted" aria-hidden="true">↳</span> : null}<CategoryIcon name={category.name} nature={category.nature} />{category.name}</span></td>
                  <td>{NATURE_LABEL[category.nature] ?? category.nature}</td>
                  <td>{category.managerialGroup ?? "—"}<small className="muted" style={{ display: "block" }}>{category.costBehavior === "FIXED" ? "Gasto fixo" : category.costBehavior === "VARIABLE" ? "Gasto variável" : "Comportamento não classificado"}</small></td>
                  <td>{category.status === "ACTIVE" ? "Ativa" : "Arquivada"}</td>
                  <td>
                    <RowActionsMenu>
                    <ActionModal triggerLabel="Editar" title={`Editar categoria — ${category.name}`}>
                      <form action={updateCategoryAction.bind(null, category.id)}>
                        <label htmlFor={`name-${category.id}`}>Nome</label><input id={`name-${category.id}`} name="name" defaultValue={category.name} required maxLength={200} />
                        <label htmlFor={`nature-${category.id}`}>Natureza</label><select id={`nature-${category.id}`} name="nature" defaultValue={category.nature}>{Object.entries(NATURE_LABEL).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
                        <label htmlFor={`parent-${category.id}`}>Categoria pai</label><select id={`parent-${category.id}`} name="parentId" defaultValue={category.parentId ?? ""}><option value="">Nenhuma</option><ParentOptions categories={topLevelActive} exclude={category.id} /></select>
                        <label htmlFor={`group-${category.id}`}>Grupo gerencial</label><input id={`group-${category.id}`} name="managerialGroup" defaultValue={category.managerialGroup ?? ""} maxLength={200} />
                        <label htmlFor={`behavior-${category.id}`}>Comportamento do gasto</label><select id={`behavior-${category.id}`} name="costBehavior" defaultValue={category.costBehavior}><option value="UNCLASSIFIED">Não classificado</option><option value="FIXED">Fixo</option><option value="VARIABLE">Variável</option></select>
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
                    </RowActionsMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
            )}
          </section>
        );
      })}
    </main>
  );
}
