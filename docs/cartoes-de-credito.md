# Cartões de crédito

Cadastro de cartão, compras (à vista e parceladas) e fatura por ciclo. Tela em `/cartoes`; domínio em
`packages/domain/src/credit-cards/`.

## Como o dinheiro é modelado

O desenho segue a pergunta que um consultor financeiro faz: **o gasto acontece na compra, o dinheiro sai no pagamento da fatura**.

| Pergunta | Onde a resposta vive |
| --- | --- |
| Quanto gastei em cada categoria, em cada mês? (competência) | `credit_card_purchases` (categoria + `competence_date`). O DRE soma as compras. |
| Quanto devo pagar, e quando? | Um **título a pagar** por fatura (`credit_card_invoices.title_id`), com o total das compras e o vencimento da fatura. |
| Quanto saiu da conta? | A **baixa** desse título (a mesma baixa de qualquer saída). |

Consequências boas de a fatura ser um título comum:

- Pagamento parcial, juros/multa, estorno do pagamento e conciliação 1:1 com a linha do extrato funcionam sem código novo.
- Projeção de caixa dos 30 dias, relatório de contas em aberto, "A pagar", vencidos e lembretes de vencimento já enxergam a fatura.
- O DRE **ignora** o título da fatura (`creditCardInvoice: null`) e conta as compras: contar os dois somaria o mesmo dinheiro duas vezes.

## Regras

- **Qual fatura recebe a compra:** a fatura fecha no dia de fechamento. Compra antes do fechamento entra na fatura do mês; compra **no dia do fechamento ou depois** entra na seguinte. O vencimento é a primeira ocorrência do dia de vencimento depois do fechamento. Mês sem o dia (31 em fevereiro) usa o último dia do mês, sem arrastar o ajuste (`invoice-cycle.ts`).
- **Compra parcelada:** uma linha por parcela, cada uma na sua fatura. Centavos do resto vão para as primeiras parcelas (R$ 100 / 3 = 33,34 + 33,33 + 33,33). A competência de cada parcela anda um mês por vez.
- **Limite:** usado = saldo a pagar de **todas** as faturas do cartão, inclusive parcelas futuras (o banco reserva o total da compra parcelada). O limite é informativo: compra acima dele é registrada e a tela avisa.
- **Situação da fatura** não é gravada, vem de hoje + saldo: `OPEN` (ciclo em andamento), `FUTURE` (parcelas à frente), `CLOSED` (fechada, a pagar), `OVERDUE`, `PAID`, `EMPTY` (todas as compras canceladas). "Hoje" é no fuso da empresa.
- **Pagamento** só depois do fechamento, por qualquer caminho (tela do cartão, tela do título, baixa em lote): a fatura aberta mudaria de valor depois de paga.
- **Fatura paga não aceita compra nova nem cancelamento** (erro explicando que é preciso estornar o pagamento). Cancelar compra de fatura com pagamento parcial só é aceito se o total continuar maior que o já pago.
- **Cancelar compra** não apaga: guarda motivo e data, recalcula a fatura e fica na auditoria. Em compra parcelada pode cancelar "esta e as seguintes". Fatura sem compras vira título cancelado e some das telas; voltar a lançar nela reabre.
- **Editar compra** só mexe em descrição e classificação (categoria, estabelecimento, centro de custo). Valor e data definem a fatura: corrige-se cancelando e lançando de novo.
- **Mudar fechamento/vencimento** do cartão só vale para faturas ainda não criadas; as existentes guardam as próprias datas.
- **O título da fatura não pode ser editado, cancelado, excluído, duplicado, rateado nem reclassificado à mão** (`TitleManagedByCreditCardError`): o valor vem das compras. A tela do título leva para a fatura.
- **Acesso:** só proprietário ou usuário com acesso total (`accessScope = ALL`). Quem está restrito a centros de custo não vê cartões, porque a fatura mistura centros. Imposto na RLS (`app_can_access_cost_center(company, NULL)`) e no domínio.
- **Zerar a conta** apaga compras e faturas (e seus títulos); o cadastro do cartão fica, como as contas financeiras.

## Gestão e planejamento

- A tela de cartões apresenta dívida total, vencimentos entre hoje e os próximos 30 dias, faturas vencidas e limite disponível dos cartões ativos. Todas as faturas pendentes entram nos totais, inclusive se um pagamento estornado reabrir a dívida de um cartão arquivado.
- O compromisso por mês usa o vencimento real das faturas nos próximos seis meses. Valores posteriores ao horizonte aparecem em nota. É a previsão das compras já registradas: novas compras e encargos ainda não lançados não estão incluídos. Limite disponível não é dinheiro em caixa.
- A agenda reúne todas as faturas vencidas e as que vencem nos próximos 30 dias, com acesso direto ao detalhe. Os cartões com atrasos aparecem primeiro e mostram o saldo total vencido, além da próxima fatura.
- Antes de lançar uma compra, a prévia usa as mesmas regras de ciclo e divisão de centavos do domínio. Mostra primeiro/último vencimento, valor de cada parcela e limite restante. Faturas existentes mantêm as datas gravadas mesmo após editar o cartão.
- Os formulários de cadastro/edição de cartão e de compra usam modais de até 1.120 px no desktop, com campos em duas colunas. No celular, os campos se empilham e o modal respeita a largura disponível.
- Antes de registrar um pagamento, a prévia distingue principal, juros/multa e tarifas, mostra a saída total da conta e o principal ainda pendente. O histórico também mostra as tarifas e a saída total.
- Criar, reclassificar, cancelar ou excluir compras não pode modificar competências fechadas. Criação/cancelamento/exclusão também conferem os períodos dos fechamentos das faturas afetadas. Um parcelamento que afete qualquer período fechado é recusado inteiro, na mesma transação.
- Datas inexistentes, como 31 de fevereiro, são recusadas. Alterar os dias do cartão não muda a classificação nem as datas de uma fatura já criada.
- Registrar pagamento da fatura é uma operação idempotente em uma única transação: repetir a chave com o mesmo conteúdo retorna a baixa original, mesmo depois de quitada; conteúdo diferente é recusado.

## Fora do escopo desta versão

Estorno/crédito de compra como lançamento próprio na fatura, antecipação de pagamento de fatura ainda aberta, compras em moeda estrangeira, importação de fatura (OFX/PDF), cartão adicional por portador, anuidade e rotativo calculado automaticamente (juros se informam no pagamento). O dashboard já apresenta um resumo dos cartões.
