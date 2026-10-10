# Análise técnica e financeira do AX Finance

Data: 10/10/2026. Versão analisada: `8b59d926cb1492d2a0eb2feb2d185335b0580939`.

Esta análise registra a situação anterior às correções. A primeira etapa autorizada está descrita em [Primeira etapa de integridade financeira](primeira-etapa-integridade-financeira.md).

## Parecer

O projeto tem uma base adequada para continuar evoluindo como monólito modular. As regras estão concentradas no domínio, os registros financeiros usam centavos inteiros, o banco aplica isolamento por empresa, e operações importantes têm auditoria, transações, locks e idempotência. Cofrinhos, calendário, dívidas, orçamento e relatórios aumentaram bastante a utilidade do produto.

A próxima etapa recomendada é consolidar a coerência entre os módulos e a preservação dos números no tempo. Os achados abaixo combinam leitura do código com uma reprodução isolada do algoritmo de amortização. Não equivalem a uma auditoria de produção ou certificação contábil.

Não foram executados pagamentos, alterações de cadastro, migrations, envios de mensagens ou a suíte de integração. A única criação desta avaliação é este documento. A existência de testes e workflows foi inspecionada; não se afirma que todo o CI passou nesta rodada.

## Prioridades de implementação

| Ordem | Entrega | Prioridade | Esforço relativo | Benefício |
| --- | --- | --- | --- | --- |
| 1 | Fechamento consistente sobre alterações por competência | Alta | Médio | Preservar resultados de meses encerrados. |
| 2 | Saldo de dívida por amortizações e eventos efetivos | Alta | Médio/grande | Evitar saldo incorreto em pagamentos parciais, futuros ou fora de ordem. |
| 3 | Principal e juros de financiamento estruturados | Alta | Médio/grande | Classificar corretamente caixa, dívida e resultado. |
| 4 | Obrigações preservadas ao arquivar e escopo do patrimônio | Alta | Médio | Evitar melhora patrimonial apenas por esconder cadastros. |
| 5 | Cálculos compartilhados entre telas e PDF | Alta | Médio | Apresentar números compatíveis e explicar diferenças legítimas. |
| 6 | Histórico da carteira e versões do fechamento | Alta | Grande | Comparar inadimplência e reproduzir relatórios antigos. |
| 7 | Previsão por datas prováveis, agenda e reserva mínima | Média | Médio | Apoiar decisões antes da falta de dinheiro. |
| 8 | Rentabilidade por serviço/projeto e margem de contribuição | Média | Médio | Identificar serviços que sustentam ou consomem o resultado. |
| 9 | Aprovação de obrigações por limite e responsável | Média, para equipes | Médio | Reduzir pagamentos indevidos e erros operacionais. |
| 10 | Testes cruzados, desempenho e publicação rastreável | Alta/média | Incremental | Detectar regressões entre módulos antes do deploy. |

Os esforços são comparativos, não estimativas de prazo. Dependem da definição das políticas financeiras e dos dados já existentes.

## 1. Fechamento consistente

**Constatação:** `closePeriod` grava o estado fechado e o evento de auditoria. Baixas e exclusões de títulos possuem verificações de período, mas `updateTitle`, `cancelTitle`, a criação comum de títulos e a geração de parcelas em `createDebt` não chamam `assertPeriodOpen`. A DRE consulta a classificação, o valor e o estado vigentes dos títulos. Assim, esses caminhos permitem que dados que compõem um mês fechado sejam alterados sem sua reabertura. A leitura das migrations não encontrou um bloqueio por trigger que compensasse esses caminhos.

**Proposta:** estabelecer uma matriz explícita de operações afetadas pelo fechamento e centralizar a validação no domínio. Em alterações de competência, verificar o período antigo e o novo. Preservar o recebimento em um mês aberto de um título de competência antiga: isso não deve exigir reabrir o mês de origem. Para mudanças retroativas, exigir reabertura motivada. Avaliar também alterações na natureza das categorias que reclassificariam títulos de meses anteriores.

**Aceite:** fechar setembro impede editar valor/classificação/competência, cancelar ou inserir registros que mudariam o resultado de setembro. Receber o título em outubro continua permitido. Reabrir setembro libera a correção e registra responsável e motivo.

