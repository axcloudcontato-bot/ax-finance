# Evolução de UI e UX — AX Finance

Referência: auditoria de 20/10/2026. Implementação incremental, com revisão visual a cada entrega. Este documento registra o que foi entregue; não representa a conclusão das 51 sugestões.

## Etapas

| Etapa | Escopo | Situação |
| --- | --- | --- |
| 1. Base visual e navegação | Tipografia, superfícies, espaçamento, contexto da empresa, menu e hierarquia de ações | Iniciada: primeira entrega implementada |
| 2. Lançamentos e formulários | Entradas/Saídas, ações secundárias, filtros compactos, listas móveis e rodapé acessível nos modais | Entrega principal implementada; criação rápida coberta |
| 3. Dashboard | Resumo prioritário, filtros compactos, escopo dos indicadores, gráficos e alertas | Implementada a reorganização visual e a explicação de escopo |
| 4. Demais módulos e estados | Cartões, patrimônio, relatórios, segurança, carregamento, vazio e erro | Em andamento: Patrimônio, Cartões, Segurança e carregamento |
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


## Entrega 3 — dashboard (20/10/2026)

- Barra compacta com período, filtros e criação de entrada/saída; retirada a chamada redundante Filtros analíticos.
- Filtros aplicados visíveis como etiquetas, com remoção individual mantendo os demais parâmetros da navegação.
- Saldo atual identificado pela data de posição. Explicação de que período e filtros de categoria/pessoa/centro não alteram o saldo das contas.
- Detalhamento do saldo informa quais contas entram no disponível.
- Quatro indicadores principais em duas colunas no celular.
- Estado sem pendências compacto; alertas existentes preservados quando há problemas.
- Agenda e cartões antecipados para antes dos gráficos; projeção de caixa antes do histórico de seis meses.
- Resultado por competência com datas explícitas, separado dos movimentos realizados do período.
- Fórmulas, permissões e regras financeiras preservadas. A linha tracejada foi corrigida na entrega 1.
### Validação da entrega 3

- TypeScript, ESLint e verificação de diferenças passaram.
- Inspeção visual em 390 × 844 e 1280 × 720, na base local de testes.
- Aplicação de categoria: etiqueta e explicação de escopo apareceram, mantendo o saldo atual e a restrição de projeção.
- Remoção individual pela etiqueta restaurou o consolidado e retirou a categoria da URL.
- Largura móvel conferida em 390 px, sem transbordamento horizontal da página.
- Commit e envio direto à branch principal autorizados pelo usuário. Implantação em produção não executada nesta entrega.


## Entrega 4 — primeira parte: módulos e carregamento

- Patrimônio: metodologia em seção expansível de largura total; colunas de recursos e obrigações equilibradas. Aviso de visão parcial permanece visível quando o perfil não pode consultar cartões.
- Cartões: agenda de faturas antes da previsão; projeção dos próximos seis meses expansível, com valores preservados. Resumo móvel em duas colunas.
- Segurança: títulos com hierarquia consistente e botão Configurar proteção destacado. Nenhuma alteração de autenticação, dispositivos ou permissões.
- ~~Carregamento compartilhado nas rotas autenticadas~~ — retirado em 21/10/2026: o `loading.tsx` no nível de `app/(app)` deixava os formulários com redirecionamento (server actions) presos em "carregando" no build de produção (e2e do CI). Se voltar, precisa ser por rota e testado com `next start`.
- Continuação pendente desta etapa: relatórios, estados vazios específicos e revisão dos formulários de edição/baixa/parcelamento/transferência. A entrega não conclui todas as sugestões da auditoria.
### Validação da primeira parte da etapa 4

- TypeScript passou. ESLint sem erros; permanece o aviso preexistente sobre a imagem local do QR code na configuração de segurança.
- Patrimônio conferido em desktop, incluindo abrir/fechar a metodologia.
- Cartões conferido em 390 × 844: agenda adaptada para cartões sem rolagem lateral; previsão expansível mantém os seis meses e seus valores.
- Segurança conferida no celular, com ação azul e largura da página de 390 px. Nenhuma configuração de autenticação foi alterada.
- Estado de carregamento observado durante a navegação local.
- Alterações locais, sem commit ou push desta entrega (commitadas junto com a segunda parte).

## Entrega 4 — segunda parte (21/10/2026)

- Rodapé fixo reutilizável (`modal-form-footer`) nos formulários em janela: edição de lançamento, baixa, parcelamento, transferência, compra no cartão e pagamento/antecipação de fatura. Fora de janela, a linha de ações segue no fluxo normal.
- Lista de Entradas/Saídas vazia separa "nenhum lançamento neste período" (com atalho para lançar) de "nenhum resultado para estes filtros" (com Limpar filtros, preservando o período).
- Dashboard: "Disponível para uso hoje" e "Projeção dos próximos N dias"; o detalhe do saldo mostra a composição (disponível, fora do disponível e saldo total registrado).
- Pastas de outros projetos na mesma cópia local ignoradas pelo Git.

### Validação da segunda parte

- TypeScript, ESLint, testes de integração e build de produção.
- Conferência local em 1280 × 720 e 375 × 812: edição e baixa com rodapé preso no fim do diálogo; transferência; listas vazias por período e por busca; detalhe do saldo.

### Fora desta entrega (dependem de decisão do produto)

- Login móvel (o desenho do login está congelado por decisão do responsável).
- Topo com avatar e Aparência/Novidades em acesso secundário.
- Grupos do menu recolhíveis.
