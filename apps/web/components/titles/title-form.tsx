import type { listActiveCategories } from "@ax-finance/domain";

type CategoryOption = Awaited<ReturnType<typeof listActiveCategories>>[number];

export function TitleForm({
  action,
  categories,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: CategoryOption[];
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
          <label htmlFor="description">Descrição</label>
          <input id="description" name="description" type="text" required maxLength={500} />

          <label htmlFor="categoryId">Categoria</label>
          <select id="categoryId" name="categoryId" required defaultValue="">
            <option value="" disabled>
              Selecione
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.parentId ? `  ↳ ${category.name}` : category.name}
              </option>
            ))}
          </select>

          <label htmlFor="amount">Valor (R$)</label>
          <input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            required
          />

          <label htmlFor="competenceDate">Competência</label>
          <input id="competenceDate" name="competenceDate" type="date" defaultValue={today} required />

          <label htmlFor="dueDate">Vencimento</label>
          <input id="dueDate" name="dueDate" type="date" defaultValue={today} required />

          <label htmlFor="notes">Observações</label>
          <input id="notes" name="notes" type="text" maxLength={2000} />

          <button type="submit">Salvar</button>
        </form>
      )}
    </div>
  );
}