**Evidência:** [fechamento](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/packages/domain/src/closures/close-period.ts>), [edição](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/packages/domain/src/titles/update-title.ts>), [cancelamento](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/packages/domain/src/titles/cancel-title.ts>), [exclusão com verificação](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/packages/domain/src/titles/delete-title.ts>).

## 2. Saldo de dívida por eventos

**Constatação:** `debtView` conta títulos com status `SETTLED` e chama `balanceAfter` com essa contagem. Não considera a amortização da parcela específica, baixas parciais ou a data efetiva da baixa para esse saldo.

**Reprodução isolada:** dívida Price de R$ 1.000,00, juros de 10% ao mês e três parcelas, apenas como exemplo matemático. Amortizações do cronograma: R$ 302,11, R$ 332,32 e R$ 365,57. Se somente a terceira parcela for marcada como quitada, a lógica de contagem retorna R$ 697,89 de saldo. Subtrair a amortização atribuída à terceira parcela no próprio cronograma retorna R$ 634,43: diferença de R$ 63,46. Esse exemplo demonstra a perda da identidade da parcela; não simula renegociação nem recalcula juros de uma antecipação real.

**Proposta:** persistir principal amortizado, juros e demais componentes de cada parcela e de sua liquidação. Definir a distribuição em pagamentos parciais, descontos, antecipações e renegociações. Usar somente eventos efetivos até a data-base. Registrar uma revisão de cronograma quando o contrato mudar, com histórico.

**Aceite:** pagamentos parciais e fora de ordem, estornos e liquidações futuras têm efeito previsto e testado no saldo. A soma das amortizações reconhecidas reconcilia com o principal pendente.

**Evidência:** [dívidas](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/packages/domain/src/wealth/wealth.ts>), [amortização](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/packages/domain/src/wealth/amortization.ts>), [testes atuais](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/packages/domain/src/__tests__/wealth.test.ts>).

## 3. Principal e juros separados

**Constatação:** `createDebt` grava o valor integral da prestação em `originalAmountCents`, com uma única categoria. A separação entre juros e amortização está em texto nas observações. Se a categoria for financiamento, os juros do contrato ficam fora da DRE junto do principal; se for despesa, o principal pode entrar como despesa operacional.

**Proposta:** substituir a dependência do texto por componentes estruturados. Uma prestação de R$ 1.200,00 com R$ 1.000,00 de amortização e R$ 200,00 de juros deve produzir R$ 1.200,00 de saída de caixa, R$ 1.000,00 de redução do principal e a classificação explícita dos R$ 200,00 no resultado, segundo a política de competência adotada. Definir também como cadastrar a entrada do empréstimo sem duplicar um saldo inicial já informado.

Não se deve somar novamente juros contratuais já incluídos na prestação ao campo de juros/multa de atraso da baixa. Tributos, seguros, tarifas e eventuais custos capitalizados exigem classificação própria, quando aplicáveis.

