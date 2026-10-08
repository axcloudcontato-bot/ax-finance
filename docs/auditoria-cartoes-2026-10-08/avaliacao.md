# Cartões de crédito — avaliação e melhorias

Data: 08/10/2026. Superfície: `/cartoes`, cadastro, lançamento de compra, detalhe do cartão e fatura. Após a avaliação inicial, o usuário solicitou aprimorar a própria tela.

## Resultado

O módulo tinha uma base consistente para cadastro, parcelamento, limite e integração financeira, mas a visão geral escondia parte da dívida e oferecia pouco apoio à decisão. Foram implementados indicadores completos, agenda de vencimentos, previsão de compromissos e prévias de compra e pagamento. Também foram corrigidos problemas nas regras de datas, proteção do histórico e repetição de pagamentos.

As capturas 01 e 02 mostram a versão local antes das melhorias, na conta de demonstração sem cartões. A captura 09 também usa essa conta, sem submeter o cadastro. As demais mostram as melhorias com dados fictícios, criados exclusivamente em `ax_finance_test`. Nenhuma compra ou pagamento foi lançado na conta de desenvolvimento durante a avaliação. Os valores ilustrativos não descrevem a situação financeira do usuário.

## Etapas e evidências

| Etapa | O que foi verificado | Estado |
| --- | --- | --- |
| 1 | Visão geral e estado vazio | Navegação clara; indicadores reformulados para representar obrigações completas. |
| 2 | Cadastro do cartão | Campos identificados, somente os quatro últimos dígitos, instruções sobre fechamento e vencimento; formulário inspecionado sem enviar cadastro. |
| 3 | Planejamento dos próximos meses | Implementado e conferido com faturas abertas, fechadas, atrasadas e parcelas futuras. |
| 4 | Prévia de compra parcelada | Implementada; valores, vencimentos, divisão de centavos e limite excedido conferidos sem enviar o formulário. |
| 5 | Fatura com pagamento parcial | Principal liquidado separado dos encargos; histórico agora mostra tarifa e saída total. |
| 6 | Prévia de pagamento | Implementada; principal de R$ 200 + juros de R$ 20 + tarifa de R$ 5 = saída de R$ 225 e saldo principal de R$ 200. Formulário não enviado. |
| 7 | Tela pequena, 390 × 844 | Indicadores empilhados, textos legíveis e navegação adaptada. Tabelas preservam rolagem horizontal. |
| 8 | Agenda e prioridade entre cartões | Todas as faturas vencidas e as próximas entram na agenda; cartões com atrasos aparecem primeiro. |
| 9 | Cadastro amplo após ajuste solicitado | Modal de 1.120 px com todos os campos e botão visíveis na tela de desktop conferida. |
| 10 | Nova compra ampla após ajuste solicitado | Modal de 1.120 px, prévia distribuída em três colunas; em 390 px de tela, ocupa 366 px sem rolagem horizontal. |

### 1. Visão geral inicial

![Visão geral inicial](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-cartoes-2026-10-08/01-visao-geral.png>)

Ponto positivo: o estado vazio explica a relação entre cartão, compras e fatura. O cadastro principal é fácil de localizar.

Limitação importante identificada no código: “Faturas para pagar” somava somente `nextPayable` de cada cartão ativo. Um cartão com duas faturas vencidas de R$ 200 e R$ 300 contribuía com apenas R$ 200 para esse indicador. A reprodução foi feita no banco de teste.

### 2. Cadastro

![Cadastro do cartão](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-cartoes-2026-10-08/02-cadastro-cartao.png>)

Pontos positivos: identificação por apelido/emissor/bandeira, conta preferida para pagar e explicação da regra do dia de fechamento. O foco inicial cai no apelido e o modal possui identificação acessível.

Oportunidade posterior: mostrar um exemplo de ciclo ao preencher fechamento e vencimento. A regra atual continua sendo a adotada pelo aplicativo e deve ser conferida com as datas reais da instituição.

### 3. Painel aprimorado

![Painel aprimorado](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-cartoes-2026-10-08/03-painel-aprimorado.png>)

Os indicadores agora respondem a perguntas de gestão:

- Quanto ainda devo? Saldo de todas as faturas, incluindo parcelas futuras e eventual dívida reaberta de cartão arquivado.
- Quanto vence nos próximos 30 dias? Obrigações entre hoje e o fim da janela, incluindo o valor já lançado em faturas ainda abertas.
- Quanto está atrasado? Valor e quantidade de todas as faturas vencidas, separado da janela dos próximos 30 dias.
- Quanto do limite contratado resta? Limites dos cartões ativos menos seus compromissos. O texto distingue limite de dinheiro em conta.

