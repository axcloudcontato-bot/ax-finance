import type { listActiveCategories, listCostCenters, listParties } from "@ax-finance/domain";
import { SubmitButton } from "@/components/ui/submit-button";
import { CategoryPicker } from "@/components/categories/category-picker";
import { PartyPicker } from "@/components/parties/party-picker";
import { todayDateOnlyString } from "@/lib/dates";

type CategoryOption = Awaited<ReturnType<typeof listActiveCategories>>[number];
type PartyOption = Awaited<ReturnType<typeof listParties>>[number];
type CostCenterOption = Awaited<ReturnType<typeof listCostCenters>>[number];

export function RecurrenceForm({
  action,
  categories,
  parties,
  costCenters,
  partyLabel,
  kind,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** Entrada ou saída: define o tipo da categoria e do cadastro criados pelo "+ Novo". */
  kind: "RECEIVABLE" | "PAYABLE";
  categories: CategoryOption[];
  parties?: PartyOption[];
  costCenters?: CostCenterOption[];
  partyLabel?: string;
  error?: string;
}) {
  const today = todayDateOnlyString();

  return (
    <>
      <p className="subtitle">
        Gera um título por mês, no dia de vencimento escolhido, até 90 dias à frente — diferente de
        um parcelamento (que cria tudo de uma vez). Pausar interrompe a geração sem apagar os
        títulos já criados.
      </p>

      {error ? <p className="error">{error}</p> : null}

      {(
        <form action={action}>
          <label htmlFor="description">Descrição</label>
          <input id="description" name="description" type="text" required maxLength={500} />

          <label htmlFor="categoryId">Categoria</label>
          <CategoryPicker id="categoryId" kind={kind} categories={categories.map(({ id, name, parentId }) => ({ id, name, parentId }))} />

          {parties ? (
            <>
              <label htmlFor="partyId">{partyLabel ?? "Cliente/fornecedor"} (opcional)</label>
              <PartyPicker id="partyId" role={kind === "RECEIVABLE" ? "CLIENT" : "SUPPLIER"} noun={kind === "RECEIVABLE" ? "cliente" : "fornecedor"} parties={parties.map(({ id, name }) => ({ id, name }))} />
            </>
          ) : null}

          {costCenters && costCenters.length > 0 ? <>
            <label htmlFor="costCenterId">Centro de custo (opcional)</label>
            <select id="costCenterId" name="costCenterId" defaultValue="">
              <option value="">Nenhum</option>
              {costCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
            </select>
          </> : null}

          <label htmlFor="amount">Valor mensal (R$)</label>
          <input id="amount" name="amount" type="text" inputMode="decimal" placeholder="0,00" required />

          <label htmlFor="dayOfMonth">Dia de vencimento</label>
          <input id="dayOfMonth" name="dayOfMonth" type="number" min={1} max={31} step={1} required />

          <label htmlFor="startDate">Início</label>
          <input id="startDate" name="startDate" type="date" defaultValue={today} required />

          <label htmlFor="endDate">Término (opcional)</label>
          <input id="endDate" name="endDate" type="date" />

          <label htmlFor="notes">Observações</label>
          <input id="notes" name="notes" type="text" maxLength={2000} />

          <SubmitButton>Criar recorrência</SubmitButton>
        </form>
      )}
    </>
  );
}
