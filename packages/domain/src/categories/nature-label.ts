/**
 * Mesmos rótulos de apps/web/lib/category-labels.ts — duplicado aqui porque
 * o pacote de domínio não pode depender do app web, e o relatório de DRE
 * (managerial-income-statement.ts) precisa do fallback de rótulo no servidor.
 */
export const NATURE_LABEL: Record<string, string> = {
  OPERATING_REVENUE: "Receita operacional",
  COST: "Custo",
  EXPENSE: "Despesa",
  INVESTMENT: "Investimento",
  FINANCING: "Financiamento",
  EQUITY: "Patrimônio",
  TECHNICAL_TRANSFER: "Transferência técnica",
};
