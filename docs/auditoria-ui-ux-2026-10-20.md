# Avaliação de UI e UX — AX Finance

Data: 20/10/2026. Avaliação heurística de produto SaaS, com inspeção visual e leitura dos componentes. Este documento propõe melhorias; não registra uma implementação de redesign.

## Julgamento geral

O AX Finance tem uma base funcional organizada, boa legibilidade dos valores e módulos com propósito claro. Sua maturidade visual ainda é intermediária: login, página comercial, dashboard, listas e configurações não seguem integralmente o mesmo sistema de hierarquia e interação.

O maior ganho virá de tornar a rotina mais direta: identificar a tela, entender o saldo e seu alcance, encontrar o próximo compromisso e executar uma ação com poucos controles competindo pela atenção. Hoje, parte importante da área útil é ocupada por filtros, explicações, resumos redundantes e ações secundárias.

Os problemas de maior impacto estão no celular, no formulário de lançamento e na hierarquia do dashboard. Acrescentar decoração antes de resolver esses pontos aumentaria o trabalho de manutenção sem melhorar proporcionalmente a experiência.

## O que foi examinado

- Página comercial em produção e tela de login.
- Cópia local das telas internas com dados fictícios: dashboard, Entradas, criação de entrada, Cartões, Patrimônio, Fluxo de caixa, Conciliação e Segurança.
- Desktop em 1280 × 720 e celular em 390 × 844 nas telas centrais.
- Temas claro e escuro no dashboard; demais amostras principalmente no tema claro.
- Componentes de navegação, formulários, tabelas, gráficos, mensagens e estilos compartilhados.

As observações de interface interna são da versão local com as melhorias já integradas ao GitHub. Não houve acesso à conta financeira de produção nem alteração dos dados financeiros. Tempos de compilação da prévia local não foram tratados como desempenho da produção. A avaliação não substitui pesquisa com clientes ou certificação completa de acessibilidade.

## Elementos que vale preservar

- Valores monetários com alinhamento à direita e números tabulares nas tabelas.
- Cards financeiros predominantemente neutros, com cor concentrada em sinais relevantes.
- Estrutura de temas claro e escuro e aplicação antecipada da preferência.
- Período persistente, detalhamento dos indicadores e configuração de colunas já existentes.
- Padrão de lista e detalhe da Conciliação.
- Separação conceitual entre caixa, competência, limite de cartão e patrimônio.
- Recursos já presentes de foco, Escape, nomes acessíveis, salto para conteúdo e movimento reduzido.

Esses recursos precisam ser consolidados; não há motivo para substituí-los indiscriminadamente.

## Prioridades

P1: corrigir antes da próxima expansão visual, pois afeta orientação, conclusão da tarefa ou interpretação financeira. P2: consolidar qualidade, consistência e eficiência. P3: evolução a validar com usuários depois da base.

### UX-01 · P1 · Dar um título real ao dashboard

**Observado:** o H1 “Dashboard financeiro” está oculto visualmente. O primeiro bloco destacado é “Filtros analíticos”. A interface apresenta o mecanismo de consulta antes de explicar onde o usuário está.

**Proposta:** cabeçalho visível “Visão geral”, identificação da empresa e período. Filtros devem aparecer como controle compacto associado ao conteúdo, com contador dos filtros ativos. Ação principal claramente identificada, seguida dos resultados.

**Critério de entrega:** ao abrir a página, o usuário reconhece tela, empresa e período sem expandir controles. O título, o período e as ações compartilham o mesmo padrão das demais páginas.

### UX-02 · P1 · Fazer os lançamentos aparecerem na primeira tela do celular

**Observado:** em 390 × 844, Entradas exibe período, título, seis ações, abas, busca e três cards de resumo antes da tabela. A primeira linha financeira fica abaixo da área visível.

**Proposta:** manter “Nova entrada” visível; agrupar Recorrências, Parcelar, Exportar, PIX e Multa e juros em “Mais ações”. Reduzir o resumo a uma faixa compacta com saldo e quantidade; o detalhamento pode expandir. Unir busca e filtros numa barra curta.

**Critério de entrega:** com dados existentes, pelo menos o início de um lançamento aparece na primeira tela de 390 × 844, com ação de criar e período acessíveis. Não reduzir a legibilidade para alcançar essa meta.

### UX-03 · P1 · Manter Salvar acessível nos formulários

