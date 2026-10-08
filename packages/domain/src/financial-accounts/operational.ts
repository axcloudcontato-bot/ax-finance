/**
 * Filtro das contas "de verdade" do cliente. A conta interna de um cofrinho (SAVINGS_GOAL) só se
 * movimenta pelo próprio cofrinho (guardar/resgatar): não recebe baixa, ajuste, extrato, cartão nem
 * transferência comum, e não aparece em Contas nem nos seletores.
 */
export const OPERATIONAL_ACCOUNT = { type: { not: "SAVINGS_GOAL" } } as const;
