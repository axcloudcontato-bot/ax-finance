import { SubmitButton } from "@/components/ui/submit-button";

type Option = { id: string; name: string };
type CategoryOption = Option & { nature: string; parentId?: string | null };

interface RuleDefaults {
  pattern: string;
  matchType: string;
  appliesTo: string;
  categoryId: string;
  costCenterId: string | null;
  partyId: string | null;
}

export const RULE_MATCH_LABEL: Record<string, string> = { CONTAINS: "contém", STARTS_WITH: "começa com", EQUALS: "é igual a" };
export const RULE_SCOPE_LABEL: Record<string, string> = { BOTH: "Entradas e saídas", PAYABLE: "Só saídas", RECEIVABLE: "Só entradas" };

/** Formulário da regra de categoria. Server component: serve dentro de modais (cadastro e conciliação). */
export function CategoryRuleForm({
  action,
  categories,
  costCenters,
  parties,
  defaults,
  idPrefix,
  submitLabel = "Salvar regra",
  back,
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: CategoryOption[];
  costCenters: Option[];
  parties: Option[];
  defaults?: Partial<RuleDefaults>;
  idPrefix: string;
  submitLabel?: string;
  /** Endereço de volta (regra criada a partir de uma linha do extrato). */
  back?: string;
}) {
  const revenue = categories.filter((category) => category.nature === "OPERATING_REVENUE");
  const others = categories.filter((category) => category.nature !== "OPERATING_REVENUE");
  return (
    <form action={action}>
      {back ? <input type="hidden" name="voltar" value={back} /> : null}
      <div className="form-grid">
        <div>
          <label htmlFor={`${idPrefix}-match`}>Quando a descrição</label>
          <select id={`${idPrefix}-match`} name="matchType" defaultValue={defaults?.matchType ?? "CONTAINS"}>
            {Object.entries(RULE_MATCH_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-pattern`}>Texto</label>
          <input id={`${idPrefix}-pattern`} name="pattern" type="text" required minLength={2} maxLength={120} placeholder="Ex.: UBER, IFOOD, TARIFA" defaultValue={defaults?.pattern} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-scope`}>Vale para</label>
          <select id={`${idPrefix}-scope`} name="appliesTo" defaultValue={defaults?.appliesTo ?? "BOTH"}>
            {Object.entries(RULE_SCOPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-category`}>Usar a categoria</label>
          <select id={`${idPrefix}-category`} name="categoryId" required defaultValue={defaults?.categoryId ?? ""}>
            <option value="" disabled>Selecione</option>
            {others.length ? <optgroup label="Saídas">{others.map((category) => <option key={category.id} value={category.id}>{category.parentId ? "↳ " : ""}{category.name}</option>)}</optgroup> : null}
            {revenue.length ? <optgroup label="Entradas">{revenue.map((category) => <option key={category.id} value={category.id}>{category.parentId ? "↳ " : ""}{category.name}</option>)}</optgroup> : null}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-center`}>Centro de custo (opcional)</label>
          <select id={`${idPrefix}-center`} name="costCenterId" defaultValue={defaults?.costCenterId ?? ""}>
            <option value="">Não preencher</option>
            {costCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-party`}>Cliente/fornecedor (opcional)</label>
          <select id={`${idPrefix}-party`} name="partyId" defaultValue={defaults?.partyId ?? ""}>
            <option value="">Não preencher</option>
            {parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}
          </select>
        </div>
      </div>
      <p className="field-note">Maiúsculas e acentos não importam. Se mais de uma regra servir, vale a mais específica (&ldquo;é igual a&rdquo;, depois &ldquo;começa com&rdquo;, depois o texto mais longo).</p>
      <div className="form-actions"><SubmitButton>{submitLabel}</SubmitButton></div>
    </form>
  );
}