**Observado:** o modal de nova entrada exige rolagem para alcançar os botões. Em desktop de 720 px de altura, as ações aparecem cortadas na posição inicial; no celular ficam abaixo dos campos. Cabeçalho, conteúdo e ações rolam juntos.

**Proposta:** modal com cabeçalho e rodapé fixos dentro do diálogo, conteúdo central rolável e “Salvar entrada” como ação principal. “Salvar e criar outra” deve ser secundária. Usar apresentação de tela completa ou quase completa no celular, respeitando teclado e área segura.

**Critério de entrega:** fechar e salvar continuam alcançáveis; o rodapé não encobre o campo focado nem mensagens. Testar também com teclado virtual e zoom.

### UX-04 · P1 · Tornar inequívoca a ação principal

**Observado:** “Novo lançamento” tem boa ênfase, mas ações importantes de outros fluxos, como configurar autenticação em duas etapas e salvar no formulário, podem parecer botões secundários. Há diversas camadas de estilos globais e exceções.

**Proposta:** variantes compartilhadas: primário preenchido, secundário com borda, discreto para utilidades e destrutivo para consequências relevantes. Uma ação primária por região de decisão. Rótulos com objeto: “Salvar entrada”, “Criar cartão”, “Registrar pagamento”.

**Critério de entrega:** a ação recomendada é reconhecível por aparência e texto em listas, formulários e configurações, nos dois temas.

### UX-05 · P1 · Reorganizar a sidebar pela rotina

**Observado:** cerca de quinze entradas principais disputam atenção antes dos submenus. Planejamento pessoal, rotina bancária, cadastros e gestão avançada estão distribuídos entre apenas dois grandes grupos. Expandir Relatórios alonga bastante a navegação.

**Proposta de organização inicial a validar:**

| Grupo | Destinos |
| --- | --- |
| Visão geral | Painel |
| Dia a dia | Entradas, Saídas, Calendário |
| Contas e cartões | Contas, Transferências, Cartões, Conciliação |
| Planejamento | Orçamento, Cofrinhos, Dívidas, Patrimônio |
| Gestão | Relatórios, Cadastros, Fechamento, Auditoria |
| Rodapé | Configurações e Ajuda |

Os grupos podem ser recolhíveis, com abertura do grupo ativo. A ordem final deve considerar as tarefas mais frequentes de cada perfil. Não acrescentar todos os itens expandidos de uma vez.

**Critério de entrega:** as tarefas diárias permanecem fáceis de localizar; a navegação diferencia visão geral, operação, planejamento e administração sem depender de memorização.

### UX-06 · P1 · Mostrar o alcance dos números junto aos números

**Observado:** no conjunto fictício, o dashboard mostra R$ 1.476,10 como disponível, enquanto o fluxo apresenta R$ 1.726,10 como saldo registrado. Há explicações de alcance, mas ficam em textos extensos. Caixa realizado, competência e projeção também compartilham páginas com períodos diferentes.

**Proposta:** rótulos explícitos e pequenos marcadores: “Disponível para uso · exclui cofrinhos”, “Saldo total registrado”, “Resultado por competência” e “Projeção · próximos 30 dias”. Exibir a composição da diferença num detalhe curto. No Fluxo de caixa, organizar “Realizado” e “Planejamento” como seções ou abas claramente distintas, cada qual com seu período.

**Critério de entrega:** dois números diferentes podem ser reconciliados pelo usuário sem procurar notas no final da página. Filtros e período deixam claro quais blocos alteram.

### UX-07 · P1 · Corrigir a correspondência entre gráfico e explicação

**Confirmado no código:** o dashboard diz que a linha que exclui recebíveis vencidos é tracejada. Entretanto, chama `CashProjectionChart` sem `distinguishScenarios`; o padrão do componente é `false`, e o tracejado só é aplicado quando esse valor é verdadeiro.

**Proposta:** fazer a apresentação corresponder ao texto e desenhar na legenda a mesma amostra de traço usada no gráfico. Diferenciar cenários por forma e cor. Quando os cenários coincidirem, explicar que os valores são iguais para evitar a impressão de uma série ausente.

**Critério de entrega:** legenda, tooltip, descrição e linhas concordam, inclusive em preto e branco e no celular.

## Sistema visual e composição