A previsão por mês de vencimento mostra seis meses e informa valores posteriores ao horizonte. Faturas abertas podem aumentar: a tela explicita que a previsão inclui somente compras registradas. A comparação com o fluxo de caixa ajuda a avaliar a disponibilidade de dinheiro para pagar esses compromissos.

### 4. Compra e parcelamento

![Prévia de compra parcelada](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-cartoes-2026-10-08/04-previa-parcelamento.png>)

A prévia mostra primeiro e último vencimento, distribuição das parcelas e limite após o valor total da compra. A divisão usa a mesma função do domínio: R$ 100 em três parcelas resulta em R$ 33,34, R$ 33,33 e R$ 33,33. Também foi conferido o aviso de compra de R$ 6.000 com apenas R$ 5.000 disponíveis.

O aviso permite registrar uma compra já realizada sem sugerir que o aplicativo aprova crédito. O valor total compromete o limite, enquanto os pagamentos se distribuem nas faturas. A prévia respeita as datas das faturas existentes, que podem diferir da configuração atual do cartão.

### 5. Fatura e pagamento anterior

![Fatura com pagamento parcial](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-cartoes-2026-10-08/05-fatura-pagamento-parcial.png>)

“Principal liquidado” evita interpretar encargos como abatimento da dívida. O histórico discrimina principal, juros/multa, tarifas e saída total. No cenário fictício, R$ 600 de principal + R$ 20 de juros + R$ 5 de tarifa representam R$ 625 saídos da conta.

Foi corrigida a orientação da fatura paga: devolver uma compra depois do pagamento não significa que o pagamento ao banco foi incorreto. O aplicativo ainda precisa oferecer crédito de devolução como operação própria; o texto agora distingue esse caso da correção de um pagamento lançado por engano.

### 6. Registro do pagamento

![Prévia de pagamento](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-cartoes-2026-10-08/06-previa-pagamento.png>)

