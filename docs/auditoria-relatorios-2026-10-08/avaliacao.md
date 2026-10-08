# Avaliação dos relatórios financeiros — 08/10/2026

O menu passou a responder três perguntas de gestão: quanto dinheiro existe e quando pode faltar, o que cobrar ou pagar primeiro, e como receitas, custos e despesas formam o resultado. A avaliação incluiu a interface real, o código dos cálculos, os CSVs e testes com registros sintéticos. “FRE gerencial” foi interpretado como **DRE gerencial**, nome do submenu existente.

## 1. Fluxo realizado e conferência do saldo — melhorado

**Evidência inicial:** a tela destacava recebimentos, pagamentos e variação, mas não explicava a passagem entre saldo inicial e final. Um mês sem baixas podia parecer sem recursos, embora houvesse dinheiro nas contas.

![Fluxo antes das melhorias](C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-relatorios-2026-10-08/01-fluxo-atual.png)

**Entregue:** ponte entre saldo inicial, baixas/devoluções, outras alterações e saldo final. Saldos de abertura no período, ajustes e tarifas de transferência são calculados separadamente; a diferença de conferência aparece como alerta. Transferências internas não são receita. A conferência inclui contas arquivadas e fora do disponível; o planejamento usa somente contas ativas incluídas no disponível, com essa distinção escrita na tela.

Baixas com data efetiva futura deixaram de ser tratadas como dinheiro já realizado. Devoluções usam o sinal efetivo do caixa e identificadores próprios, evitando apresentar uma saída como entrada ou repetir a identificação de uma baixa. A lista identifica a conta e permite abrir o título de origem.

![Conferência do saldo depois das melhorias](C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-relatorios-2026-10-08/12-fluxo-conferencia.png)

**Decisão facilitada:** verificar se a variação financeira explica o saldo registrado antes de assumir compromissos. A conferência não substitui o extrato bancário nem a conciliação.

**Prioridade alta corrigida:** comparação de um período em andamento acompanhando seus dias decorridos, em vez de comparar oito dias realizados com um período anterior inteiro. Períodos totalmente futuros não recebem comparação de realizado.

## 2. Planejamento de caixa — melhorado, condicionado às premissas

**Entregue:** horizontes de 30, 60 e 90 dias, a partir do disponível de hoje; cenário com todos os recebíveis e cenário que exclui recebíveis vencidos, mantendo todas as obrigações. O cálculo informa primeiro dia negativo, menor saldo e dinheiro adicional necessário para evitar saldo diário negativo nesse cenário. O saldo final positivo sozinho não elimina a possibilidade de falta de caixa no meio do intervalo.

![Cenários de caixa depois das melhorias](C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-relatorios-2026-10-08/13-planejamento-caixa.png)

Faturas de cartão entram pelo principal pendente da fatura, uma única vez. Limite de crédito não entra como dinheiro disponível. Recebimentos e pagamentos vencidos são posicionados no primeiro dia; a tela explicita essa hipótese. Linhas contínua e tracejada diferenciam os cenários, além das cores. Uma tabela semanal permite consultar os valores sem depender apenas do gráfico.

![Alternativa tabular da projeção](C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-relatorios-2026-10-08/14-projecao-semanal.png)

**Limites:** previsão pelos vencimentos, sem deslocamento por agendamentos bancários. Inclui os títulos já existentes; recorrências ainda não geradas, novas vendas, despesas não lançadas, juros futuros e taxas futuras não estão estimados. O menor saldo usa fechamentos diários, sem modelar a ordem dos movimentos dentro do dia.

**Decisão facilitada:** antecipar cobranças e negociar vencimentos antes do primeiro déficit. O cenário sem vencidos é uma simulação e não uma garantia de recebimento dos demais clientes.

## 3. Contas a receber e a pagar — melhorado; histórico ainda pendente

**Evidência inicial:** resumo por faixas útil, mas sem uma agenda clara para os próximos dias. A data de referência podia sugerir uma carteira histórica mesmo usando o principal pendente atual.

![Carteira antes das melhorias](C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-relatorios-2026-10-08/02-contas-atual.png)

**Entregue:** totais separados de recebíveis e obrigações, valor e percentual vencido de cada lado, agenda acumulada para hoje, sete e trinta dias, filtro por tipo e faixa, cliente/fornecedor, centro de custo e dias exatos de atraso. As faixas clicáveis levam aos títulos correspondentes. Títulos com baixas futuras continuam visíveis como pendentes hoje.