| ID | Prioridade | Melhoria recomendada | Resultado esperado |
| --- | --- | --- | --- |
| UX-08 | P2 | Unificar a família tipográfica do produto. O login usa Manrope e a área interna usa a fonte do sistema. Escolher uma família principal e aplicá-la com pesos e numerais adequados. | Continuidade perceptível entre entrar e trabalhar. |
| UX-09 | P2 | Definir escala de texto: título de página aproximadamente 26–28 px no desktop, seção 18–20 px, corpo e tabela 14–16 px, metadados 12–13 px. Ajustar por contexto, sem aumentar tudo indiscriminadamente. | Hierarquia consistente e texto de apoio menos fatigante. |
| UX-10 | P2 | Distinguir a superfície da página dos cards no tema claro. Hoje o branco domina tanto a casca quanto os painéis. Usar fundo levemente acinzentado, cards claros e bordas discretas. | Separação dos blocos com menos dependência de sombras. |
| UX-11 | P2 | Adotar escala de espaçamento de 4, 8, 12, 16, 24 e 32 px. Padronizar distância entre título e subtítulo, label e campo, controles e tabela, seções e cards. | Ritmo visual previsível. |
| UX-12 | P2 | Reduzir a variedade de raios: por exemplo, 8 px em controles, 12 px em cards e 16 px em diálogos. Cápsulas ficam para badges e seletores que se beneficiem desse formato. | Componentes parecem pertencer à mesma família. |
| UX-13 | P2 | Formalizar cores por função: azul de ação, neutros de texto/superfície, verde de recebimento/sucesso, tom próprio para saída, âmbar de atenção e vermelho de falha/atraso. Revisar o uso nos dois temas. | A cor passa a comunicar informação de forma estável. |
| UX-14 | P2 | Diferenciar natureza financeira e gravidade. Uma despesa normal ou dívida futura não deve receber o mesmo sinal visual de um erro ou vencimento crítico. Usar texto e ícone junto da cor. | Menos alarmes falsos e compreensão por pessoas com deficiência de visão de cores. |
| UX-15 | P2 | Consolidar famílias de ícones e pesos. A casca usa ícones de origens diferentes. Definir tamanho, espessura e caixas de 16/20/24 px; substituir o símbolo genérico de edição do usuário por avatar identificável. | Maior coerência e reconhecimento das ações. |
| UX-16 | P2 | Reservar animações para abertura, fechamento, foco e resposta à ação; reduzir sombras e efeitos decorativos nos controles operacionais. Preservar o suporte a movimento reduzido já existente. | Interação discreta, estável e rápida de compreender. |
| UX-17 | P2 | Definir larguras por tarefa: formulários contidos, listas amplas e conteúdo analítico com limite confortável em monitores muito largos. Uma tabela pode ocupar mais largura do que uma nota explicativa. | Menos linhas de texto longas e cards vazios. |
| UX-18 | P2 | Padronizar eixos de alinhamento: títulos e conteúdo na mesma margem; ações na mesma linha de base; labels monetárias alinhadas; explicações fora dos grids quando criam colunas desequilibradas. | Páginas mais precisas e fáceis de varrer com os olhos. |

## Navegação e orientação

| ID | Prioridade | Melhoria recomendada | Resultado esperado |
| --- | --- | --- | --- |
| UX-19 | P2 | Reforçar o item atual da sidebar com marcador e contraste próprios. Manter diferenças entre hover, foco, página atual e grupo que contém a página atual. | O usuário sabe onde está mesmo após abrir submenus. |
| UX-20 | P2 | No modo recolhido, oferecer dicas acessíveis por foco e ponteiro, preservar estado e tornar previsível a abertura de submenus. A largura atual pode ser mantida se os alvos estiverem confortáveis. | O modo compacto continua utilizável sem decorar os ícones. |
| UX-21 | P2 | Identificar a empresa ou espaço de trabalho na casca, mesmo com uma única empresa. O nome aparece hoje principalmente em conteúdos específicos, como relatórios. | Mais confiança sobre o contexto dos registros. |
| UX-22 | P2 | Simplificar o topo: criação com rótulo quando couber, busca, notificações e avatar. Aparência e Novidades podem ficar no perfil ou em acesso secundário. A busca por Ctrl/⌘ K já existe; ampliar a descoberta desse atalho. | Menor competição entre seis ícones equivalentes. |
| UX-23 | P2 | Criar uma entrada clara de Configurações com navegação interna: empresa, equipe, notificações, segurança e assinatura, respeitando permissões. Evitar que funções importantes dependam da descoberta do ícone de Perfil. | Administração fácil de reencontrar. |
| UX-24 | P3 | Validar uma navegação móvel com poucos destinos rotulados para as tarefas frequentes. Comparar gaveta atual com barra inferior para Painel, Lançamentos, Contas e Mais antes de adotar outro elemento fixo. | Ganho de acesso com evidência, sem acrescentar navegação redundante. |