A ação foi renomeada para “Registrar pagamento”, coerente com um controle financeiro que registra o ocorrido. O formulário calcula a saída total e o saldo principal após o pagamento. Um pagamento parcial informa que os encargos e eventual financiamento precisam ser conferidos no banco, pois o aplicativo não os calcula automaticamente. O Banco Central explica as alternativas e consequências do pagamento parcial em suas [perguntas sobre cartão de crédito](https://www.bcb.gov.br/meubc/faqs/s/cartao).

### 7. Celular

![Painel no celular](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-cartoes-2026-10-08/07-painel-mobile.png>)

Os indicadores e a previsão se reorganizam em telas pequenas. A verificação cobriu o painel em 390 × 844 e o detalhe da fatura. Tabelas extensas ainda exigem rolagem horizontal; uma evolução possível é oferecer linhas resumidas por fatura em celulares.

### 8. Agenda

![Agenda de faturas](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-cartoes-2026-10-08/08-agenda-cartoes.png>)

O usuário pode abrir a fatura diretamente na agenda, sem passar pelo cartão. Há identificação do cartão, mês, vencimento, saldo e situação. As pendências de R$ 400 + R$ 400 do mesmo cartão aparecem separadamente, e o saldo fechado total considera todas as faturas.

### 9. Cadastro amplo

![Novo cartão amplo](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-cartoes-2026-10-08/09-novo-cartao-amplo.png>)

A pedido do usuário, o limite de largura passou de 440 para 1.120 px. Emissor e bandeira, final e limite, fechamento e vencimento compartilham linhas com espaço suficiente. Na tela conferida, o modal mediu 1.120 × 635 px e não exigiu rolagem interna.

### 10. Nova compra ampla

![Nova compra ampla](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-cartoes-2026-10-08/10-nova-compra-ampla.png>)

A mesma largura foi aplicada à nova compra e aos formulários de edição de cartão/compra. A prévia usa a largura para separar primeiro vencimento, último vencimento e limite restante. O modal mediu 1.120 × 712 px na tela conferida, com campos, prévia e botão visíveis. A captura 04 registra o primeiro desenho, substituído por esta versão mais ampla.

![Nova compra no celular](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/docs/auditoria-cartoes-2026-10-08/11-compra-mobile.png>)

Na tela de 390 px, o modal tem 366 px e os campos se empilham. Não houve rolagem horizontal interna; formulários longos usam rolagem vertical. A largura padrão dos outros tipos de modal permanece configurável independentemente.

## Correções de integridade

| Problema reproduzido | Correção | Verificação |
| --- | --- | --- |
| Resumo somava apenas a primeira fatura fechada de cada cartão. | Agregação de todas as faturas pendentes e agenda completa. | Vários atrasos no mesmo cartão; janela de 30 dias; horizonte de seis meses e virada do ano. |
| Estornar pagamento de cartão arquivado podia reabrir dívida excluída dos totais da tela. | Dívida agregada também dos arquivados; limite contratado considera somente ativos. | Pagamento, arquivamento, estorno e conferência do saldo. |
| Trocar os dias do cartão podia fazer a fatura em andamento aparecer como futura e zerar “Fatura aberta”. | Classificação e datas baseadas no ciclo gravado. | Alteração de fechamento/vencimento com fatura já existente. |
| Uma data inexistente podia ser normalizada e produzir datas de compra e competência divergentes. | Validação de data real antes de gravar. | 31/02 recusado sem criar compra. |
| Compras podiam modificar a competência de período já fechado. | Criação, edição, cancelamento e exclusão conferem os períodos afetados. | Tentativas recusadas; parcelamento inteiro desfeito quando uma parcela afeta período fechado. |
| Reenviar o pagamento integral com a mesma chave retornava erro de fatura paga. | Repetição verificada na mesma transação da baixa. | Reenvio integral retorna a mesma baixa; reenvios simultâneos de parcial criam uma única baixa; conteúdo diferente é recusado. |

## Base preservada

Compras entram no orçamento e nos resultados pelas categorias; os títulos de fatura representam os vencimentos e os pagamentos representam a saída da conta. Isso evita duplicidade entre compra e fatura. A soma de todas as parcelas continua comprometendo o limite, há auditoria de operações e controle de acesso por empresa. As proteções de pagamento acima do saldo e concorrência continuam cobertas por testes.

## Próximas evoluções por impacto financeiro

1. **Crédito de devolução e contestação:** registrar crédito total/parcial sem apagar a compra nem desfazer um pagamento válido; acompanhar créditos aguardados e saldo credor.
2. **Antecipação:** registrar pagamentos antes do fechamento e antecipar parcelas, preservando as compras que ainda poderão compor a fatura. A restrição atual é do aplicativo; o Banco Central descreve a possibilidade de liquidação antecipada nas [perguntas sobre cartão](https://www.bcb.gov.br/meubc/faqs/s/cartao).
3. **Conferência da fatura do banco:** importação com prévia, deduplicação e diferença entre total importado e total lançado; separar confirmação de compra e conciliação do pagamento.
4. **Financiamento da fatura:** distinguir parcelamento de compra, parcelamento do saldo da fatura e rotativo, com os encargos efetivamente contratados e sem inventar taxa padrão.
5. **Competência configurável e consultas:** explicitar a diferença entre mês da compra, competência usada no orçamento e mês de pagamento; oferecer visão das compras originais e filtro por categoria/estabelecimento.

## Acessibilidade e limites

Os estados têm rótulos textuais além da cor. Os novos totais dinâmicos usam regiões de anúncio para tecnologia assistiva. O modal devolve o foco ao gatilho; Escape foi conferido no pagamento. As tabelas têm títulos de coluna e links de agenda identificam cartão e mês.

Não foi realizada certificação WCAG, medição integral de contraste, teste com leitor de tela nem conferência de todas as combinações de tema/zoom. Na interface, cadastros e pagamentos foram inspecionados sem submeter os formulários; as gravações e recusas financeiras foram verificadas nos testes de domínio. A antecipação e o crédito de devolução continuam fora do escopo implementado.

## Validação

- 85 testes passaram em nove arquivos: cartões, ciclos, exclusão, gestão, títulos, idempotência, fechamento, resultado financeiro e orçamento.
- 11 testes de gestão foram adicionados para os cenários corrigidos e os novos indicadores.
- Verificação de tipos do monorepo, lint dos arquivos TypeScript alterados e build de produção passaram. O build apresentou avisos de lint em arquivos fora desta alteração.
- Capturas reais da interface e verificação de prévias com dados fictícios no banco separado de testes.

As regras atualizadas estão documentadas em `docs/cartoes-de-credito.md`.
