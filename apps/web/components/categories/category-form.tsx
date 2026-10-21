import type { ReactNode } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { NATURE_LABEL } from "@/lib/category-labels";
import { CategoryIconPreview } from "./category-icon-preview";

interface CategoryDefaults {
  name: string;
  nature: string;
  parentId: string | null;
  managerialGroup: string | null;
  costBehavior: string;
}

/**
 * Criar ou editar categoria, no mesmo enquadramento da janela de cofrinho: nome na largura toda,
 * os demais campos em duas colunas, prévia do ícone e o botão à direita no rodapé.
 */
export function CategoryForm({
  action,
  idPrefix,
  parentOptions,
  defaults,
  defaultNature = "EXPENSE",
  hidden,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  idPrefix: string;
  /** As opções de "Dentro de", já agrupadas por receita/despesa. */
  parentOptions: ReactNode;
  defaults?: CategoryDefaults;
  defaultNature?: string;
  hidden?: ReactNode;
  submitLabel: string;
}) {
  const nature = defaults?.nature ?? defaultNature;
  return (
    <form action={action} className="category-form">
      {hidden}
      <div className="form-grid">
        <div className="span-2">
          <label htmlFor={`${idPrefix}-name`}>Nome da categoria</label>
          <input id={`${idPrefix}-name`} name="name" type="text" required maxLength={200} placeholder="Ex.: Aluguel, Venda de serviços, Combustível" defaultValue={defaults?.name} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-nature`}>Natureza</label>
          <select id={`${idPrefix}-nature`} name="nature" required defaultValue={nature}>
            {Object.entries(NATURE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-parent`}>Dentro de (opcional)</label>
          <select id={`${idPrefix}-parent`} name="parentId" defaultValue={defaults?.parentId ?? ""}>
            <option value="">Nenhuma — categoria principal</option>
            {parentOptions}
          </select>
        </div>
        <div className="span-2">
          <span className="category-form-label">Ícone</span>
          <CategoryIconPreview initialName={defaults?.name} initialNature={nature} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-group`}>Grupo gerencial (opcional)</label>
          <input id={`${idPrefix}-group`} name="managerialGroup" type="text" maxLength={200} placeholder="Ex.: Pessoal, Estrutura" defaultValue={defaults?.managerialGroup ?? ""} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-behavior`}>Comportamento do gasto</label>
          <select id={`${idPrefix}-behavior`} name="costBehavior" defaultValue={defaults?.costBehavior ?? "UNCLASSIFIED"}>
            <option value="UNCLASSIFIED">Não classificado</option>
            <option value="FIXED">Fixo</option>
            <option value="VARIABLE">Variável</option>
          </select>
        </div>
        <p className="field-note span-2">Comportamento vale para custos e despesas e alimenta a margem de contribuição: fixo não muda com as vendas, variável acompanha. Só dois níveis: categoria e subcategoria.</p>
      </div>
      <div className="form-actions modal-form-footer"><SubmitButton>{submitLabel}</SubmitButton></div>
    </form>
  );
}
