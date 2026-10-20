# Evolução de UI e UX — AX Finance

Referência: auditoria de 20/10/2026. Implementação incremental, com revisão visual a cada entrega. Este documento registra o que foi entregue; não representa a conclusão das 51 sugestões.

## Etapas

| Etapa | Escopo | Situação |
| --- | --- | --- |
| 1. Base visual e navegação | Tipografia, superfícies, espaçamento, contexto da empresa, menu e hierarquia de ações | Iniciada: primeira entrega implementada |
| 2. Lançamentos e formulários | Entradas/Saídas, ações secundárias, filtros compactos, listas móveis e rodapé acessível nos modais | Entrega principal implementada; criação rápida coberta |
| 3. Dashboard | Resumo prioritário, filtros compactos, escopo dos indicadores, gráficos e alertas | Pendente; título e linha tracejada antecipados |
| 4. Demais módulos e estados | Cartões, patrimônio, relatórios, segurança, carregamento, vazio e erro | Pendente |
| 5. Acesso e apresentação | Login móvel, página comercial, consistência com o produto e revisão final | Pendente |

## Entrega 1 — implementada em 20/10/2026

- Fonte Manrope na área autenticada, carregada localmente.
- Fundo de trabalho separado dos cartões e da navegação nos temas claro e escuro.
- Espaçamento lateral compartilhado de 24 px no desktop e 16 px no celular.
- Títulos e cantos dos cartões com padrão compartilhado.
- Nome da empresa no cabeçalho, com truncamento para nomes longos.
- Menu organizado em Dia a dia, Contas e patrimônio e Planejamento e gestão.
- Página ativa com destaque azul e reconhecimento de rotas de detalhe.
- Alvos do menu de 40 px no desktop e 44 px no celular; foco de teclado explícito.
- Título do dashboard visível, acompanhado de uma descrição curta.
- Cenário sem recebíveis vencidos com linha tracejada, conforme a explicação do gráfico.

### Validação

- TypeScript da aplicação web: passou.
- ESLint dos seis arquivos de componentes/páginas alterados: passou.
- Prévia local com base E2E: dashboard conferido nos temas claro e escuro.
- Celular de 390 × 844: largura total de 390 px, menu de 300 px, abertura e fechamento com Escape conferidos.
- Nenhuma publicação em produção nesta entrega.

### Continuação da etapa 1

- Consolidar a hierarquia de botões principais/secundários sem transformar ações destrutivas ou auxiliares em ações primárias.
- Simplificar os atalhos do cabeçalho e tornar configurações mais fáceis de encontrar.
- Completar o tratamento de foco e isolamento da gaveta móvel.
- Revisar a família de ícones, preservando os significados e rótulos acessíveis.

## Critérios das próximas entregas

1. Manter permissões por plano e por usuário e preservar o período selecionado na navegação.
2. Entradas/Saídas: ação principal identificável e primeiro lançamento mais próximo do início da página no celular.
3. Formulários: salvar e cancelar acessíveis em telas baixas, com rolagem apenas no conteúdo necessário.
4. Dashboard: distinguir caixa, competência, projeção e valores vencidos sem depender apenas de cor.
5. Conferir cada fluxo afetado em desktop e celular, com foco por teclado e estados de erro/vazio pertinentes.


## Entrega 2 — lançamentos e criação rápida (20/10/2026)

- Entradas e Saídas exibem a ação principal e agrupam recorrências, parcelamento, exportação e configurações em Mais ações.
- No celular, a mesma tabela passa a apresentar cada lançamento em cartão, com rótulos de campos, seleção e ações existentes. Não há duplicação dos formulários ou caixas de seleção.
- Ordenação móvel explícita por vencimento, valor, descrição e pessoa; preferências de colunas preservadas.
- Resumo móvel em dois indicadores e uma faixa compacta de contagem/escopo. O primeiro lançamento apareceu dentro dos primeiros 844 px na prévia.
- Criação rápida de entrada/saída com cabeçalho e rodapé fixos, rolagem interna e ação principal azul.
- Ações Salvar entrada/saída, Salvar e criar outra e Cancelar. Enter usa a ação principal; intenção de continuar vem do botão efetivamente acionado.
- Datas emparelhadas no desktop quando não há centro de custo; foco direcionado ao retorno de erro/duplicidade e devolvido ao botão de origem no fechamento.

### Verificações desta entrega

- TypeScript e ESLint dos arquivos alterados passaram, sem avisos.
- Conferência local em 390 × 844 e 1280 × 720.
- Salvar e criar outra criou um lançamento sintético na base E2E e reabriu o formulário limpo.
- Enter criou uma saída sintética, fechou o modal e devolveu o foco ao botão Novo lançamento.
- Seleção em lote marcou as duas entradas e calculou o saldo aberto corretamente.
- Ocultar/restaurar centro de custo e ordenar por valor funcionaram no celular.
- Alterações locais; sem publicação em produção.

### Limites do escopo

O rodapé fixo desta entrega cobre a criação rápida de entradas e saídas. Formulários de edição, baixa, parcelamento e transferência ainda precisam da revisão específica prevista na evolução dos módulos. Os filtros avançados existentes foram preservados, com navegação de situação e resumo adaptados ao celular.
