# Primeira etapa de integridade financeira

Implementação iniciada em 10/10/2026 a partir da análise técnica e financeira do projeto.

## Comportamentos entregues

- Competência fechada bloqueia criação, duplicação, edição, cancelamento, rateio e reclassificação de títulos, inclusive em lote. Editar verifica a competência anterior e a nova. Alterar natureza ou grupo de uma categoria também verifica títulos, rateios e compras vinculados.
- Fechar/reabrir usa trava transacional exclusiva por empresa; escritas que verificam o período usam a correspondente trava compartilhada. O fechamento aguarda até 2,5 segundos sem enfileirar uma trava que poderia causar deadlock; se a empresa continuar ocupada, pede nova tentativa. Edições e exclusões de títulos usam a mesma trava de linha das baixas.
- Recorrências materializam apenas meses abertos. Encerrar uma regra com cancelamento de títulos preserva os títulos de competências fechadas.
- Contratos de dívida são cadastrados de forma idempotente e atômica. Se uma parcela nova atingir mês fechado, o contrato e todas as parcelas da tentativa são desfeitos.
- Dívidas somam a amortização efetiva de cada parcela, considerando pagamentos parciais, descontos, estornos e data efetiva. Pagar uma parcela fora da ordem não equivale a pagar a primeira parcela.
- Arquivar é um filtro operacional: dívidas arquivadas com saldo continuam no patrimônio. A lista permite consultá-las e reativá-las.
- Juros contratuais entram no resultado financeiro da DRE pela competência da parcela; amortização aparece fora do resultado. Parcelas de dívidas deixam de integrar o resultado operacional do painel, mesmo quando a categoria selecionada era de despesa.
- Projeção do painel, fluxo e calendário compartilha o mesmo motor. Um horizonte de 30 dias abrange hoje e os 29 dias seguintes. Contas com abertura futura não compõem o disponível de hoje.
- Calendário e relatório mensal usam o fluxo de caixa como fonte do realizado, incluindo devoluções e excluindo datas efetivas futuras. O resultado do PDF e da tela mensal é identificado como operacional.
- Cartões também consideram a data efetiva dos pagamentos na dívida e no limite utilizado: uma fatura com baixa futura não desaparece da posição patrimonial de hoje.
- A lista de dívidas carrega parcelas e pagamentos em conjunto, evitando uma consulta adicional por contrato.

## Critérios financeiros adotados

O abatimento parcial da obrigação (valor principal da baixa + desconto) é rateado proporcionalmente entre amortização e juros da parcela contratada. O cálculo usa o acumulado de baixas, arredondado ao centavo, para não acumular diferenças a cada pagamento. Multas e tarifas adicionais movimentam caixa, mas não amortizam o principal do contrato.

Os componentes contratuais são calculados a partir dos campos estruturados do contrato e do número da parcela. Nenhum relatório interpreta o texto das observações. Não houve migração de banco nem alteração automática de lançamentos existentes.

As parcelas não podem ser canceladas, excluídas ou ter o valor modificado isoladamente. Contratos sem histórico de pagamento podem ser excluídos pelo módulo Dívidas, respeitando o fechamento. Pagamentos preservados em parcelas removidas no legado continuam reduzindo o saldo; remoção/cancelamento por si só não representa quitação. Divergências entre contrato e lançamentos são sinalizadas na tela.

A posição patrimonial continua parcial: inclui contas ativas, cofrinhos ativos, bens cadastrados, dívidas e cartões acessíveis ao perfil. Recebíveis e outras obrigações comuns não foram adicionados. A tela agora explicita esse alcance.

## Validação e próximos passos

Testes de integração cobrem fechamento, lotes e rateios, recorrências, repetição concorrente de cadastro, baixa parcial, pagamento fora da ordem, data futura, estorno, arquivamento e preservação de histórico. Um teste cruza painel, calendário, fluxo e relatório mensal na mesma empresa, com devolução, baixa futura, abertura futura de conta e fronteira de horizonte.

Verificações realizadas nesta entrega:

- Suíte geral executada: 80 arquivos e 458 testes; 457 passaram na primeira execução. O único erro era um cenário novo de legado que omitia os campos obrigatórios de exclusão. O cenário foi corrigido e passou na repetição.
- Regressões de fechamento, títulos, recorrências e patrimônio: 45 testes aprovados em 6 arquivos.
- Após o ajuste adicional dos cartões: 44 testes aprovados em 3 arquivos, incluindo os 9 novos cenários de integridade financeira. A expectativa antiga que liberava limite antes da data do pagamento foi substituída por verificações antes e depois da data efetiva.
- Verificação de tipos aprovada; lint sem erros, com 9 avisos preexistentes em arquivos não alterados; compilação de produção aprovada.
- A suíte geral não foi repetida por inteiro após os ajustes finais: foram repetidos os módulos afetados. Não houve execução de testes de navegador nesta etapa.

Antecipações usam a tabela contratada; não simulam renegociação ou desconto de juros pelo credor. Permanecem para etapas posteriores: snapshots históricos de fechamento/aging, patrimônio completo com recebíveis e obrigações sem duplicidade, cenários por probabilidade de recebimento, reserva mínima de caixa e margem por projeto/serviço.
