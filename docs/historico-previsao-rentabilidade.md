# Histórico, previsão e rentabilidade — itens 6, 7 e 8

## Histórico preservado

Cada fechamento guarda uma versão imutável do resumo mensal, DRE, carteira por título, classificações, baixas, dados estruturados de dívidas e compras de cartão do mês, rentabilidade e PDF original. Há isolamento por empresa e acesso apenas aos membros com visão integral. O papel da aplicação não pode editar ou apagar versões; uma proteção adicional no banco impede essas operações.

A competência do resultado é o mês selecionado. A carteira e a projeção representam a posição no **dia da captura**, indicado no documento. Não há reconstrução retroativa de carteiras de meses sem versões; um fechamento de setembro realizado em outubro preserva a posição disponível em outubro, sem fingir que ela foi observada em 30/09. Pagamentos posteriores não alteram a versão preservada.

Fechar um período já fechado é idempotente. Reabrir e fechar de novo cria outra versão. PDFs emitidos desde esta entrega são recuperados com os mesmos bytes; documentos enviados antes da entrega não podem ser recuperados retroativamente. Repetir um evento de envio usa a versão vinculada ao evento, inclusive após reabertura.

## Planejamento de caixa

Recebíveis usam, nesta ordem, promessa do cliente, data provável e vencimento. A probabilidade informada pondera o valor em centavos: 50% de R$ 1.000 representa R$ 500 no cenário, sem assegurar uma entrada parcial. Pagamentos usam agendamento bancário ou vencimento. Todas as datas respeitam o fuso da empresa para determinar hoje.

O cenário de atraso desloca as entradas pelo número de dias informado, mantendo os pagamentos. A reserva mínima é um piso de planejamento, separado das transferências efetivas para cofrinhos. O alerta informa o primeiro dia abaixo do piso, menor saldo, necessidade adicional e pagamentos previstos naquele dia. São saldos ao fim do dia, sem ordenação intradiária; se o saldo inicial já está abaixo do piso, o alerta começa hoje.

Recorrências ativas não materializadas aparecem como estimativas identificadas, desativáveis. A chave regra + ocorrência impede duplicação, inclusive quando um título anterior foi cancelado ou removido. Ocorrências de meses fechados não são estimadas. Baixas futuras entram pelo caixa líquido cadastrado, sem contar novamente seu principal e desconto. A visão contratual continua usando o principal pendente hoje nos vencimentos, como painel e calendário.

Contas ativas, operacionais, abertas até hoje e incluídas no disponível formam o saldo inicial. Compromissos sem conta definida são identificados e entram na projeção consolidada; os vinculados a contas fora desse caixa são sinalizados e excluídos da projeção. Não há previsão automática de novas vendas, investimentos, transferências futuras ou encargos não cadastrados.

## Rentabilidade

Centros de custo representam áreas, contratos, projetos ou serviços. O relatório usa competência, títulos não cancelados e seus rateios, e compras de cartão. Faturas e parcelas estruturadas de dívidas não duplicam gastos operacionais. A classificação de fixo/variável é explícita nas categorias; o padrão é **não classificado**, mesmo para custos.

Receita operacional registrada considera os lançamentos assinados na natureza de receita operacional. Não deduz impostos, comissões ou descontos automaticamente. Gastos variáveis incluem custos e despesas assim classificados. Margem de contribuição = receita menos variáveis. Fixos diretos, fixos rateados e gastos sem classificação completam o resultado operacional. Juros, taxas e descontos de baixas, devoluções de caixa e movimentos de capital não são incorporados automaticamente: devem ser conferidos na DRE, sem interpretar esse resultado como lucro líquido contábil. A DRE considera encargos efetivos somente até hoje, excluindo baixas com data futura.

Fixos sem centro permanecem separados por padrão. O critério opcional de participação na receita positiva distribui apenas os fixos compartilhados, conserva os centavos e não altera os lançamentos. Variáveis sem centro não são distribuídos automaticamente; enquanto existirem, as margens por projeto ficam indisponíveis. O total da empresa permanece calculável quando todos os gastos estão classificados.

Ponto de equilíbrio = fixos divididos pela razão exata de contribuição, arredondado para cima em centavos. Só aparece com classificação completa, receita e contribuição positivas, variáveis e fixos não negativos. Uma receita de R$ 50 mil, variáveis de R$ 20 mil e fixos de R$ 18 mil resulta em contribuição de 60% e equilíbrio de R$ 30 mil. A estimativa depende do mix e da capacidade de manter essa estrutura no período.

Referência conceitual: [Sebrae — Conceitos básicos de administração financeira, seções de custos, contribuição e ponto de equilíbrio](https://bibliotecas.sebrae.com.br/chronus/ARQUIVOS_CHRONUS/bds/bds.nsf/DCF4DE95D281F05E03256D520059B109/$File/NT00001D72.pdf).

## Operação

As migrações manuais adicionam campos de planejamento/classificação e a tabela de versões. Aplicar com `prisma migrate deploy` e regenerar o cliente antes do build. A entrega foi aplicada apenas aos bancos locais de desenvolvimento e teste; produção exige executar as migrações no ambiente de implantação.

Validação concluída: suíte completa com 472 testes aprovados antes dos ajustes finais; depois, 45 testes financeiros relevantes aprovados, incluindo os 16 novos casos desta entrega. Tipos e compilação de produção aprovados. Lint sem erros, com nove avisos preexistentes. Quatro testes de navegador passaram sobre a versão de produção, incluindo login, modal amplo, promessa e reserva, tela de celular, preservação após recebimento, reabertura, classificação e navegação entre rentabilidade e DRE preservadas. Capturas de tela foram inspecionadas visualmente.
