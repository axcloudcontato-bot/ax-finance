/**
 * Novidades do produto, mostradas ao assinante no botão "Novidades" do menu superior e na página
 * /novidades. É o registro oficial das melhorias: a cada entrega que o assinante percebe, entra uma
 * entrada nova NO TOPO (mais recente primeiro). Texto em linguagem de quem usa o sistema, sem termo
 * técnico, e só o que já está no ar.
 */

export type ChangeKind = "NEW" | "IMPROVED" | "FIXED";

export const CHANGE_KIND_LABEL: Record<ChangeKind, string> = {
  NEW: "Novo",
  IMPROVED: "Melhoria",
  FIXED: "Correção",
};

export interface ChangelogEntry {
  /** Estável e único: é o que guarda "já li" no navegador e a âncora do link. */
  id: string;
  /** AAAA-MM-DD */
  date: string;
  title: string;
  summary: string;
  changes: { kind: ChangeKind; text: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-10-07-dashboard-gestao",
    date: "2026-10-07",
    title: "Dashboard com indicadores de gestão",
    summary: "Além do caixa, o dashboard agora mostra se você está tendo resultado, para onde o dinheiro vai e o que exige atenção.",
    changes: [
      { kind: "NEW", text: "Resultado do período por competência (receitas, despesas, resultado e margem), com comparação ao período anterior. No plano pessoal aparece como Entrou, Saiu, Sobrou e taxa de poupança." },
      { kind: "NEW", text: "Evolução dos últimos 6 meses: receitas, despesas e resultado de cada mês." },
      { kind: "NEW", text: "Agenda dos próximos 7 dias, com atrasados e a vencer, e atalho para cada lançamento." },
      { kind: "NEW", text: "Cartões de crédito no dashboard: limite usado e a próxima fatura de cada cartão." },
      { kind: "NEW", text: "Orçamento do mês: quanto já foi gasto, quanto resta e as categorias perto de estourar." },
      { kind: "NEW", text: "Saúde financeira: dias de caixa, inadimplência, prazos médios de recebimento e pagamento e concentração da receita no maior cliente." },
      { kind: "NEW", text: "Novos avisos em \"O que precisa de atenção\": orçamento estourado, fatura de cartão vencendo, limite do cartão acima de 80%, pouco fôlego de caixa e receita concentrada." },
      { kind: "NEW", text: "Projeção do caixa em 30, 60 ou 90 dias." },
      { kind: "IMPROVED", text: "A lista de categorias agora usa a competência e abre o cartão pela categoria de cada compra. Antes, o gasto no cartão aparecia como uma única linha \"Fatura\"." },
    ],
  },
  {
    id: "2026-10-07-excluir-cartao",
    date: "2026-10-07",
    title: "Excluir cartão de crédito",
    summary: "Cadastrou um cartão por engano ou não usa mais? Agora dá para excluí-lo.",
    changes: [
      { kind: "NEW", text: "Botão de lixeira na página do cartão. A exclusão apaga também as compras e faturas dele, com confirmação antes." },
      { kind: "NEW", text: "Se alguma fatura já teve pagamento registrado, a exclusão é recusada. Nesse caso, arquive o cartão para manter o histórico." },
    ],
  },
  {
    id: "2026-10-06-remover-importacao",
    date: "2026-10-06",
    title: "Remover importação de extrato",
    summary: "Enviou o arquivo errado ou desistiu de importar? Agora dá para descartar ou remover a importação na Conciliação.",
    changes: [
      { kind: "NEW", text: "Descartar uma importação que ainda aguarda confirmação: o arquivo enviado é apagado e nenhuma linha entra na conciliação." },
      { kind: "NEW", text: "Remover uma importação concluída, desde que nenhuma das linhas tenha sido conciliada ou ignorada. Baixas e saldos não mudam, e reenviar o arquivo traz as linhas de volta." },
      { kind: "NEW", text: "Importações que falharam também podem ser retiradas da lista." },
    ],
  },
  {
    id: "2026-10-06-menu-e-novidades",
    date: "2026-10-06",
    title: "Menu mais limpo e central de novidades",
    summary: "Os atalhos da conta saíram do menu lateral e ficaram todos no menu superior, perto de você.",
    changes: [
      { kind: "NEW", text: "Botão Novidades no menu superior, com tudo o que muda no sistema em um só lugar." },
      { kind: "IMPROVED", text: "Suporte, Usuários e acessos, Assinatura e Segurança agora ficam no menu do seu perfil, no topo." },
      { kind: "IMPROVED", text: "O menu lateral ficou só com a navegação do dia a dia e o botão Sair." },
    ],
  },
  {
    id: "2026-10-06-orcamento",
    date: "2026-10-06",
    title: "Orçamento por categoria e mais precisão nos relatórios",
    summary: "Defina quanto quer gastar em cada categoria no mês e acompanhe o realizado em tempo real.",
    changes: [
      { kind: "NEW", text: "Orçamento: limite mensal por categoria, com aviso ao passar de 80% e quando estoura, e cópia do mês anterior." },
      { kind: "NEW", text: "Sugestão de categoria: ao digitar a descrição de um lançamento, o sistema mostra a categoria que você já usou nela. Só sugere; quem decide é você." },
      { kind: "NEW", text: "Gestão Pessoal agora começa com categorias do dia a dia pessoal (mercado, moradia, saúde, lazer e outras)." },
      { kind: "IMPROVED", text: "DRE gerencial separa o resultado operacional do resultado financeiro (juros, multas e tarifas) e deixa investimentos e financiamentos fora do resultado." },
      { kind: "IMPROVED", text: "Entradas e saídas em páginas de 50 itens, com visões (vencidas, hoje, próximas, quitadas): continua rápido mesmo com muitos lançamentos." },
      { kind: "FIXED", text: "O que é \"hoje\" agora respeita o fuso horário do Brasil, e não mais o do servidor: vencimentos à noite aparecem no dia certo." },
    ],
  },
  {
    id: "2026-10-05-cartoes",
    date: "2026-10-05",
    title: "Cartões de crédito",
    summary: "Cadastre seus cartões, lance as compras e acompanhe cada fatura se formando.",
    changes: [
      { kind: "NEW", text: "Cadastro de cartão com banco, limite, dia de fechamento e dia de vencimento." },
      { kind: "NEW", text: "Compras no cartão, à vista ou parceladas, com categoria; cada parcela cai na fatura certa." },
      { kind: "NEW", text: "Fatura por ciclo, com situação (aberta, fechada, vencida, paga) e limite disponível sempre atualizado." },
      { kind: "NEW", text: "Pagamento da fatura pela conta que você escolher, inclusive parcial, e conciliação com o extrato." },
    ],
  },
];

export const LATEST_CHANGELOG_ID = CHANGELOG[0]?.id ?? "";

/** Quantas entradas são mais novas que a última vista (tudo, se nunca viu nenhuma). */
export function unreadChangelogCount(seenId: string | null): number {
  if (!seenId) return CHANGELOG.length;
  const index = CHANGELOG.findIndex((entry) => entry.id === seenId);
  return index === -1 ? CHANGELOG.length : index;
}
