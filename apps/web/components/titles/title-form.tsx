import { randomUUID } from "node:crypto";
import type { listActiveCategories, listCostCenters, listParties } from "@ax-finance/domain";
import { SubmitButton } from "@/components/ui/submit-button";
import { todayDateOnlyString } from "@/lib/dates";

type CategoryOption = Awaited<ReturnType<typeof listActiveCategories>>[number];
type PartyOption = Awaited<ReturnType<typeof listParties>>[number];
type CostCenterOption = Awaited<ReturnType<typeof listCostCenters>>[number];

export function TitleForm({
  action,
  actionAndContinue,
  categories,
  parties,
  costCenters,
  partyLabel,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** Segundo botão ("Salvar e nova entrada/saída") — mesma validação, mas o
   * redirect de sucesso mantém o modal aberto com o formulário limpo em vez
   * de fechar. Omitido quando o form não precisa dessa opção. */
  actionAndContinue?: (formData: FormData) => void | Promise<void>;
  categories: CategoryOption[];
  parties?: PartyOption[];
  costCenters?: CostCenterOption[];
  partyLabel?: string;
  error?: string;
}) {
  const today = todayDateOnlyString();

  return (
    <>
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
              <label htmlFor="amount">Valor (R$)</label>
              <input
                id="amount"
                name="amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                required
              />
            </div>

            <div>
              <label htmlFor="competenceDate">Competência</label>
              <input id="competenceDate" name="competenceDate" type="date" defaultValue={today} required />
            </div>

            <div>
              <label htmlFor="dueDate">Vencimento</label>
              <input id="dueDate" name="dueDate" type="date" defaultValue={today} required />
            </div>

            <div className="span-2">
              <label htmlFor="notes">Observações</label>
              <input id="notes" name="notes" type="text" maxLength={2000} />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <SubmitButton>Salvar</SubmitButton>
            {actionAndContinue ? (
              <SubmitButton formAction={actionAndContinue} className="secondary">
                Salvar e nova
              </SubmitButton>
            ) : null}
          </div>
        </form>
      )}
    </>
  );
}