![Indicadores e filtros da carteira atual](C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-relatorios-2026-10-08/10-contas-aprimoradas.png)

![Agenda acumulada de vencimentos](C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-relatorios-2026-10-08/11-agenda-vencimentos.png)

A data de referência **reclassifica os vencimentos da carteira atual**; não reconstrói a posição histórica. A data-base dos saldos aparece explicitamente. O resumo mostra a carteira de todas as faixas; a listagem informa o valor da faixa selecionada. Isso evita confundir um filtro com redução real das obrigações.

O CSV respeita tipo e faixa da tela e traz data-base, referência, pessoa, centro de custo e atraso. Foi verificado um filtro “a pagar, 8–15 dias” com um título de R$ 450,00 e 12 dias de atraso no momento da consulta.

**Decisão facilitada:** priorizar cobrança dos vencidos e reservar recursos para os próximos vencimentos, sem somar os dois lados como se fossem caixa disponível.

**Prioridade alta remanescente:** posição histórica auditável da carteira, com eventos ou snapshots que preservem também alterações, cancelamentos, reaberturas e devoluções. Alterar somente a data de filtro não resolve essa necessidade.

## 4. DRE gerencial — melhorado; classificação exige revisão

**Evidência inicial:** resultado operacional e financeiro separados eram uma boa base, mas faltavam formação do resultado, margens e detalhamento que explicassem sua origem.

![DRE antes das melhorias](C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-relatorios-2026-10-08/03-dre-atual.png)

**Entregue:** receita operacional, custos, resultado bruto, despesas, resultado operacional, resultado financeiro e resultado gerencial. Margens operacionais e gerenciais e análise vertical usam a receita operacional como base; quando ela não é positiva, a tela apresenta “sem base de receita”. Comparação inclui valor anterior, diferença em reais e variação percentual.

![Indicadores da DRE aprimorada](C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-relatorios-2026-10-08/08-dre-aprimorada.png)

![Formação do resultado e análise comparativa](C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-relatorios-2026-10-08/09-dre-formacao.png)

Categorias ficam separadas por natureza mesmo com o mesmo nome de grupo gerencial. Compras de cartão e rateios preservam sua classificação; faturas não repetem essas despesas na DRE. Movimentações de capital permanecem fora do resultado. Há alertas para categorias sem grupo, sinais incomuns e devoluções sem classificação automática no resultado.

O cabeçalho declara o método existente: **operacional por competência e financeiro pela data da baixa**. Encargos não têm competência separada no modelo atual. O demonstrativo não calcula tributos, depreciação ou EBITDA automaticamente; a qualidade depende dos registros e da classificação.

**Decisão facilitada:** identificar se a margem é consumida por custos, despesas ou encargos financeiros, com rastreio por categoria. Crescimento percentual de uma despesa negativa não significa melhoria; a tela explica o uso do valor absoluto na base comparativa.

**Prioridades altas remanescentes:** competência própria dos encargos e tratamento explícito de devoluções/estornos no resultado. A devolução movimenta caixa, mas não se deve inventar uma reversão de receita ou custo sem definir sua classificação e competência.

## 5. Navegação, filtros, exportação e uso em telas pequenas — melhorado, verificação parcial de acessibilidade

As três telas têm navegação direta, identificação da aba atual e preservação do período/comparação entre caixa e DRE. A carteira tem referência própria, pois representa posição atual. As métricas reorganizam-se em telas estreitas; tabelas extensas possuem rolagem interna.

![Carteira em viewport de 390 px](C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-relatorios-2026-10-08/07-contas-mobile.png)

No viewport de 390 px, a largura da página permaneceu em 390 px, sem rolagem horizontal da página inteira. Tabelas detalhadas ainda exigem deslocamento interno; transformar seus registros em cartões ou oferecer seleção de colunas é uma melhoria posterior. O teste não demonstra conforto em todos os dispositivos.

**Acessibilidade observada:** rótulos de campos, indicação da navegação atual, foco definido no CSS, cabeçalhos semânticos e alternativa tabular ao gráfico. Permanecem pendentes teste completo com teclado e leitor de tela, contraste medido, zoom elevado e validação WCAG. Screenshots sozinhos não comprovam conformidade.