## Formulários e execução

| ID | Prioridade | Melhoria recomendada | Resultado esperado |
| --- | --- | --- | --- |
| UX-25 | P2 | Reordenar a criação de lançamento por decisão: descrição e valor; classificação e pessoa; datas; detalhes adicionais. Competência e vencimento devem formar um par visual no desktop. | Menos alternância mental e eliminação do espaço vazio no grid atual. |
| UX-26 | P2 | Manter detalhes opcionais recolhidos, mas informar o que contêm. Priorizar a conta prevista quando ela for necessária para a projeção, explicando sua utilidade. | Formulário curto com qualidade de dados. |
| UX-27 | P2 | Usar busca nos seletores de categorias e pessoas quando as listas crescerem. Preservar “Nova categoria” e “Novo cliente” próximos do campo e a seleção após o cadastro. Não substituir selects curtos sem benefício. | Seleção eficiente em empresas com muitos cadastros. |
| UX-28 | P2 | Explicar “Competência” no ponto de uso: mês ao qual a receita ou despesa pertence; “Vencimento”: data combinada para pagar ou receber. Padronizar receita/entrada e despesa/saída ao longo do fluxo. | Menos registros no período errado. |
| UX-29 | P2 | Exibir erro junto ao campo e um resumo para falhas múltiplas, focando a primeira pendência. Preservar valores preenchidos; no login, manter o e-mail após falha sem transportá-lo desnecessariamente na URL. | Recuperação de erros com menos retrabalho. |
| UX-30 | P2 | Proteger rascunhos ao fechar ou navegar somente quando houver alterações reais. Evitar confirmação em formulários vazios. Para formulários longos, considerar recuperação local de rascunho com tratamento adequado de dados sensíveis. | Menor perda de trabalho sem multiplicar diálogos. |

## Listas, filtros e tabelas

| ID | Prioridade | Melhoria recomendada | Resultado esperado |
| --- | --- | --- | --- |
| UX-31 | P2 | Reduzir as colunas padrão de Entradas/Saídas a descrição/pessoa, vencimento, saldo ou valor relevante, situação e ação. Categoria e centro de custo podem ser metadados ou colunas opcionais. O configurador de colunas já existe. | Menos rolagem horizontal e descrições menos comprimidas. |
| UX-32 | P2 | Criar apresentação móvel de lançamentos por linha ou card compacto, com descrição, pessoa, valor, vencimento e situação. Reservar tabelas largas para comparações que realmente precisem delas, com indicação de rolagem. | Consulta e ação com uma mão. |
| UX-33 | P2 | Em listas longas, testar cabeçalho de tabela fixo, coluna descritiva estável e densidade confortável/compacta. Manter ordenação visível e valores completos em ações financeiras. | Leitura contínua sem perder os cabeçalhos. |
| UX-34 | P2 | Exibir filtros ativos como chips removíveis e explicitar exceções de alcance. Em “Vencidas”, destacar “Todos os meses” perto do resultado, pois o período global deixa de limitar a consulta. | Resultados deixam de parecer inconsistentes com o mês selecionado. |
| UX-35 | P3 | Depois de simplificar os filtros, oferecer visões salvas para consultas frequentes, como vencidas por cliente ou despesas por centro. Aproveitar a preservação de parâmetros já existente. | Repetição de tarefas com menos configuração. |
| UX-36 | P2 | Mostrar a barra de ações em lote quando houver seleção, com quantidade e valor selecionados. Preservar seleção de modo previsível e explicar se se aplica à página ou à busca inteira. | Menos área ocupada por instruções e botões inativos. |

## Dashboard, gráficos e módulos financeiros

