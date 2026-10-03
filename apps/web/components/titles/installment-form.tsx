import { randomUUID } from "node:crypto";
import type { listActiveCategories, listCostCenters, listParties } from "@ax-finance/domain";
import { SubmitButton } from "@/components/ui/submit-button";

type CategoryOption = Awaited<ReturnType<typeof listActiveCategories>>[number];
type PartyOption = Awaited<ReturnType<typeof listParties>>[number];
type CostCenterOption = Awaited<ReturnType<typeof listCostCenters>>[number];

export function InstallmentForm({
  action,
  categories,
  parties,
  costCenters,
  partyLabel,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: CategoryOption[];
  parties?: PartyOption[];
  costCenters?: CostCenterOption[];
  partyLabel?: string;
  error?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="card">
      <p className="subtitle">
        Cria vários títulos de uma vez, com vencimentos mensais a partir da primeira parcela —
        diferente de uma recorrência (que gera títulos ao longo do tempo e ainda não existe aqui).
      </p>

      {error ? <p className="error">{error}</p> : null}

      {categories.length === 0 ? (
        <p className="muted">
          Cadastre uma categoria antes de lançar — nenhum título pode ficar sem classificação
          (Seção 6).
        </p>
      ) : (
        <form action={action}>
          <input type="hidden" name="idempotencyKey" value={randomUUID()} />
          <div className="form-grid">
            <div className="span-2">
              <label htmlFor="description">Descrição</label>
              <input id="description" name="description" type="text" required maxLength={500} />
            </div>

            <div>
              <label htmlFor="categoryId">Categoria</label>
              <select id="categoryId" name="categoryId" required defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.parentId ? `  ↳ ${category.name}` : category.name}
                  </option>
                ))}
              </select>
            </div>

            {parties && parties.length > 0 ? (
              <div>
                <label htmlFor="partyId">{partyLabel ?? "Cliente/fornecedor"} (opcional)</label>
                <select id="partyId" name="partyId" defaultValue="">
                  <option value="">Nenhum</option>
                  {parties.map((party) => (
                    <option key={party.id} value={party.id}>
                      {party.name}
                    </option>
                  ))}
                </select>
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

          <SubmitButton>Parcelar</SubmitButton>
        </form>
      )}
    </div>
  );
}
