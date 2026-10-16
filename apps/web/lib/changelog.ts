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
    id: "2026-10-16-antecipar-fatura",
    date: "2026-10-16",
    title: "Antecipar fatura do cartão",
    summary: "Adiante o valor que quiser de uma fatura que ainda não fechou.",
    changes: [
      { kind: "NEW", text: "Na página do cartão ou da fatura, \"Antecipar fatura\" registra um pagamento antes do fechamento com o valor que você escolher, até o total lançado na fatura até agora. O valor sai da conta escolhida e libera limite na hora; quando a fatura fechar, falta pagar só a diferença. Vale também para faturas futuras com parcelas." },
    ],
  },
  {
    id: "2026-10-16-cadastro-rapido-compra-cartao",
    date: "2026-10-16",
    title: "Estabelecimento e fornecedor na hora do lançamento",
    summary: "Cadastre o estabelecimento da compra no cartão, ou o cliente/fornecedor do lançamento, sem sair da janela.",
    changes: [
      { kind: "NEW", text: "Na Nova compra do cartão, \"+ Novo estabelecimento\" e \"+ Nova categoria\" abrem uma janela por cima da compra. O cadastro já volta escolhido e o resto da compra continua preenchido." },
      { kind: "NEW", text: "Na Nova entrada e Nova saída, \"+ Novo cliente\" e \"+ Novo fornecedor\" funcionam do mesmo jeito. Basta o nome; o resto do cadastro pode ser completado depois em Cadastros > Clientes e fornecedores." },
      { kind: "FIXED", text: "Espaçamento do quadro \"Impacto desta compra\" na janela de compra do cartão." },
    ],
  },
  {
    id: "2026-10-16-categoria-no-lancamento",
    date: "2026-10-16",
    title: "Crie a categoria na hora do lançamento",
    summary: "Faltou a categoria? Cadastre na própria janela de entrada ou saída, sem sair da tela.",
    changes: [
      { kind: "NEW", text: "Na janela de Nova entrada e Nova saída, \"+ Nova categoria\", logo abaixo do campo Categoria, abre uma janela por cima do lançamento: informe o nome, escolha se fica dentro de outra categoria e confirme. A categoria nova já aparece escolhida, e o que você tinha preenchido no lançamento continua lá." },
    ],
  },
  {
    id: "2026-10-16-icones-categorias",
    date: "2026-10-16",
    title: "Ícones nas categorias",
    summary: "Cada categoria de receita e despesa ganhou um ícone de traço fino que combina com ela.",
    changes: [
      { kind: "IMPROVED", text: "Em Cadastros > Categorias e no Orçamento, cada categoria aparece com um ícone escolhido pelo nome: casa para Aluguel, gota para Água, raio para Luz, carrinho para Supermercado e assim por diante. Categorias com nome diferente recebem o ícone de receita ou de despesa." },
    ],
  },
  {
    id: "2026-10-16-calendario-celular",
    date: "2026-10-16",
    title: "Calendário completo no celular",
    summary: "A grade do mês aparece também no celular, com marcas de a receber e a pagar.",
    changes: [
      { kind: "IMPROVED", text: "No celular, o calendário mostra o mês inteiro: cada dia tem um ponto verde quando há algo a receber e vermelho quando há algo a pagar. Toque no dia para ver o detalhe; a agenda em lista continua logo abaixo." },
    ],
  },
  {
    id: "2026-10-16-visual-mais-calmo",
    date: "2026-10-16",
    title: "Visual mais limpo, cor onde importa",
    summary: "Topo neutro e cores usadas só para indicar entrada, saída, atraso e atenção.",
    changes: [
      { kind: "IMPROVED", text: "A barra do topo ficou neutra, com a marca em destaque, e cansa menos no uso diário." },
      { kind: "IMPROVED", text: "No painel, os alertas mostram a gravidade por uma marca colorida na lateral, com o texto mais fácil de ler. Os indicadores e os botões de nova receita e nova despesa usam cor só no ícone." },
    ],
  },
  {
    id: "2026-10-16-janelas-padronizadas",
    date: "2026-10-16",
    title: "Janelas com o mesmo cabeçalho",
    summary: "Todas as janelas ganharam ícone, título e contexto no mesmo padrão.",
    changes: [
      { kind: "IMPROVED", text: "Toda janela abre com um ícone do mesmo tamanho, que indica a ação (editar, registrar, cancelar...), o título e, embaixo, a que conta, cartão ou lançamento ela se refere. Ações que apagam ou cancelam aparecem com o ícone em vermelho." },
    ],
  },
  {
    id: "2026-10-16-categorias-receitas-despesas",
    date: "2026-10-16",
    title: "Categorias separadas em receitas e despesas",
    summary: "Em Cadastros > Categorias, receitas e despesas ficam em seções próprias.",
    changes: [
      { kind: "IMPROVED", text: "As categorias de receita e de despesa aparecem em seções separadas, cada uma com suas subcategorias, e a escolha da categoria pai também separa as duas." },
    ],
  },
  {
    id: "2026-10-15-orcamento-receitas-despesas",
    date: "2026-10-15",
    title: "Orçamento com receitas e despesas separadas",
    summary: "Planeje também o que espera receber e veja cada categoria principal somando as suas subcategorias.",
    changes: [
      { kind: "NEW", text: "O orçamento do mês e do ano tem duas seções: Receitas (quanto espera receber, comparado com o que entrou) e Despesas (quanto pretende gastar). O resumo mostra o resultado previsto." },
      { kind: "IMPROVED", text: "Subcategorias aparecem agrupadas embaixo da categoria principal, que mostra o subtotal do grupo. Ex.: Moradia soma Aluguel, Condomínio, Água e Luz." },
      { kind: "IMPROVED", text: "Novas contas já começam com Aluguel, Condomínio, Água, Luz, Gás e IPTU separados dentro de Moradia." },
      { kind: "FIXED", text: "Salvar o orçamento do ano ficou mais rápido com muitas categorias. Se o sistema for atualizado com a tela aberta, aparece um aviso para recarregar a página." },
    ],
  },
  {
    id: "2026-10-15-detalhes-cartoes-contas",
    date: "2026-10-15",
    title: "Detalhes de cartões e contas numa janela",
    summary: "Clique num cartão ou numa conta para ver limite, faturas, saldo e últimos movimentos sem sair da tela.",
    changes: [
      { kind: "IMPROVED", text: "No painel e em Cartões de crédito, o cartão abre uma janela com limite usado e disponível, fatura aberta, próximo pagamento e as faturas pendentes, cada uma com link." },
      { kind: "NEW", text: "Em Contas, clique no nome da conta ou carteira para ver o saldo atual, o saldo de abertura e os últimos movimentos: baixas, devoluções, transferências e ajustes." },
    ],
  },
  {
    id: "2026-10-15-tabela-da-divida",
    date: "2026-10-15",
    title: "Tabela da dívida sem sair da lista",
    summary: "Em Dívidas e financiamentos, \"Ver tabela\" abre a tabela de amortização numa janela.",
    changes: [
      { kind: "IMPROVED", text: "\"Ver tabela\" abre uma janela com saldo devedor, quanto falta pagar, juros restantes e a tabela completa das parcelas, sem sair da lista. A página da dívida continua disponível para arquivar ou excluir." },
    ],
  },
  {
    id: "2026-10-15-parcelas-curtas",
    date: "2026-10-15",
    title: "Parcelas com descrição mais curta",
    summary: "Parcelas de dívidas e compras no cartão aparecem como \"Nome (1/12)\".",
    changes: [
      { kind: "IMPROVED", text: "As parcelas de dívidas passam a se chamar \"Nome (3/12)\" em vez de \"Nome — parcela 3/12\", inclusive as já cadastradas. Nas faturas do cartão, as compras parceladas seguem o mesmo formato." },
    ],
  },
  {
    id: "2026-10-15-cartao-de-avisos",
    date: "2026-10-15",
    title: "Avisos novos num só cartão",
    summary: "Os lembretes chegam juntos no canto da tela: veja quantos são e abra a lista quando quiser.",
    changes: [
      { kind: "IMPROVED", text: "Os avisos não lidos aparecem num cartão compacto no canto inferior direito, com a quantidade e o mais recente. Clique para ver a lista com ícone, resumo e há quanto tempo cada um chegou." },
      { kind: "IMPROVED", text: "Abrir um aviso leva direto à tela certa e o marca como lido. Fechar o cartão não apaga nada: os avisos continuam na campainha." },
    ],
  },
  {
    id: "2026-10-15-leitura-e-toque",
    date: "2026-10-15",
    title: "Mais fácil de ler e de tocar",
    summary: "Textos coloridos mais nítidos, barra do topo mais legível e botões maiores no celular.",
    changes: [
      { kind: "IMPROVED", text: "Links, valores positivos e negativos, percentuais dos cofrinhos e o botão principal ganharam contraste suficiente para leitura confortável, inclusive no tema claro." },
      { kind: "IMPROVED", text: "Verde, vermelho e âmbar agora significam a mesma coisa em todas as telas: entrou, saiu ou atrasou, e atenção." },
      { kind: "IMPROVED", text: "No celular, botões, abas e itens do menu têm altura mínima para o toque, e Novidades e Aparência ficam no menu do perfil, deixando o topo mais limpo." },
    ],
  },
  {
    id: "2026-10-15-detalhes-que-expandem",
    date: "2026-10-15",
    title: "Detalhes que se abrem de onde você clicou",
    summary: "Cofrinhos no painel mostram meta, prazo e quanto guardar por mês sem sair da tela.",
    changes: [
      { kind: "NEW", text: "No painel e na lista de cofrinhos, clique num cofrinho (ou em Detalhes) para ver o guardado, o que falta, o prazo, quanto guardar por mês e a conta padrão." },
      { kind: "IMPROVED", text: "As janelas de detalhes e de formulários agora se abrem a partir do botão ou cartão clicado e voltam para ele ao fechar. Quem ativou \"reduzir movimento\" no sistema continua sem animação." },
    ],
  },
  {
    id: "2026-10-12-orcamento-repete-meses",
    date: "2026-10-12",
    title: "Orçamento do ano mais rápido de preencher",
    summary: "Digite o valor de uma categoria uma vez e ele se repete nos meses vazios.",
    changes: [
      { kind: "IMPROVED", text: "Na grade do orçamento anual, o primeiro valor digitado numa categoria preenche os meses ainda vazios. Ajuste à mão só os meses diferentes; valores já salvos não mudam." },
      { kind: "FIXED", text: "Fluxo de caixa, Contas a receber/pagar e Rentabilidade: filtros alinhados com o botão e espaçamento uniforme nos cartões." },
    ],
  },
  {
    id: "2026-10-10-historico-previsao-rentabilidade",
    date: "2026-10-10",
    title: "Histórico preservado, previsão de caixa e rentabilidade",
    summary: "Compare projetos, simule atrasos nos recebimentos e recupere a carteira e os PDFs guardados nos fechamentos.",
    changes: [
      { kind: "NEW", text: "Fechamentos preservam versões da carteira, resumo mensal e rentabilidade. Reabrir e fechar novamente mantém as versões anteriores. A posição informa o dia da captura." },
      { kind: "NEW", text: "PDFs emitidos passam a ficar guardados para recuperar o documento original, mesmo depois de novos pagamentos e ajustes." },
      { kind: "NEW", text: "Planeje recebimentos com data provável, promessa do cliente, conta prevista e probabilidade estimada. O vencimento contratual permanece igual." },
      { kind: "NEW", text: "Fluxo de caixa simula atrasos, compara o saldo com uma reserva mínima e identifica pagamentos no primeiro dia de insuficiência. Recorrências ainda não geradas aparecem como estimativas sem duplicação." },
      { kind: "NEW", text: "Rentabilidade por centro, projeto ou serviço mostra contribuição, fixos diretos e rateados e ponto de equilíbrio. Gastos sem classificação impedem cálculos que poderiam induzir decisões erradas." },
    ],
  },
  {
    id: "2026-10-10-integridade-financeira",
    date: "2026-10-10",
    title: "Fechamento, dívidas e relatórios mais consistentes",
    summary: "Meses fechados ficam protegidos, dívidas acompanham os pagamentos efetivos e os relatórios compartilham a mesma projeção de caixa.",
    changes: [
      { kind: "FIXED", text: "Meses fechados bloqueiam criação, edição, cancelamento, rateio e reclassificação de títulos. Receber ou pagar em outro mês aberto continua permitido." },
      { kind: "FIXED", text: "Saldo devedor considera a parcela realmente paga, baixas parciais, descontos e estornos. Pagamentos com data futura não reduzem a posição de hoje." },
      { kind: "IMPROVED", text: "DRE separa amortização e juros contratuais. O resultado operacional deixa de contar parcelas de empréstimos como despesas operacionais." },
      { kind: "FIXED", text: "Dívidas arquivadas com saldo permanecem no patrimônio e podem ser consultadas na lista. A tela informa o alcance dos valores acompanhados." },
      { kind: "FIXED", text: "Painel, calendário e fluxo compartilham a projeção. Horizontes de 30, 60 e 90 dias incluem exatamente essa quantidade de dias. Relatório mensal e calendário consideram devoluções e excluem baixas futuras do realizado." },
    ],
  },
  {
    id: "2026-10-10-emails-resumo",
    date: "2026-10-10",
    title: "E-mails de resumo com visual novo",
    summary: "O resumo diário de vencimentos e o resumo semanal chegam organizados em cartões, bons de ler no computador e no celular.",
    changes: [
      { kind: "IMPROVED", text: "Resumo do dia: totais a receber e a pagar no topo e os títulos separados em vencidos, que vencem hoje e próximos dias, com valor, cliente ou fornecedor e dias de atraso." },
      { kind: "IMPROVED", text: "Resumo semanal e relatório mensal mostram os números principais em cartões coloridos." },
    ],
  },
  {
    id: "2026-10-10-lembrete-cobranca",
    date: "2026-10-10",
    title: "Lembrete de cobrança de cara nova",
    summary: "A janela de Cobrar/Lembrar ficou mais clara no computador e no celular, com envio direto pelo WhatsApp.",
    changes: [
      { kind: "IMPROVED", text: "Resumo no topo com o valor em aberto, o vencimento, a situação (vence hoje, dias de atraso) e quantas vezes o cliente já foi cobrado." },
      { kind: "NEW", text: "Botão para enviar a mensagem pelo WhatsApp: abre a conversa do cliente quando ele tem telefone cadastrado." },
      { kind: "FIXED", text: "A mensagem agora pode ser editada de verdade antes de enviar; copiar, WhatsApp e e-mail usam o texto ajustado." },
    ],
  },
  {
    id: "2026-10-10-dividas-patrimonio",
    date: "2026-10-10",
    title: "Dívidas, financiamentos e patrimônio",
    summary: "Saiba quanto ainda deve, quanto paga de juros e quanto vale tudo o que você tem.",
    changes: [
      { kind: "NEW", text: "Dívidas: cadastre financiamento ou empréstimo (tabela Price ou SAC) e as parcelas que faltam viram saídas. O saldo devedor cai a cada parcela paga." },
      { kind: "NEW", text: "Tabela de amortização com juros e amortização de cada parcela, e quanto de juros ainda falta pagar." },
      { kind: "NEW", text: "Patrimônio: contas, cofrinhos, bens e investimentos menos dívidas e cartões, com o patrimônio líquido." },
    ],
  },
  {
    id: "2026-10-10-pacote-gestao",
    date: "2026-10-10",
    title: "PIX na cobrança, calendário, regras de categoria e mais",
    summary: "Menos trabalho repetido e mais visão do mês e do ano.",
    changes: [
      { kind: "NEW", text: "Cobrança com QR Code PIX e \"PIX copia e cola\" com o valor em aberto. Configure a chave em Entradas > PIX." },
      { kind: "NEW", text: "Calendário financeiro: o que vence em cada dia e o saldo previsto ao fim do dia." },
      { kind: "NEW", text: "Regras de categoria (Cadastros > Regras): \"descrição contém UBER → Transporte\" preenche sozinho os lançamentos novos." },
      { kind: "NEW", text: "Na Conciliação, \"Lançar e conciliar\" cria o lançamento da linha do extrato, dá baixa e concilia de uma vez, inclusive todas as linhas reconhecidas pelas regras." },
      { kind: "NEW", text: "Orçamento do ano: os 12 meses numa grade, com \"Planejar o ano\" a partir de um mês, do ano anterior ou do gasto real, com reajuste." },
      { kind: "NEW", text: "Relatório mensal em PDF (Relatórios > Relatório mensal), enviado por e-mail no início de cada mês." },
      { kind: "IMPROVED", text: "Rateio do lançamento organizado em colunas, com a soma conferida enquanto você digita." },
    ],
  },
  {
    id: "2026-10-09-cofrinhos",
    date: "2026-10-09",
    title: "Cofrinhos: guarde dinheiro para cada objetivo",
    summary: "Crie cofrinhos com meta e veja a barra encher até 100%.",
    changes: [
      { kind: "NEW", text: "Novo menu Cofrinhos: crie quantos quiser (viagem, reserva de emergência, impostos...), cada um com meta, prazo opcional, ícone e cor." },
      { kind: "NEW", text: "Guardar tira o valor da conta escolhida e põe no cofrinho; resgatar devolve. O saldo disponível já mostra o valor certo." },
      { kind: "NEW", text: "Barra de progresso, quanto falta, quanto guardar por mês até o prazo e se você está no ritmo." },
      { kind: "NEW", text: "Histórico de cada cofrinho com estorno, e um resumo dos cofrinhos no painel." },
    ],
  },
  {
    id: "2026-10-08-dispositivo-confiavel",
    date: "2026-10-08",
    title: "Confiar neste dispositivo no login",
    summary: "Quem usa a confirmação em duas etapas não precisa digitar o código a cada acesso.",
    changes: [
      { kind: "NEW", text: "Na tela de verificação, marque \"Confiar neste dispositivo por 30 dias\": nos próximos acessos desse aparelho basta a senha." },
      { kind: "NEW", text: "Em Configurações > Segurança você vê os dispositivos confiáveis e pode remover um ou todos. Redefinir a senha ou refazer a proteção também os remove." },
    ],
  },
  {
    id: "2026-10-08-entradas-saidas",
    date: "2026-10-08",
    title: "Entradas e saídas mais rápidas e completas",
    summary: "Achar, pagar, cobrar e conferir lançamentos ficou bem mais simples.",
    changes: [
      { kind: "NEW", text: "Busca por descrição, documento, observação ou nome da pessoa, com filtros de categoria, cliente/fornecedor, centro de custo e faixa de valor." },
      { kind: "NEW", text: "Coluna de cliente/fornecedor e ordenação por vencimento, valor, descrição ou pessoa, clicando no cabeçalho." },
      { kind: "NEW", text: "Botão Pagar ou Receber direto na linha, já com valor, conta e forma de pagamento preenchidos." },
      { kind: "NEW", text: "Ao marcar várias linhas, a barra mostra quantas são e quanto somam, com as operações em lote ali mesmo." },
      { kind: "NEW", text: "Exportar a lista em CSV com os mesmos filtros da tela." },
      { kind: "NEW", text: "Conta prevista, número do documento, forma de pagamento prevista e dados de pagamento (linha digitável ou chave PIX, com botão copiar) em cada lançamento." },
      { kind: "NEW", text: "Saídas podem ser marcadas como agendadas no banco, para não pagar duas vezes." },
      { kind: "NEW", text: "Aviso de possível duplicidade ao lançar algo parecido com um lançamento existente." },
      { kind: "NEW", text: "Multa e juros por atraso configuráveis: ao receber um título vencido, o sistema sugere os valores." },
      { kind: "NEW", text: "Cobrança de recebíveis: mensagem pronta para copiar ou abrir no e-mail, com registro de quantas vezes e quando cobrou." },
      { kind: "NEW", text: "Relatório de entradas e saídas por forma de pagamento (PIX, boleto, cartão...), com o realizado e o previsto." },
      { kind: "IMPROVED", text: "No dashboard, escolher uma conta agora mostra a projeção de caixa dela, com os títulos que têm essa conta como conta prevista." },
      { kind: "IMPROVED", text: "A multa e os juros sugeridos na baixa são recalculados ao mudar a data ou o valor recebido." },
    ],
  },
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