O CPC 03 distingue amortização de financiamento e juros nos fluxos. Essa distinção é referência para o modelo gerencial, sem afirmar que a tela atual seja uma DFC normativa: [CPC 03, itens 17 e 31–34](https://www.cpc.org.br/Arquivos/Documentos/183_CPC_03_R2_rev%2024.pdf).

## 4. Patrimônio e arquivamento

**Constatação:** a dívida pode ser arquivada com parcelas pendentes. `getNetWorth` usa `listDebts` com o filtro padrão de ativos, retirando essa dívida do passivo apresentado. As parcelas permanecem nas saídas. Contas a receber e obrigações comuns também não entram no patrimônio, apesar do título abrangente da tela.

**Proposta:** separar visibilidade do cadastro e existência da obrigação: dívida arquivada com saldo deve continuar no cálculo. Permitir o arquivamento visual ou exigir liquidação, conforme a política escolhida. Para o plano empresarial, incluir direitos e obrigações reconhecidos, evitando repetir parcelas de dívidas e faturas já computadas. Como alternativa inicial, apresentar o painel como posição patrimonial parcial e mostrar claramente os itens excluídos.

Vincular investimentos cadastrados manualmente às contas correspondentes quando representarem o mesmo recurso, prevenindo contagem duplicada. Mostrar data da avaliação dos bens e alertar quando estiver desatualizada.

**Aceite:** arquivar uma dívida sem pagar não aumenta o patrimônio. A mesma aplicação registrada por conta e por bem não é somada duas vezes. O usuário consegue identificar o que está incluído e excluído.

**Evidência:** [arquivamento e patrimônio](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/packages/domain/src/wealth/wealth.ts>), [apresentação](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/apps/web/app/(app)/patrimonio/page.tsx>).

## 5. Uma definição financeira compartilhada

**Constatações:**

- O PDF mensal consulta baixas para recebido/pago, sem consultar devoluções, enquanto o fluxo de caixa as considera.
- O calendário filtra títulos por status aberto e baixa sem limite da data efetiva; uma baixa futura pode retirar um compromisso que ainda está pendente hoje.
- A projeção do fluxo usa hoje + 29 dias para um horizonte inclusivo de 30 dias; a do dashboard usa hoje + 30 e inclui ambos os extremos.
- O resultado mensal vem dos insights operacionais; a DRE também tem resultado financeiro. Esses valores podem diferir legitimamente, mas precisam de rótulos e conferência explícitos.

**Proposta:** criar serviços compartilhados para saldo na data-base, principal pendente, movimentação realizada, projeção e resultado. Telas e PDFs devem consumir os mesmos serviços, acrescentando somente filtros e apresentação. Tornar explícitos competência, data efetiva, vencimento, data provável e momento da geração. Produzir cada relatório a partir de uma leitura coerente dos dados.

**Aceite:** mesmo período, escopo e definição produzem o mesmo valor em fluxo, calendário, dashboard e PDF. Testes incluem devolução, baixa futura, virada de mês e último dia do horizonte. Resultado operacional e gerencial aparecem diferenciados quando forem métricas diferentes.

**Evidência:** [PDF mensal](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/packages/domain/src/reports/monthly-report.ts>), [calendário](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/packages/domain/src/reports/financial-calendar.ts>), [dashboard](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/packages/domain/src/reports/dashboard-overview.ts>), [projeção do fluxo](<C:/Users/Sergio Oliveira/Documents/Claude/Sistemas/Controle Financeiro/packages/domain/src/reports/cash-projection.ts>).

## 6. Carteira histórica e relatórios reproduzíveis

**Constatação:** no aging, a data de referência muda as faixas de atraso dos saldos atuais; isso está corretamente avisado na tela. Ainda não representa a carteira existente naquela data. O fechamento não persiste uma versão dos números e das classificações apresentadas.

**Proposta:** guardar eventos suficientes para reconstrução e/ou snapshots versionados no fechamento. Incluir saldo por título, classificação, baixas, cancelamentos, renegociações e metadados de cálculo. Ao reabrir e fechar novamente, gerar nova versão e preservar a anterior.

**Aceite:** pagar hoje não apaga a inadimplência do relatório de setembro. Um PDF enviado anteriormente pode ser reproduzido ou recuperado com sua versão e data-base. Distinguir indicadores do mês das posições atuais incluídas em um relatório mensal.

## 7. Previsão que apoia decisões

Já existem projeções e cenários: a evolução deve aproveitar essa base. Acrescentar data provável de recebimento, promessa de pagamento e uso explícito do agendamento bancário na previsão. Manter separado o vencimento contratual. Exibir títulos sem conta prevista e configurar reserva mínima de caixa. Incluir recorrências não materializadas somente com identificação de estimativa e regra para não duplicar o título quando for gerado.

O usuário deveria conseguir responder: “Se receber cinco dias depois, ainda consigo pagar a folha?” e “Qual compromisso causa o primeiro déficit?”. Mostrar os títulos que formam o déficit ajuda mais que apenas um total.

Para cofrinhos, explicitar se guardar significa separar virtualmente dinheiro na mesma conta bancária ou registrar uma transferência real. Em ambos os casos, mostrar saldo total, reservado e livre, preservando a possibilidade de conciliar o saldo físico com o extrato.

## 8. Rentabilidade de serviços e projetos

O produto já possui categorias, centros de custo e rateios. Acrescentar classificação fixa/variável, critérios de alocação e uma visão por serviço, contrato ou projeto: receita líquida, custos diretos, margem de contribuição e despesas alocadas. Não presumir que toda categoria de natureza COST é variável.

Exemplo gerencial: receita líquida de R$ 50 mil e gastos variáveis de R$ 20 mil produzem margem de contribuição de 60%. Com R$ 18 mil de gastos fixos, o ponto de equilíbrio é R$ 30 mil, sob essas premissas. Só calcular com base consistente e margem positiva; avisar quando faltar classificação. Referência: [Sebrae, planejamento financeiro, margem e ponto de equilíbrio](https://bibliotecas.sebrae.com.br/chronus/ARQUIVOS_CHRONUS/bds/bds.nsf/DCF4DE95D281F05E03256D520059B109/$File/NT00001D72.pdf).

Essa visão permite rever preço e custo de um serviço com faturamento alto e baixa contribuição, usando dados já cadastrados.

## 9. Aprovações e rotina de cobrança

Para empresas com mais de uma pessoa no financeiro, adicionar aprovação opcional por valor, responsável e tipo de despesa. Estados possíveis: lançado, aguardando aprovação, aprovado, agendado e liquidado. Aprovar/agendar não é baixa. Quem aprova e quem liquida podem ser diferentes, com política por empresa.

Na cobrança, evoluir o registro de contatos para incluir retorno, promessa de pagamento e próximo acompanhamento. As ações de contato continuam dependentes da decisão do usuário. A promessa pode alimentar a projeção, preservando o valor e vencimento contratuais.

## 10. Desenvolvimento, testes e publicação

Manter o monólito modular. As primeiras mudanças técnicas devem apoiar as regras financeiras:

- **Idempotência nos novos fluxos:** `createDebt` ainda não usa a chave de repetição existente no núcleo. Uma repetição da requisição pode criar outra dívida e outro conjunto de parcelas. Testar também a concorrência entre exclusão e pagamento de suas parcelas.
- **Testes entre módulos:** adicionar casos de fechamento versus edição/cancelamento, patrimônio versus arquivamento, juros de financiamento versus DRE, baixa futura versus calendário e devolução versus PDF. Os E2E atuais cobrem painel, entrada/recebimento, conciliação e cofrinho, mas não esses caminhos.
- **Desempenho medido:** as listas de títulos já têm paginação. Relatórios ainda carregam carteiras inteiras e `listDebts` consulta títulos por dívida. Medir com volumes representativos, agregar no banco quando apropriado e eliminar consultas repetidas, sem introduzir saldos duplicados como fonte financeira.
- **CSS por área:** `globals.css` tem 4.859 linhas. Extrair gradualmente estilos dos módulos, mantendo tokens e padrões compartilhados; evitar uma reescrita simultânea de todas as telas.
- **Publicação rastreável:** `deploy.sh` atualiza para a ponta da master e faz build local. Considerar versão aprovada no CI, imagem identificada pelo commit, ensaio de migrations em homologação e roteiro de retorno compatível com o banco.
- **Restauração real:** o CI já testa backup/restauração. Atualizar evidências de restauração em produção e recuperação dos anexos e chaves; a documentação operacional local ainda apresenta parte das verificações como pendente em setembro. O estado real do servidor não foi consultado nesta avaliação.

## Decisão sobre moedas

O domínio aceita códigos de moeda em contas e títulos, enquanto vários agregados somam centavos e exibem BRL sem conversão. Se o escopo é Brasil em reais, validar BRL no domínio é uma solução inicial plausível. Se houver uso real de moedas diferentes, separar totais por moeda e definir conversão, data da taxa e diferenças cambiais antes de apresentar um total único. Referência: [CPC 03, itens 25–28](https://www.cpc.org.br/Arquivos/Documentos/183_CPC_03_R2_rev%2024.pdf).

## Sequência sugerida

1. Corrigir fechamento, saldo das dívidas, arquivamento e classificação principal/juros; adicionar testes de regressão correspondentes.
2. Compartilhar os cálculos e conferir igualdade entre calendário, dashboard, fluxo e PDF, com rótulos claros para definições diferentes.
3. Implementar histórico de fechamento/carteira e previsões com datas prováveis.
4. Acrescentar rentabilidade por projeto, aprovação para equipes e ajustes de desempenho conforme medidas reais.

Esta sequência preserva as entregas existentes e concentra primeiro o esforço nos números que orientam decisões do usuário.
