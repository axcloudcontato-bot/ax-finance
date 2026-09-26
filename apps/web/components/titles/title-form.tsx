import type { listActiveCategories, listParties } from "@ax-finance/domain";

type CategoryOption = Awaited<ReturnType<typeof listActiveCategories>>[number];
type PartyOption = Awaited<ReturnType<typeof listParties>>[number];

export function TitleForm({
  action,
  categories,
  parties,
  partyLabel,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: CategoryOption[];
  parties?: PartyOption[];
  partyLabel?: string;
  error?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="card">
      {error ? <p className="error">{error}</p> : null}

      {categories.length === 0 ? (
        <p className="muted">
          Cadastre uma categoria antes de lançar — nenhum título pode ficar sem classificação
          (Seção 6).
        </p>
      ) : (
        <form action={action}>
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

          <button type="submit">Salvar</button>
        </form>
      )}
    </div>
  );
}