Os CSVs usam valores identificados em centavos e mantêm a proteção existente contra fórmulas. O CSV da DRE foi baixado pela interface e conferido: receita 25000, despesas -16634, operacional 8366, financeiro 345 e gerencial 8711 centavos no momento da consulta. Valores negativos podem receber apóstrofo de proteção na serialização.

## Próximas melhorias por impacto

| Prioridade | Melhoria | Efeito esperado |
| --- | --- | --- |
| Alta | Carteira histórica auditável | Permitir fechamento mensal e comparação real da inadimplência ao longo do tempo. |
| Alta | Devoluções e competência dos encargos na DRE | Tornar os resultados de períodos comparáveis e explicar correções de receitas/custos. |
| Alta, se houver moedas diferentes | Separar moedas ou converter com critério e taxa explícitos | Evitar agregar saldos em moedas distintas como se fossem reais. A apresentação atual mantém BRL. |
| Média | Previsão por data provável/agendada e filtros por conta | Diferenciar vencimento contratual, programação e caixa efetivamente esperado. |
| Média | Concentração por cliente/fornecedor e centro de custo | Identificar dependência de poucos pagadores e maiores compromissos. |
| Média | Orçado versus realizado e metas de margem | Medir desvios e apoiar ajustes de despesas e preços. |
| Média | Paginação e filtros no servidor | Sustentar carteiras grandes; desempenho em grandes volumes não foi validado. |

## Rotina de gestão sugerida

Diariamente, confira o saldo com os extratos e revise o primeiro déficit da projeção. Semanalmente, revise vencidos a receber e os próximos sete/trinta dias a pagar. No fechamento mensal, revise categorias, custos, despesas, margens e encargos; explique as diferenças de caixa e resultado antes de decidir sobre distribuição ou novos compromissos.

O Sebrae orienta registrar recebimentos efetivos e usar a projeção de entradas/saídas para antecipar necessidades: [fluxo de caixa](https://sebrae.com.br/sites/PortalSebrae/ufs/ap/artigos/fluxo-de-caixa%2Ca8751947e93c9410VgnVCM2000003c74010aRCRD) e [planilha no dia a dia](https://sebrae.com.br/sites/PortalSebrae/bis/implantando-a-planilha-de-fluxo-de-caixa-no-seu-dia-a-dia%2C9b183adc5f62d410VgnVCM2000003c74010aRCRD). O [CPC 03](https://www.cpc.org.br/CPC/Documentos-emitidos/Pronunciamentos/Pronunciamento?Id=34) é referência para uma futura DFC formal. Este relatório por natureza cadastral não foi certificado como DFC ou demonstração contábil normativa.

## Validação e limites da evidência

- **57 testes passaram, em nove arquivos:** relatórios, projeção, aging, DRE, saldo SQL, caixa mensal, cartões e comparação. Incluem isolamento entre empresas, datas inválidas, baixas futuras, sinais de devoluções, dias de atraso, falta de caixa intermediária e cartão sem duplicidade.
- Os testes financeiros usaram banco de testes com dados sintéticos. Esta avaliação não efetuou pagamentos, recebimentos ou alterações financeiras na base de demonstração.
- Capturas feitas na execução atual. A base de demonstração sofreu alterações de outro trabalho no mesmo ambiente durante a avaliação; diferenças nos valores entre capturas não medem o efeito das melhorias.
- Capturas mostram partes visíveis das telas. Não representam todas as linhas, todos os estados ou todos os tamanhos de tela.
- A construção completa e a verificação final de tipos estão registradas no complemento abaixo; versões anteriores foram interrompidas por alterações simultâneas e regeneração dos arquivos da prévia.

**Validação final:** `pnpm build` concluiu com sucesso, incluindo a checagem de tipos do Next.js. O TypeScript do domínio e o ESLint dos arquivos de relatórios também passaram. O build emitiu avisos existentes em outras áreas, sem impedir a geração das páginas. A prévia foi reiniciada e as três telas conferidas no build concluído. CSVs de carteira, DRE e caixa foram baixados pela interface e inspecionados; no caixa, saldo inicial 1030000 + movimento 3679 + outras alterações 0 = saldo final 1033679 centavos, com diferença zero.