| ID | Prioridade | Melhoria recomendada | Resultado esperado |
| --- | --- | --- | --- |
| UX-37 | P2 | Organizar o painel em poucos níveis: posição de hoje, compromissos e alertas, resultado do mês, análise detalhada. A amostra tinha aproximadamente 3.433 px de conteúdo no desktop e 5.671 px no celular. Reduzir o conteúdo padrão e oferecer aprofundamento por módulo. | Painel funciona como ponto de decisão e encaminhamento. |
| UX-38 | P2 | Quando não houver pendências, trocar o grande card “Nenhuma pendência detectada” por um estado compacto. Separar vencidas, vencendo e informação comum, evitando chamar qualquer compromisso futuro de urgente. | Atenção reservada ao que demanda ação. |
| UX-39 | P2 | Tratar indicadores com amostra fraca. No conjunto fictício, “Dias de caixa” exibiu 5.558 dias. Definir com o domínio quando apresentar “Base insuficiente” ou contexto sobre o período observado, em vez de precisão pouco útil. | Indicadores mais interpretáveis em contas novas ou com poucos movimentos. |
| UX-40 | P2 | Dar aos gráficos alternativa tabular e resumo textual; garantir tooltip por toque e teclado, unidade monetária clara e marcadores de cenários. Estados sem dados, carregando e falha devem ser distintos. | Gráficos úteis fora do hover e em tecnologia assistiva. |
| UX-41 | P2 | Em Cartões, destacar próxima fatura e vencimento antes de sequências de meses vazios. Diferenciar dívida total, limite usado e pagamento próximo. Se a ação apenas registra um pagamento feito fora do produto, rotular “Registrar pagamento”, com confirmação de conta, data e valor. | Menor confusão entre limite, dívida, caixa e execução bancária. |
| UX-42 | P2 | Em Patrimônio, manter a composição, mas mover a metodologia extensa para “Como calculamos”, em área própria. O texto na coluna de obrigações hoje cria grande vazio na coluna de ativos. Destacar patrimônio líquido acompanhado e atualização dos bens manuais. | Comparação equilibrada entre ativos e obrigações. |
| UX-43 | P2 | Preservar a Conciliação como lista e detalhe e explicitar etapas: importar, revisar, vincular e concluir. Facilitar “Próxima pendente”, comparação de valores e datas, e distinção entre sugestão e vínculo confirmado. | Fluxo repetitivo mais rápido e com menos ambiguidade. |

## Estados, configurações e entrada no produto

| ID | Prioridade | Melhoria recomendada | Resultado esperado |
| --- | --- | --- | --- |
| UX-44 | P2 | Distinguir “Ainda não há lançamentos” de “Nenhum resultado para estes filtros”. No primeiro caso, orientar o primeiro cadastro; no segundo, oferecer limpar filtros. Usar orientação inicial curta para conta, categoria e primeiro lançamento. | Estados vazios conduzem ao próximo passo. |
| UX-45 | P2 | Introduzir estados de carregamento por tela que preservem a geometria dos blocos, além do “Carregando…” de modais. O projeto não apresenta `loading.tsx` nas rotas amostradas. Não inferir tempo de produção a partir da compilação local. | A navegação demonstra progresso sem saltos bruscos. |
| UX-46 | P2 | Padronizar sucesso, erro e atenção. Sucesso deve confirmar o que mudou; erro recuperável deve orientar; informação persistente não deve reaparecer repetidamente como interrupção. Auditar sobreposição de toast, aviso de assinatura e alertas do painel. | Feedback claro sem fadiga. |
| UX-47 | P2 | Nas configurações, alinhar títulos, pesos e botões ao restante do produto. Em Segurança, colocar estado atual, benefício e ação de ativar no mesmo bloco; deixar explicações complementares em segundo nível. | Configurações parecem parte da aplicação e a próxima ação fica clara. |
| UX-48 | P2 | Na página comercial, diferenciar o CTA principal de “Ver demonstração”, hoje com ênfase semelhante. Aproximar a prévia do painel real: sua navegação e seus cards não correspondem integralmente à aplicação. Manter indicação de dados fictícios e apresentar benefícios com evidências reais, quando disponíveis. | Melhor expectativa sobre o produto após o cadastro. |
| UX-49 | P2 | No login móvel, reduzir o painel ilustrado antes do formulário. Na amostra de 390 px ele ocupa cerca de 280 px de altura. Um cabeçalho de marca mais curto prioriza o retorno do usuário; a chamada de cadastro pode ficar abaixo do formulário. Revisar “Gestão financeira pessoal” para refletir também o uso empresarial. | Acesso mais direto e mensagem coerente com os planos. |
| UX-50 | P2 | Validar a proposta com tarefas concretas e perfis pessoal/empresarial: localizar uma conta vencida, registrar pagamento, entender o saldo, lançar compra no cartão e obter relatório. Medir conclusão sem ajuda, erros e tempo antes/depois. | Decisões posteriores deixam de depender apenas da preferência visual. |
| UX-51 | P2 | Dar à exportação uma experiência completa: explicar formato, período/empresa e conteúdo; indicar preparação e conclusão; deixar explícito quando o pacote está parcial por anexos indisponíveis. Preservar o manifesto técnico e apresentar também um resumo compreensível para o usuário. | Portabilidade confiável sem exigir leitura de arquivos técnicos. |

