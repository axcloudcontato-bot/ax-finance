import { randomUUID } from "node:crypto";
import { CARD_INVOICE_CATEGORY_NAME } from "@ax-finance/domain";
import { SubmitButton } from "@/components/ui/submit-button";
import { CategorySuggestion } from "@/components/category-suggestion";
import { CategoryPicker } from "@/components/categories/category-picker";
import { PartyPicker } from "@/components/parties/party-picker";
import { filterCategoriesByTitleType, sortCategoriesTree } from "@/lib/categories";
import { todayDateOnlyString } from "@/lib/dates";
import { PurchaseImpact, type PurchaseImpactCard } from "./purchase-impact";

interface Option {
  id: string;
  name: string;
}

interface CategoryOption extends Option {
  parentId: string | null;
  order: number;
  nature: string;
}

interface PurchaseDefaults {
  description: string;
  categoryId: string;
  partyId: string | null;
  costCenterId: string | null;
  notes: string | null;
}

/** Categorias que fazem sentido numa compra: sem receita e sem a categoria técnica da fatura. */
export function purchaseCategoryOptions<T extends CategoryOption>(categories: T[]): T[] {
  return sortCategoriesTree(filterCategoriesByTitleType(categories, "PAYABLE").filter((category) => category.name !== CARD_INVOICE_CATEGORY_NAME));
}

/**
 * Formulário de compra no cartão. Criação pede valor total, data e parcelas; edição só mexe em
 * texto e classificação (valor e data decidem a fatura, então para corrigi-los cancela-se e lança-se de novo).
 */
export function PurchaseForm({
  action,
  categories,
  parties,
  costCenters,
  defaults,
  idPrefix = "purchase",
  submitLabel,
  today,
  card,
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: CategoryOption[];
  parties: Option[];
  costCenters: Option[];
  defaults?: PurchaseDefaults;
  idPrefix?: string;
  submitLabel?: string;
  /** "Hoje" no fuso da empresa (YYYY-MM-DD), para a data padrão da compra. */
  today?: string;
  card?: PurchaseImpactCard;
}) {
  const editing = Boolean(defaults);
  const defaultDate = today ?? todayDateOnlyString();
  const options = purchaseCategoryOptions(categories);

  return (
    <form action={action}>
      {editing ? null : <input type="hidden" name="idempotencyKey" value={randomUUID()} />}
      <div className="form-grid">
        <div className="span-2">
          <label htmlFor={`${idPrefix}-description`}>Descrição</label>
          <input id={`${idPrefix}-description`} name="description" type="text" required maxLength={500} placeholder="Ex.: Supermercado, notebook" defaultValue={defaults?.description} />
        </div>

        <div>
          <label htmlFor={`${idPrefix}-category`}>Categoria</label>
          <CategoryPicker
            id={`${idPrefix}-category`}
            kind="PAYABLE"
            categories={options.map(({ id, name, parentId }) => ({ id, name, parentId }))}
            defaultValue={defaults?.categoryId ?? ""}
          />
          {editing ? null : <CategorySuggestion type="PAYABLE" />}
        </div>

        <div>
          <label htmlFor={`${idPrefix}-party`}>Estabelecimento (opcional)</label>
          <PartyPicker
            id={`${idPrefix}-party`}
            role="SUPPLIER"
            noun="estabelecimento"
            parties={parties.map(({ id, name }) => ({ id, name }))}
            defaultValue={defaults?.partyId ?? ""}
          />
        </div>

        {costCenters.length > 0 ? (
          <div>
            <label htmlFor={`${idPrefix}-costCenter`}>Centro de custo (opcional)</label>
            <select id={`${idPrefix}-costCenter`} name="costCenterId" defaultValue={defaults?.costCenterId ?? ""}>
              <option value="">Nenhum</option>
              {costCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
            </select>
          </div>
        ) : null}

        {editing ? null : (
          <>
            <div>
              <label htmlFor={`${idPrefix}-amount`}>Valor total (R$)</label>
              <input id={`${idPrefix}-amount`} name="amount" type="text" inputMode="decimal" placeholder="0,00" required />
            </div>

            <div>
              <label htmlFor={`${idPrefix}-date`}>Data da compra</label>
              <input id={`${idPrefix}-date`} name="purchaseDate" type="date" defaultValue={defaultDate} required />
            </div>

            <div>
              <label htmlFor={`${idPrefix}-installments`}>Parcelas</label>
              <input id={`${idPrefix}-installments`} name="installmentCount" type="number" min={1} max={48} defaultValue={1} required />
            </div>

            {card ? null : <p className="subtitle" style={{ margin: 0, alignSelf: "end" }}>
              Compra parcelada vira uma parcela em cada fatura seguinte; o valor informado é o total.
            </p>}
          </>
        )}

        {!editing && card ? <PurchaseImpact card={card} /> : null}

        <div className="span-2">
          <label htmlFor={`${idPrefix}-notes`}>Observações</label>
          <input id={`${idPrefix}-notes`} name="notes" type="text" maxLength={2000} defaultValue={defaults?.notes ?? ""} />
        </div>
      </div>
      <div className="modal-form-footer"><SubmitButton>{submitLabel ?? (editing ? "Salvar alterações" : "Lançar compra")}</SubmitButton></div>
    </form>
  );
}
