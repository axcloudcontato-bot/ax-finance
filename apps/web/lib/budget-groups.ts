/**
 * Orçamento em duas seções (receitas e despesas) e, dentro de cada uma, a categoria pai com as
 * subcategorias embaixo. A linha do pai vira subtotal do grupo; o que foi lançado ou orçado direto
 * no pai aparece numa linha própria ("sem subcategoria"), para nada sumir da conta.
 */
export interface BudgetRowLike {
  categoryId: string;
  parentId: string | null;
  kind: "REVENUE" | "EXPENSE";
  name: string;
}

export interface BudgetGroup<T> {
  head: T;
  children: T[];
}

export interface BudgetSection<T> {
  kind: "REVENUE" | "EXPENSE";
  title: string;
  groups: BudgetGroup<T>[];
}

export function budgetSections<T extends BudgetRowLike>(rows: T[]): BudgetSection<T>[] {
  return (["REVENUE", "EXPENSE"] as const).map((kind) => {
    const list = rows.filter((row) => row.kind === kind);
    const ids = new Set(list.map((row) => row.categoryId));
    // Subcategoria cujo pai é de outro tipo (ou está arquivado) vira linha de topo: nunca some.
    const tops = list.filter((row) => !row.parentId || !ids.has(row.parentId));
    return {
      kind,
      title: kind === "REVENUE" ? "Receitas" : "Despesas",
      groups: tops.map((head) => ({ head, children: list.filter((row) => row.parentId === head.categoryId) })),
    };
  });
}
