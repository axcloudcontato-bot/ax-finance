# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dois públicos com o mesmo peso no design:

- **Empresa:** dono de pequena empresa brasileira de serviços (cerca de 1 a 20 pessoas: instalação e manutenção, agências, assistência técnica, serviços empresariais). Cuida pessoalmente do financeiro, vem de planilha e quer saber quanto tem, o que precisa pagar e receber, e como fica o caixa nas próximas semanas. Pode trabalhar com um assistente financeiro e convidar o contador (leitura e exportação).
- **Pessoa:** quem organiza as finanças da casa no plano "Gestão Pessoal": contas, cartões, orçamento, cofrinhos, dívidas e patrimônio.

O mesmo app precisa soar profissional para a empresa e acolhedor para a pessoa, sem virar dois produtos.

Uso principal: **computador, no escritório**, em sessões de trabalho (lançar, conciliar, conferir e fechar o mês). O celular serve para consultas rápidas e registros pontuais, e precisa funcionar bem, mas não é a referência.

## Product Purpose

Gestão financeira para quem não é do financeiro. Promessa: "Saiba quanto sua empresa tem, o que precisa pagar e como ficará o caixa nas próximas semanas." O cliente compra organização, previsibilidade e menos trabalho manual. Sucesso é a pessoa trocar a planilha pelo AX Finance, registrar a rotina com confiança nos saldos e voltar toda semana.

## Positioning

- **Previsão de caixa explicável:** mostra quanto vai haver nas próximas semanas e de onde vem cada número (o que entra, o que vence, o que já venceu e fica de fora).
- **Simples de implantar:** sair da planilha rápido, com importação de extrato (CSV/OFX), regras de categoria e conciliação, sem treinamento longo.

Não são diferenciais comprovados: atendimento humano especializado e "empresa e casa no mesmo lugar" (este é capacidade, não posição exclusiva).

## Operating Context

- Rotina de entradas e saídas (títulos), com baixa total ou parcial, multa e juros, parcelamento e recorrência.
- Conciliação bancária a partir de extrato importado, com regras automáticas de categoria.
- Fechamento mensal: períodos fechados bloqueiam alterações; relatório mensal em PDF por e-mail.
- Cobrança de clientes por mensagem copiada, e-mail ou WhatsApp, com PIX copia e cola e QR Code.
- Multiempresa: a mesma pessoa pode ter acesso a mais de uma empresa (o contador, em especial). Errar a empresa antes de uma baixa é o erro mais caro.
- Notificações: resumo diário de vencimentos, resumo semanal e avisos de assinatura, na campainha e por e-mail.

## Capabilities and Constraints

- Terminologia: "Entradas" e "Saídas" na interface; termos técnicos (competência, DRE, baixa, conciliação) com explicação contextual.
- Planos: "Gestão Pessoal" (R$ 29,90/mês) e "Essencial" (R$ 59/mês, com conciliação, fechamento de período, auditoria e DRE gerencial). Trial de 14 dias; cobrança pela Stripe.
- O app registra e analisa; não movimenta dinheiro nem tem custódia. Relatórios são gerenciais e não substituem a escrituração contábil.
- Português brasileiro e BRL; datas no fuso da empresa.
- Ações irreversíveis exigem confirmação; valor e empresa visíveis antes de confirmar uma baixa.
- Sem dados financeiros offline por padrão.
- Tela de login: o desenho atual deve ser preservado (pedido do usuário).

## Brand Commitments

Nenhum compromisso fixo: o redesenho pode propor nome visual, ícone e identidade novos. "AX Finance" é nome de trabalho (o DIRECAO.md pede pesquisa de nome, domínio e marca antes do uso comercial). Voz já praticada na interface: direta, didática e honesta, explicando a regra por trás do número.

## Evidence on Hand

- Nenhum cliente pagante ainda; produto antes dos primeiros clientes. Não inventar depoimentos, casos, números de clientes ou resultados.
- Dados disponíveis são da conta demo do seed (`packages/db/prisma/seed.ts`).
- Especificação completa de produto e negócio em `DIRECAO.md`.

## Product Principles

1. **Todo número se explica.** Saldo, previsão e indicadores mostram de onde vêm, no lugar onde aparecem.
2. **Confiança antes de velocidade nas ações de dinheiro.** Baixa, estorno, exclusão e conciliação deixam claro o valor, a conta e a empresa antes de confirmar.
3. **Linguagem de quem não é do financeiro.** Entradas e saídas primeiro; o termo técnico vem com explicação.
4. **Mesa de trabalho, não vitrine.** A tela do dia a dia é otimizada para lançar, conferir e fechar com eficiência no computador; o painel informa o que precisa de atenção.
5. **Dois públicos, um produto.** Empresa e casa compartilham a mesma base; o tom e o vocabulário se ajustam ao plano, não a estrutura.

## Accessibility & Inclusion

WCAG 2.2 AA como piso: contraste adequado (inclusive nas cores de dinheiro positivo e negativo), foco visível e único, navegação completa por teclado, rótulos para leitores de tela e informação que nunca depende só de cor (requisito da Seção 15 do DIRECAO.md).