## Direção visual proposta

Uma interface financeira calma, com base neutra, tipografia consistente e contraste claro entre ação, informação e atenção. O azul pode continuar como marca. Verde e o tom de saída devem indicar natureza financeira; gravidade usa estados próprios e texto explícito.

Referência inicial de tokens, a validar em composição e contraste:

| Função | Direção |
| --- | --- |
| Ação principal | Azul próximo de `#2E66DB` |
| Texto principal | Marinho próximo de `#182235` |
| Texto secundário | Cinza próximo de `#5B6270` |
| Página clara | Cinza azulado próximo de `#F5F7FB` |
| Card claro | Branco |
| Recebimento/sucesso | Verde próximo de `#0A7A5D` |
| Saída | Tom próximo de `#B42D5F`, sem representar automaticamente atraso |
| Atenção | Âmbar com combinação de fundo e texto validada |
| Erro/atraso crítico | Vermelho com combinação de fundo e texto validada |

Essas cores são uma direção, não uma nova paleta aprovada. Cada combinação real, incluindo hover, foco, desabilitado e tema escuro, deve ser medida.

## Acessibilidade e critérios de verificação

- Texto comum: contraste mínimo de 4,5:1; texto grande: 3:1, conforme as definições do [W3C sobre contraste](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- Usar alvos confortáveis de aproximadamente 44 × 44 px nas ações móveis importantes como diretriz do produto. O critério AA de [tamanho mínimo do W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) estabelece 24 × 24 CSS px ou condições de espaçamento/exceção; 44 px não deve ser apresentado como mínimo AA obrigatório.
- Rodapés e cabeçalhos fixos não podem ocultar o controle focado. Ver [foco não encoberto](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).
- Conferir a gaveta móvel com teclado: entrada e retorno do foco, Escape, conteúdo de fundo e navegação fora da gaveta. O código amostrado não concentra essa gestão num diálogo compartilhado; isso merece validação específica.
- Validar nomes de botões por ícone, descrições de ordenação, estados ativos e anúncios de carregamento/erro. Preservar os recursos acessíveis já implementados.
- Testar 360, 390, 768, 1024, 1440 e 1920 px, zoom de 200%, textos longos, valores grandes, teclado virtual e conteúdo em português. As recomendações adicionais de viewport são critérios futuros, não testes concluídos nesta avaliação.
- Incluir casos com muitos registros, sem registros, falha, leitura restrita e plano pessoal. Não demonstrar apenas telas preenchidas ideais.

## Ordem recomendada de execução

1. **Base compartilhada:** tokens, tipografia, botões, cabeçalho, sidebar e contexto da empresa/período.
2. **Rotina principal:** Entradas/Saídas, tabela móvel, filtros e formulário com ações acessíveis.
3. **Leitura financeira:** hierarquia do dashboard, alcance dos saldos, cenários do gráfico e síntese dos alertas.
4. **Consolidação:** Cartões, Patrimônio, Conciliação, relatórios, configurações e estados de interface.
5. **Entrada e evolução:** página comercial, login móvel e validação de opções como visões salvas ou navegação inferior.

As três primeiras etapas concentram o maior retorno de usabilidade. A aprovação visual deve considerar o fluxo inteiro, com dados e interação, antes de ampliar o redesign para os demais módulos.

## Pontos de implementação consultados

- [Estilos compartilhados](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/apps/web/app/globals.css>) — tokens, tipografia, tabelas, cards e regras responsivas.
- [Casca da aplicação](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/apps/web/components/app-shell.tsx>) e [sidebar](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/apps/web/components/app-sidebar.tsx>).
- [Ações do topo](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/apps/web/components/ui/bottom-menu.tsx>).
- [Dashboard](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/apps/web/app/(app)/dashboard/page.tsx>) e [gráfico de projeção](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/apps/web/components/dashboard/cash-projection-chart.tsx>).
- [Criação rápida](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/apps/web/components/quick-create.tsx>) e [tabela de lançamentos](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/apps/web/components/titles/title-list-table.tsx>).
- [Login](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/apps/web/app/login/page.tsx>) e seus estilos locais.
