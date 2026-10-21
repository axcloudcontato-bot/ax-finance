import { randomUUID } from "node:crypto";
import type { listActiveCategories, listCostCenters, listParties } from "@ax-finance/domain";
import { SubmitButton } from "@/components/ui/submit-button";
import { CategoryPicker } from "@/components/categories/category-picker";
import { PartyPicker } from "@/components/parties/party-picker";
import { todayDateOnlyString } from "@/lib/dates";

type CategoryOption = Awaited<ReturnType<typeof listActiveCategories>>[number];
type PartyOption = Awaited<ReturnType<typeof listParties>>[number];
type CostCenterOption = Awaited<ReturnType<typeof listCostCenters>>[number];

export function InstallmentForm({
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
    <div className="card">
      <p className="subtitle">
        Cria vários títulos de uma vez, com vencimentos mensais a partir da primeira parcela —
        diferente de uma recorrência (que gera títulos ao longo do tempo e ainda não existe aqui).
      </p>

      {error ? <p className="error">{error}</p> : null}

      {(
        <form action={action}>
          <input type="hidden" name="idempotencyKey" value={randomUUID()} />
          <div className="form-grid">
            <div className="span-2">
              <label htmlFor="description">Descrição</label>
              <input id="description" name="description" type="text" required maxLength={500} />
            </div>

            <div>
              <label htmlFor="categoryId">Categoria</label>
              <CategoryPicker id="categoryId" kind={kind} categories={categories.map(({ id, name, parentId }) => ({ id, name, parentId }))} />
            </div>

            {parties ? (
              <div>
                <label htmlFor="partyId">{partyLabel ?? "Cliente/fornecedor"} (opcional)</label>
                <PartyPicker id="partyId" role={kind === "RECEIVABLE" ? "CLIENT" : "SUPPLIER"} noun={kind === "RECEIVABLE" ? "cliente" : "fornecedor"} parties={parties.map(({ id, name }) => ({ id, name }))} />
              </div>
            ) : null}

            {costCenters && costCenters.length > 0 ? (
              <div>
                <label htmlFor="costCenterId">Centro de custo (opcional)</label>
                <select id="costCenterId" name="costCenterId" defaultValue="">
                  <option value="">Nenhum</option>
                  {costCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
                </select>
              </div>
            ) : null}

            <div>
              <label htmlFor="totalAmount">Valor total (R$)</label>
              <input
                id="totalAmount"
                name="totalAmount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                required
              />
            </div>

            <div>
              <label htmlFor="installmentCount">Quantidade de parcelas</label>
              <input
                id="installmentCount"
                name="installmentCount"
                type="number"
                min={2}
                step={1}
                defaultValue={2}
                required
              />
            </div>

            <div>
              <label htmlFor="firstDueDate">Vencimento da 1ª parcela</label>
              <input id="firstDueDate" name="firstDueDate" type="date" defaultValue={today} required />
            </div>

            <div>
              <label htmlFor="intervalMonths">Intervalo entre parcelas (meses)</label>
              <input
                id="intervalMonths"
                name="intervalMonths"
                type="number"
                min={1}
                step={1}
                defaultValue={1}
                required
              />
            </div>

            <div className="span-2">
              <label htmlFor="notes">Observações</label>
              <input id="notes" name="notes" type="text" maxLength={2000} />
            </div>
          </div>

          <div className="modal-form-footer"><SubmitButton>Parcelar</SubmitButton></div>
        </form>
      )}
    </div>
  );
}
