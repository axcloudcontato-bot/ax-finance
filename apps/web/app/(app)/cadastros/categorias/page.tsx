import { redirect } from "next/navigation";
import { CategoryIcon } from "@/components/categories/category-icon";
import { Tags } from "lucide-react";
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
import { CategoryForm } from "@/components/categories/category-form";

type Category = Awaited<ReturnType<typeof listCategories>>[number];

/** Receita: o que entra. Despesa: custo, despesa, investimento, financiamento e patrimônio. */
const SECTIONS = [
  { key: "revenue", title: "Receitas", hint: "Categorias de entrada de dinheiro.", natures: ["OPERATING_REVENUE"] },
  { key: "expense", title: "Despesas", hint: "Categorias de saída: custos, despesas, investimentos e financiamentos.", natures: ["COST", "EXPENSE", "INVESTMENT", "FINANCING", "EQUITY"] },
  { key: "other", title: "Outras", hint: "Movimentos técnicos que não são receita nem despesa.", natures: ["TECHNICAL_TRANSFER"] },
] as const;

/** Aba de cada seção na URL (?aba=receitas|despesas|outras). */
const TAB_SLUG = { revenue: "receitas", expense: "despesas", other: "outras" } as const;
const DEFAULT_NATURE = { revenue: "OPERATING_REVENUE", expense: "EXPENSE", other: "TECHNICAL_TRANSFER" } as const;

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
    searchParams: Promise<{ erro?: string; atualizado?: string; busca?: string; aba?: string }>;
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
  // Receitas e despesas em abas; "Outras" só aparece quando há categoria técnica.
  const countOf = (key: string) => visibleCategories.filter((category) => sectionOf(category.nature).key === key).length;
  const tabs = SECTIONS.filter((section) => section.key !== "other" || categories.some((category) => sectionOf(category.nature).key === "other"));
  const activeSection = tabs.find((section) => TAB_SLUG[section.key] === searchParams.aba) ?? tabs[0]!;
  const tabHref = (key: keyof typeof TAB_SLUG) => {
    const next = new URLSearchParams({ aba: TAB_SLUG[key] });
    if (search) next.set("busca", search);
    return `/cadastros/categorias?${next}`;
  };

  return (
    <main className="wide">
      <div className="page-header">
        <h1>Categorias</h1>
        <Modal
          triggerLabel="+ Nova categoria"
          triggerClassName="button-link workspace-primary-action"
          title="Nova categoria"
          icon={<Tags strokeWidth={1.8} />}
          maxWidth="760px"
        >
          {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
          <CategoryForm
            action={createCategoryAction}
            idPrefix="nova-categoria"
            defaultNature={DEFAULT_NATURE[activeSection.key]}
            parentOptions={<ParentOptions categories={topLevelActive} />}
            submitLabel="Criar categoria"
          />
        </Modal>
      </div>

      {[activeSection].map((section) => {
        const items = visibleCategories.filter((category) => sectionOf(category.nature).key === section.key);
        return (
          <section key={section.key} className="card category-panel" aria-labelledby={`categorias-${section.key}`}>
            {/* Uma linha só: abas à esquerda, busca à direita; o texto de apoio e a tabela logo abaixo. */}
            <div className="category-panel-toolbar">
              <nav className="filters category-tabs" aria-label="Tipo de categoria">
                {tabs.map((tab) => (
                  <a key={tab.key} href={tabHref(tab.key)} className={tab.key === section.key ? "active" : undefined} aria-current={tab.key === section.key ? "page" : undefined}>
                    {tab.title} <span className="category-tab-count">{countOf(tab.key)}</span>
                  </a>
                ))}
              </nav>
              <form method="get" action="/cadastros/categorias" className="category-search" role="search">
                <input type="hidden" name="aba" value={TAB_SLUG[section.key]} />
                <input name="busca" type="search" defaultValue={search} placeholder="Buscar categoria ou grupo" aria-label="Buscar categoria ou grupo" />
                <button type="submit" className="secondary">Buscar</button>
                {search ? <a href={tabHref(section.key).replace(/&busca=[^&]*/, "")} className="category-search-clear">Limpar</a> : null}
              </form>
            </div>
            {searchParams.atualizado ? <p className="success-box">Categoria atualizada.</p> : null}
            <p id={`categorias-${section.key}`} className="category-panel-hint">
              <strong>{items.length} {items.length === 1 ? "categoria" : "categorias"}{search ? ` ${items.length === 1 ? "encontrada" : "encontradas"} para "${search}"` : ""}</strong> · {section.hint}
            </p>
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
                    <ActionModal triggerLabel="Editar" title={`Editar categoria — ${category.name}`} size="wide" icon={<CategoryIcon name={category.name} nature={category.nature} size={20} />}>
                      <CategoryForm
                        action={updateCategoryAction.bind(null, category.id)}
                        idPrefix={`categoria-${category.id}`}
                        hidden={<input type="hidden" name="aba" value={TAB_SLUG[activeSection.key]} />}
                        parentOptions={<ParentOptions categories={topLevelActive} exclude={category.id} />}
                        defaults={{ name: category.name, nature: category.nature, parentId: category.parentId, managerialGroup: category.managerialGroup, costBehavior: category.costBehavior }}
                        submitLabel="Salvar alterações"
                      />
                    </ActionModal>
                    {category.status === "ACTIVE" ? (
                      <form action={archiveCategoryAction} className="inline"><input type="hidden" name="aba" value={TAB_SLUG[activeSection.key]} />
                        <input type="hidden" name="categoryId" value={category.id} />
                        <SubmitButton className="secondary">
                          Arquivar
                        </SubmitButton>
                      </form>
                    ) : <form action={reactivateCategoryAction.bind(null, category.id)} className="inline"><input type="hidden" name="aba" value={TAB_SLUG[activeSection.key]} /><SubmitButton className="secondary">Reativar</SubmitButton></form>}
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
