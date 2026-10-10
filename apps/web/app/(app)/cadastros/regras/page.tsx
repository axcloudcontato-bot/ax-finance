import { redirect } from "next/navigation";
import { listActiveCategories, listCategoryRules, listCostCenters, listParties } from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/session";
import { ActionModal } from "@/components/ui/action-modal";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { SubmitButton } from "@/components/ui/submit-button";
import { CategoryRuleForm, RULE_MATCH_LABEL, RULE_SCOPE_LABEL } from "@/components/category-rule-form";
import { createCategoryRuleAction, deleteCategoryRuleAction, updateCategoryRuleAction } from "./actions";

export default async function CategoryRulesPage(props: {
  searchParams: Promise<{ erro?: string; acao?: string; regra?: string; criada?: string; salva?: string; excluida?: string; padrao?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);

  const [rules, categories, costCenters, parties] = await Promise.all([
    listCategoryRules(user.id, company.id),
    listActiveCategories(user.id, company.id),
    listCostCenters(user.id, company.id),
    listParties(user.id, company.id, { status: "ACTIVE" }),
  ]);
  const options = {
    categories: categories.map(({ id, name, nature, parentId }) => ({ id, name, nature, parentId })),
    costCenters: costCenters.filter((center) => center.status === "ACTIVE").map(({ id, name }) => ({ id, name })),
    parties: parties.map(({ id, name }) => ({ id, name })),
  };
  const refreshKey = [searchParams.erro, searchParams.criada, searchParams.salva, searchParams.excluida].join("|");
  const newOpen = (Boolean(searchParams.erro) && searchParams.acao === "nova") || Boolean(searchParams.padrao);

  return (
    <main className="wide">
      <div className="page-header">
        <div>
          <h1>Regras de categoria</h1>
          <p className="subtitle">Ensine o sistema uma vez: &ldquo;descrição contém UBER → Transporte&rdquo;. A regra preenche a categoria dos lançamentos novos e das linhas do extrato na conciliação.</p>
        </div>
        <ActionModal key={`nova-${refreshKey}`} triggerLabel="+ Nova regra" triggerClassName="button-link workspace-primary-action" title="Nova regra de categoria" size="wide" initiallyOpen={newOpen}>
          {searchParams.erro && searchParams.acao === "nova" ? <p className="error">{searchParams.erro}</p> : null}
          <CategoryRuleForm action={createCategoryRuleAction} {...options} idPrefix="nova-regra" submitLabel="Criar regra" defaults={{ pattern: searchParams.padrao?.slice(0, 120) }} />
        </ActionModal>
      </div>

      {searchParams.erro && searchParams.acao !== "nova" && !searchParams.regra ? <p className="error">{searchParams.erro}</p> : null}
      {searchParams.criada ? <p className="success-box">Regra criada. Ela já vale para os próximos lançamentos e para a conciliação.</p> : null}
      {searchParams.salva ? <p className="success-box">Regra atualizada.</p> : null}
      {searchParams.excluida ? <p className="success-box">Regra excluída. Os lançamentos já feitos não mudam.</p> : null}

      <div className="card">
        {rules.length === 0 ? (
          <div className="workspace-empty">
            <strong>Nenhuma regra ainda</strong>
            <p>Crie regras para o que se repete: aplicativos de transporte, tarifas do banco, mercado, salário. Também dá para criar uma regra direto de uma linha do extrato, na Conciliação.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="workspace-table">
              <thead><tr><th>Quando a descrição</th><th>Vale para</th><th>Preenche</th><th className="money">Usada</th><th><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{RULE_MATCH_LABEL[rule.matchType]} <strong>&ldquo;{rule.pattern}&rdquo;</strong></td>
                    <td>{RULE_SCOPE_LABEL[rule.appliesTo]}</td>
                    <td>
                      <strong>{rule.category.name}</strong>
                      {rule.category.status !== "ACTIVE" ? <span className="workspace-status">categoria arquivada</span> : null}
                      {rule.costCenter || rule.party ? <small className="title-row-meta">{rule.costCenter ? <span>{rule.costCenter.name}</span> : null}{rule.party ? <span>{rule.party.name}</span> : null}</small> : null}
                    </td>
                    <td className="money">{rule.timesApplied}×</td>
                    <td>
                      <RowActionsMenu>
                        <ActionModal key={`editar-${rule.id}-${refreshKey}`} triggerLabel="Editar" title="Editar regra" size="wide" initiallyOpen={searchParams.regra === rule.id && Boolean(searchParams.erro)}>
                          {searchParams.regra === rule.id && searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
                          <CategoryRuleForm action={updateCategoryRuleAction.bind(null, rule.id)} {...options} idPrefix={`regra-${rule.id}`} defaults={rule} />
                        </ActionModal>
                        <form action={deleteCategoryRuleAction.bind(null, rule.id)} className="inline"><SubmitButton className="secondary">Excluir</SubmitButton></form>
                      </RowActionsMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
