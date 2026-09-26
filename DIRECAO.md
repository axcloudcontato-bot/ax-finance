# Projeto de SaaS de Gestão Financeira

**Especificação de produto, negócio, engenharia e lançamento — versão 1.0**  
Preparado para Mestre • 25 de setembro de 2026  
Nome de trabalho: **AX Finance**. Nome, domínio e marca ainda precisam ser pesquisados antes de uso comercial.

## 1. Decisão executiva

Construir um SaaS B2B de gestão financeira para pequenas empresas brasileiras de serviços, com dashboard analítico como página inicial, contas a receber, contas a pagar, conciliação, categorias e relatórios. A promessa proposta é: **“Saiba quanto sua empresa tem, o que precisa pagar e como ficará o caixa nas próximas semanas.”**

O cliente compra organização, previsibilidade e redução de trabalho manual. Um dashboard bonito ajuda na venda; saldos confiáveis, implantação simples e uso recorrente sustentam a assinatura.

Recomendação de entrada: prestadores de serviços com uma operação administrativa pequena, recebimentos recorrentes ou parcelados e controle atual em planilha. Exemplos para validação: empresas de instalação e manutenção, agências, assistência técnica e serviços empresariais. Seu conhecimento em operação e redes pode facilitar acesso ao primeiro grupo, sem transformar a primeira versão em ERP de telecom.

Este documento é uma especificação para validação e desenvolvimento. Não representa software construído nem comprovação de demanda. Preços, custos, metas e cronograma são hipóteses de planejamento; devem ser confrontados com clientes, propostas de fornecedores e capacidade da equipe.

### Premissas adotadas

| Tema | Proposta inicial |
|---|---|
| Mercado | Brasil, empresas de serviços |
| Idioma e moeda | Português brasileiro e BRL |
| Plataforma | Aplicação web responsiva, boa experiência no celular |
| Modelo comercial | Assinatura por empresa, com limites transparentes |
| Cobrança do SaaS | Provedor externo; checkout hospedado/tokenizado |
| Operação financeira do cliente | Registro, análise e conciliação; sem custódia de recursos |
| Dados bancários iniciais | Cadastro manual e importação CSV/OFX |
| Integrações bancárias automáticas | Fase posterior, com parceiro adequado |
| Relatórios | Financeiros e gerenciais; não substituem escrituração contábil |
| Estratégia de entrega | Piloto pago e controlado antes de lançamento amplo |

## 2. Posicionamento, público e validação

### Perfil inicial de cliente

Empresa com dono diretamente envolvido no financeiro, aproximadamente 1 a 20 pessoas, uma ou poucas contas bancárias, despesas recorrentes e dificuldade para acompanhar compromissos futuros. O tamanho é um filtro para entrevistas, não condição rígida de contratação.

Usuários: proprietário, assistente financeiro e contador convidado. Comprador: proprietário. Benefício imediato: importar o histórico, organizar compromissos e visualizar o caixa sem montar fórmulas em planilhas.

Problemas a validar: falta de visão dos vencimentos; mistura de dinheiro pessoal e empresarial; recebimentos esquecidos; dificuldade em saber se existe caixa para pagar despesas; lançamento repetido; fechamento mensal trabalhoso; dependência de uma pessoa que conhece a planilha.

### Concorrência e diferenciação

Conta Azul e Omie já apresentam gestão financeira em ofertas mais amplas, incluindo outros processos empresariais [1][2]. Isso indica uma categoria estabelecida, mas não comprova oportunidade para mais um produto genérico. A hipótese de diferenciação é oferecer implantação rápida, uso simples, previsões explicáveis e atendimento especializado no segmento inicial.

| Alternativa do cliente | Razão para continuar nela | Razão que precisamos demonstrar para migrar |
|---|---|---|
| Planilha | Custo baixo e flexibilidade | Menos trabalho, histórico, alertas e consistência |
| Aplicativo bancário | Já disponível | Visão de várias contas e compromissos futuros |
| ERP | Integração de processos | Produto adequado a quem precisa principalmente de financeiro |
| Contador/BPO | Confiança e serviço | Colaboração; não exigir que o cliente abandone esse parceiro |

### Pesquisa antes de investir no produto completo

Realizar 15 entrevistas com empresas do mesmo perfil e observar pelo menos 5 rotinas reais, com dados anonimizados. Perguntar: como organiza o financeiro hoje; quando descobriu falta de caixa; quanto tempo gasta; quem lança; quais erros se repetem; o que já tentou; quanto paga; quem decide comprar; que resultado faria valer uma mensalidade.

Evitar perguntar apenas se a pessoa “gostaria do sistema”. Pedir que demonstre uma semana de trabalho e aceitar compromisso concreto com um piloto pago.

**Gate proposto:** pelo menos 5 empresas dispostas a testar com dados reais e 3 dispostas a pagar pelo piloto. Se isso não ocorrer, revisar público, problema ou oferta antes de ampliar o desenvolvimento. Esses números são critérios internos sugeridos, não benchmarks de mercado.

## 3. Escopo e prioridade

P0 = necessário para piloto pago seguro. P1 = evolução depois de validar uso. P2 = expansão dependente de demanda e retorno.

| Módulo | Prioridade | Entrega |
|---|---|---|
| Login, recuperação, empresas, usuários e permissões | P0 | Acesso seguro e isolamento |
| Dashboard analítico | P0 | Caixa, compromissos, evolução e alertas |
| Entradas e contas a receber | P0 | Títulos, parcelas, baixas e estornos |
| Saídas e contas a pagar | P0 | Compromissos, pagamentos e comprovantes |
| Contas e transferências | P0 | Saldos por conta e consolidado |
| Categorias e subcategorias | P0 | Organização e mapeamento gerencial |
| Clientes e fornecedores | P0 | Cadastro unificado de pessoas |
| Recorrências e parcelamentos | P0 | Agenda financeira consistente |
| CSV/OFX e conciliação assistida | P0 | Migração e conferência |
| Relatórios e exportação | P0 | Fluxo, posição, vencidos e DRE gerencial básica |
| Anexos, auditoria e fechamento | P0 | Rastreabilidade |
| Assinaturas, cobrança e painel interno | P0 | Operação comercial |
| Notificações dentro do app e por e-mail | P0 | Vencimentos e resumo |
| Orçamentos, metas e cenários | P1 | Planejamento |
| Centros de custo e projetos completos | P1 | Rentabilidade por área/serviço |
| Cartões e faturas | P1 | Controle do passivo e pagamento sem duplicação |
| Aprovações por valor/alçada | P1 | Segregação de funções |
| Cobrança dos clientes do assinante | P1 | Integração com PSP e notificações |
| Open Finance, OCR e sugestões por IA | P2 | Automação com custo medido |
| Portal BPO, API pública e consolidação | P2 | Expansão por parceiros |
| Notas fiscais, estoque, folha e ERP | Fora do escopo inicial | Avaliar como produtos/integrações separados |

**Regra de escopo:** se prazo ou orçamento ficarem insuficientes, simplificar relatórios e personalizações primeiro. Não cortar isolamento, exatidão dos saldos, exportação, recuperação de dados ou controles de acesso.

## 4. Navegação e inventário de telas

Menu principal: Dashboard; Entradas; Saídas; Contas e transferências; Conciliação; Relatórios; Cadastros; Configurações. Planejamento e Cartões aparecem apenas quando implementados e disponíveis no plano.

Topo: empresa ativa, período, busca autorizada, botão “Novo lançamento”, notificações e perfil. A empresa ativa deve permanecer explícita em todas as telas e exportações.

| Tela | Conteúdo e ações essenciais |
|---|---|
| Site comercial | Benefícios, exemplos, preços, FAQ, contato, termos e cadastro |
| Cadastro e login | Verificação de e-mail, recuperação, sessões e MFA |
| Onboarding | Empresa, conta, saldo inicial, categorias e importação |
| Dashboard | Indicadores, gráficos, compromissos e próximos passos |
| Lista de entradas | Filtros, totais, nova entrada, baixar, duplicar e exportar |
| Lista de saídas | Filtros, totais, nova saída, pagar e anexar comprovante |
| Detalhe do título | Dados, parcelas, baixas, anexos e histórico |
| Contas | Saldos, extrato interno, transferências e ajustes justificados |
| Conciliação | Extrato importado, sugestões e divergências |
| Relatórios | Filtros consistentes, detalhamento e exportação |
| Cadastros | Categorias, pessoas e meios de pagamento |
| Usuários | Convites, permissões, revogação e sessões |
| Assinatura | Plano, uso, faturas, meio de pagamento e cancelamento |
| Configurações | Empresa, alertas, segurança, integrações e exportação |
| Suporte | Ajuda contextual, chamados e situação do serviço |
| Administração interna | Assinantes, cobrança, jobs, suporte e incidentes |

Todas as telas precisam de estados de carregamento, vazio, erro, sem permissão, dados antigos e limite de plano. Um erro de conexão nunca deve aparecer como saldo zero. Dados demonstrativos devem ser identificados e separados dos dados reais.

## 5. Dashboard analítico: página principal

### Perguntas que a página deve responder

1. Quanto dinheiro está disponível agora?
2. Quanto entrou e saiu no período?
3. Quanto preciso pagar e receber nos próximos dias?
4. Existe risco de falta de caixa?
5. Quais categorias estão consumindo recursos?
6. Quais tarefas precisam de atenção hoje?

### Filtros

Período: hoje, últimos 7 dias, mês atual, mês anterior, trimestre, ano e personalizado. Comparação: período anterior de mesma duração ou mesmo período do ano anterior. Conta, categoria, subcategoria e cliente/fornecedor; centros de custo após P1.

Cada componente deve declarar a base temporal: movimento realizado, competência ou posição em uma data. O filtro mensal não deve fazer o usuário acreditar que “saldo atual” significa apenas movimentos daquele mês. Preservar filtros na URL ou preferências, sem expor dados sensíveis.

### Indicadores obrigatórios

| Indicador | Definição | Clique abre |
|---|---|---|
| Saldo disponível | Soma das contas líquidas incluídas, na data de posição | Saldos por conta |
| Recebimentos operacionais | Baixas de receitas operacionais no período | Baixas correspondentes |
| Pagamentos operacionais | Baixas de despesas operacionais no período | Baixas correspondentes |
| Geração líquida operacional de caixa | Recebimentos operacionais menos pagamentos operacionais | Fluxo detalhado |
| A receber | Saldo aberto de títulos no intervalo de vencimentos | Recebíveis filtrados |
| A pagar | Saldo aberto de obrigações no intervalo de vencimentos | Obrigações filtradas |
| Recebíveis vencidos | Saldo aberto vencido antes da data de posição | Lista por atraso |
| Saldo projetado em 30 dias | Saldo atual mais entradas previstas menos saídas previstas | Projeção diária |

Saldo disponível não inclui limite de crédito nem valor a receber. Aportes, empréstimos e retiradas aparecem no fluxo total em grupos próprios, sem inflar receita operacional. Previsão é estimativa baseada nos registros existentes, não garantia de recebimento.

### Gráficos e blocos

Fluxo diário realizado e previsto, com separação visual e legenda; receitas e despesas mensais em 12 meses; ranking das 5 maiores categorias com “Outras”; despesas por categoria com valores além das cores; vencidos por faixa de atraso; próximas contas a pagar/receber; saldo por conta; lista de pendências de conciliação.

Alertas iniciais determinísticos: saldo projetado negativo; título vencido; importação pendente; conta sem conciliação recente; despesa acima de limite configurado. Cada alerta informa valor, período, origem e ação. “Sua despesa aumentou 30%” só aparece com base comparável e link para os lançamentos.

**Aceite:** cada total pode ser reproduzido por uma lista filtrada; widgets compartilham o mesmo instante de referência; transferências não alteram o consolidado; usuário sem acesso a uma conta não recebe seu saldo em cards ou exportações; comparação com base zero mostra “sem base comparável”, sem percentual infinito.

## 6. Entradas e contas a receber

### Cadastro de título

Campos: identificador, descrição, cliente opcional, documento de referência, valor original, moeda, data de emissão, competência, vencimento, categoria, subcategoria, conta prevista opcional, forma prevista de recebimento, observações, anexos e origem. Incluir projeto e centro de custo após P1.

Descrição, valor positivo, competência, vencimento e classificação são obrigatórios no lançamento definitivo; rascunhos podem estar incompletos. “Sem classificação” pode ser permitido apenas como pendência explícita de importação, com alerta para fechamento.

### Baixa

Informar valor do principal liquidado, data efetiva, conta, meio de pagamento, desconto concedido, juros/multa recebidos, taxas retidas e comprovante. Receber parcialmente mantém saldo residual. Receber um título em duas contas cria duas baixas rastreáveis. A conta efetiva pode ser diferente da prevista.

Exemplo: título de R$ 1.000; cliente quita R$ 400; saldo aberto R$ 600. Se o PSP reteve R$ 8, o banco recebe R$ 392 e há taxa de R$ 8. O principal liquidado continua R$ 400. Dashboard e conciliação devem distinguir receita bruta, tarifa e entrada líquida.

### Estados

Rascunho → aberto → parcialmente recebido → recebido. Cancelamento permitido quando não há baixa ativa; com baixa, exige estorno ou devolução apropriada antes. “Vencido” é condição calculada pelo vencimento e saldo aberto, coexistindo com “parcialmente recebido”. Não gravar estado vencido que dependa de atualização manual diária.

Ações: editar título aberto; registrar baixa; duplicar como novo; criar parcelas; configurar recorrência; anexar; registrar devolução; cancelar saldo remanescente com motivo; consultar auditoria. Exclusão física somente para rascunhos elegíveis; transações efetivadas preservam histórico.

**Aceite:** duas solicitações simultâneas não podem liquidar mais principal do que o saldo; repetição da mesma requisição não cria nova baixa; baixa futura não é tratada como dinheiro já recebido; estorno restaura o saldo do título e a posição financeira correta.

## 7. Saídas e contas a pagar

Mesma estrutura de títulos, com fornecedor, competência, vencimento, categoria, conta e documento. Registrar principal liquidado, desconto obtido, juros/multa pagos, taxas adicionais e data efetiva.

Tela separa vencidas, hoje, próximas e pagas. Operações em lote exigem prévia dos itens e valores, validação individual e resultado explícito de sucesso/falha; jamais “sucesso” genérico se alguns itens falharem.

Pagamento registrado manualmente significa **registro de pagamento**, não envio bancário. Texto do botão inicial: “Registrar pagamento”. A futura execução via PSP necessita fluxo e confirmação próprios.

P1: solicitação, aprovação por valor, segregação entre solicitante e aprovador, justificativa de rejeição e trilha de alterações. Aprovar uma despesa não movimenta caixa; registrar pagamento é evento distinto.

**Aceite:** pagamento parcial preserva vencimento e saldo; alteração de conta em pagamento consolidado ocorre por estorno/repostagem; despesa cancelada não entra em previsão; pagamento de obrigação não reaparece como segunda despesa na DRE.

## 8. Contas, saldos e transferências

Tipos iniciais: conta bancária, dinheiro em caixa e carteira de recebimentos. Conta de cartão é passivo e entra em P1 com regras próprias. Cadastro: nome, instituição opcional, moeda, data de início, saldo de abertura, inclusão no saldo disponível e status.

Saldo inicial é uma posição patrimonial, não receita. Definir corte da implantação: saldo de abertura corresponde ao instante imediatamente anterior ao primeiro movimento importado. Mostrar prévia para evitar duplicar histórico com saldo de abertura que já o contém.

Saldo por conta = saldo inicial + movimentos efetivados até a data. Não aceitar edição direta de saldo após implantação. Divergência exige ajuste identificado, justificativa, permissão e auditoria. Conta com histórico é arquivada, não apagada; conta com saldo ou compromissos exige resolução antes de encerrar.

Transferência: origem, destino, valor, data, descrição e tarifa opcional. Gravar as duas pontas de forma atômica; ambas pertencem à mesma empresa no P0. A tarifa é despesa separada. Transferência interna não é receita/despesa no consolidado; no extrato de cada conta aparece como transferência.

Transferência entre empresas diferentes é operação intercompanhia, não transferência interna comum; fica fora do P0. Conta de mesma empresa com liquidação em datas diferentes precisa de conta transitória ou transferência pendente, sem inventar saldo disponível no destino.

## 9. Categorias, subcategorias e classificação

Modelo P0: dois níveis, categoria e subcategoria. Campos: nome, natureza, categoria pai quando aplicável, grupo gerencial, ordem, cor opcional e status. Naturezas: receita operacional, custo, despesa, investimento, financiamento, patrimônio e transferência técnica.

Exemplo inicial adaptável:

| Categoria | Subcategorias |
|---|---|
| Receita de serviços | Instalação, manutenção, consultoria, mensalidades |
| Custos de execução | Materiais consumidos, terceirizados, deslocamento de serviço |
| Pessoal | Salários, benefícios, encargos, pró-labore |
| Estrutura | Aluguel, energia, internet, manutenção |
| Comercial | Anúncios, comissões, ferramentas de vendas |
| Administrativo | Software, contabilidade, escritório |
| Financeiro | Tarifas, juros, multas |
| Tributos | Categorias conforme orientação do contador |
| Investimentos | Máquinas, ferramentas e equipamentos capitalizáveis |
| Financiamento e patrimônio | Empréstimos, aportes, distribuição e amortização |

O modelo sugerido é gerencial. Pró-labore não equivale a distribuição de lucro; compra de ativo não é automaticamente despesa operacional; amortização do principal de empréstimo não é juro. Parametrizar com o contador da empresa.

Regras: impedir ciclos; filho pertence à mesma empresa e tem natureza compatível; não excluir classificação utilizada; desativar mantém histórico. Mudança de grupo gerencial não reescreve silenciosamente relatórios fechados: usar vigência/versionamento e processo de reclassificação auditado.

P1: rateio de um título entre categorias/projetos. A soma dos rateios deve ser exatamente o valor base. Nas baixas parciais, distribuir proporcionalmente e alocar centavos residuais de forma determinística, mantendo soma exata.

## 10. Clientes, fornecedores e contatos

Cadastro unificado de pessoa física/jurídica, permitindo papéis simultâneos. Campos: nome, nome fantasia opcional, CPF/CNPJ opcional quando desnecessário ao fluxo, e-mail, telefone, endereço opcional, responsável e observações. Validação de formato não prova regularidade cadastral.

Exibir histórico de títulos, valor aberto, vencidos e interações. Impedir duplicação evidente de documento normalizado dentro da empresa; permitir homônimos. Não impor exclusividade global de CPF/CNPJ entre empresas assinantes.

Coletar somente dados necessários. Não armazenar dados clínicos, senhas bancárias ou informações sensíveis em observações. Inativação preserva títulos. Unificação de duplicados demanda prévia e auditoria.

## 11. Parcelamentos e recorrências

Parcelamento representa uma obrigação/receita original dividida em títulos. Recorrência representa novos títulos gerados em ciclos. A interface deve explicar essa diferença.

Parcelamento: total, quantidade, primeiro vencimento, intervalo, descrição e categoria. Exemplo: R$ 100 em 3 parcelas = R$ 33,34 + R$ 33,33 + R$ 33,33. Datas no dia 31 devem cair no último dia do mês que não o possui; política de dia útil deve ser configurada separadamente e não aplicada silenciosamente.

Recorrência: frequência, início, término opcional, dia de vencimento, valor, competência, próxima geração e estado. Gerar horizonte limitado, por exemplo 90 dias, com rotina idempotente e chave única por regra/ocorrência. A projeção além do horizonte pode expandir regras virtualmente, identificando estimativas e sem somar ocorrências já materializadas.

Ao editar: “esta ocorrência”, “esta e futuras” ou “todas as futuras abertas”. Títulos pagos/fechados ficam preservados. Pausar impede geração futura, mas não apaga obrigações existentes. Cancelar contrato pede decisão explícita sobre títulos futuros ainda abertos.

## 12. Importação, migração e conciliação

### Fluxo de importação

1. Selecionar empresa, conta e tipo: títulos ou extrato.
2. Enviar CSV/OFX; XLSX pode entrar como extensão do P0 se a migração dos pilotos exigir.
3. Mapear colunas, data, separador decimal e sinal dos valores.
4. Exibir prévia com linhas válidas, inválidas e possíveis duplicatas.
5. Corrigir/ignorar erros e confirmar lote.
6. Processar em background e entregar resumo com rastreabilidade por linha.

Datas ambíguas exigem escolha; valores em branco não viram zero; documentos e identificadores preservam zeros à esquerda; arquivos com fórmulas/macros não são executados. Exportações CSV devem proteger contra interpretação de campos como fórmulas.

Extrato importado é evidência bancária, não novo lançamento automático. Se o usuário já registrou o pagamento, conciliar com ele. Quando não existe lançamento, propor criação com confirmação e categoria. Importar títulos e extrato do mesmo período não pode duplicar dinheiro.

### Duplicidade

Usar identificador bancário externo quando confiável, combinado com empresa e conta. Sem identificador, gerar indícios por data, valor, descrição e origem. Duas compras iguais no mesmo dia podem ser legítimas: sinalizar, não descartar automaticamente. Guardar arquivo/lote e linha de origem.

### Conciliação

Comparar linha bancária com movimento por valor, sentido, conta, datas e descrição. Exibir sugestão e confiança. P0: confirmação manual de vínculo 1:1 e suporte explícito a recebimento com tarifa; P1: agrupamentos 1:N e N:1. Bloquear associação dupla incompatível e explicar divergência residual.

Estados: pendente, sugerido, conciliado e ignorado com motivo. Desfazer conciliação rompe vínculo auditado, não apaga automaticamente o movimento real. Cancelar importação só desfaz elementos elegíveis daquele lote; movimentos já usados exigem revisão.

**Aceite:** importar novamente o mesmo arquivo não altera saldo; conciliar baixa existente não cria nova entrada/saída; interrupção e reprocessamento do job não duplicam linhas; relatório final informa contagem e valores de cada estado.

## 13. Relatórios e definições financeiras

Todo relatório informa empresa, período, regime, filtros, moeda, data de geração e tratamento de cancelamentos/estornos. Exportação mantém filtros e permissões. Totais são calculados no servidor; baixar todas as linhas não depende da página visível.

| Relatório | Base e conteúdo | Fase |
|---|---|---|
| Fluxo de caixa realizado | Movimentos efetivos; operacional, investimento e financiamento | P0 |
| Fluxo projetado | Saldo de posição + títulos abertos + recorrências não duplicadas | P0 |
| Contas a receber/pagar | Saldo aberto por vencimento, pessoa e categoria | P0 |
| Atrasos | Faixas de 1–7, 8–15, 16–30, 31–60 e mais de 60 dias | P0 |
| Receitas/despesas por categoria | Visões separadas de caixa e competência | P0 |
| Extrato interno | Saldo inicial, movimentos e saldo final por conta | P0 |
| Conciliação | Linhas pendentes, divergências e cobertura | P0 |
| DRE gerencial básica | Competência e grupos gerenciais versionados | P0 |
| Orçado versus realizado | Categoria, mês e desvio absoluto/percentual | P1 |
| Rentabilidade por projeto | Receita e custos atribuídos; critérios de rateio visíveis | P1 |
| Consolidado multiempresa | Acesso autorizado e eliminações intercompanhia | P2 |

DRE gerencial: receita reconhecida, deduções, receita líquida, custos, resultado bruto, despesas operacionais e resultado gerencial. Juros e outros resultados devem ter grupos explícitos. Rotular “resultado gerencial estimado” quando faltarem provisões, depreciações ou dados contábeis; não chamar saldo bancário de lucro.

**Competência:** quando o serviço/obrigação é reconhecido gerencialmente. **Vencimento:** quando o pagamento está previsto. **Liquidação:** quando houve movimento efetivo. Um serviço de janeiro recebido em fevereiro pertence à competência de janeiro e ao caixa de fevereiro. Parcelar a cobrança não determina automaticamente como reconhecer a receita; reconhecimento pode ter agenda própria.

### Fórmulas de referência

- Principal aberto = principal original − principal liquidado − descontos que extinguem principal − cancelamentos válidos de saldo. Estornos reabrem os componentes afetados; juros e tarifas ficam separados.
- Vencido = principal aberto positivo e vencimento anterior à data de posição, incluindo acréscimos exigíveis somente quando efetivamente registrados.
- Projeção em D = saldo de posição + recebimentos ainda previstos até D − pagamentos ainda previstos até D. Definir separadamente tratamento de vencidos: reagendados, cenário de recebimento ou excluídos com alerta.
- Margem gerencial = resultado gerencial ÷ receita líquida reconhecida, quando receita líquida positiva. Sem base válida, mostrar “não aplicável”.
- Participação da categoria = valor da categoria ÷ total da mesma natureza, mesma base e mesmo período.
- Inadimplência da carteira vencível no período = saldo ainda vencido dos títulos daquele conjunto ÷ principal exigível daquele mesmo conjunto. Informar data de posição e composição; não dividir estoque vencido histórico por receita do mês.

P0 exporta CSV e relatório imprimível; PDF gerado e XLSX formatado são incrementos úteis conforme demanda. Relatórios grandes devem ser assíncronos, com link temporário e verificação de autorização no download.

## 14. Planejamento, cartões e automações futuras

**Orçamento P1:** valor por categoria e mês, versões, responsável, revisão e comparação. Despesa acima do orçamento pode alertar, sem bloquear pagamentos por padrão.

**Metas P1:** reserva mínima de caixa, redução de despesas e receita prevista. Meta é parâmetro declarado pelo usuário, não recomendação financeira automática.

**Cenários P1:** base, otimista e conservador, com percentuais e adiamentos explícitos. Não alterar títulos reais ao simular.

**Cartões P1:** emissor, fechamento, vencimento, limite informado e compras parceladas. Compra gera despesa/ativo e passivo conforme reconhecimento; pagamento da fatura liquida o passivo e movimenta banco, sem segunda despesa. Juros, taxas, estornos e saldo rotativo são separados. Importar extrato bancário contendo pagamento da fatura deve conciliar com essa liquidação.

**Automação P1/P2:** regras por descrição/fornecedor, sugestão de categoria e alertas. Regra tem prioridade, prévia, histórico e reversão. IA pode sugerir classificação ou explicar indicadores já calculados; não deve calcular saldos oficiais nem movimentar dinheiro por texto livre. Exibir origem, permitir correção e limitar custo por plano.

**OCR P2:** extrair dados de documentos para rascunhos com confiança por campo; usuário confirma. Anexo é conteúdo não confiável, nunca instrução para agente acessar outras empresas ou executar operações.

## 15. Notificações e experiência do usuário

P0: central de notificações e e-mail para vencimentos, resumo semanal, falha de importação, acesso relevante e cobrança da assinatura. Configurar antecedência, horário e canais; deduplicar por evento/destinatário. Distinguir comunicação operacional de marketing.

Mensagens externas aos clientes do assinante entram em fase posterior, mediante configuração e autorização: identidade do remetente, templates, logs, tratamento de falhas, preferências e custos. WhatsApp depende de fornecedor, regras vigentes e viabilidade econômica; não pressupor mensagens gratuitas ou automação informal.

Regras de UX: linguagem “Entradas” e “Saídas”, com conceitos avançados em ajuda contextual; formulário rápido e detalhes expansíveis; filtros lembrados; atalhos opcionais; estado salvo claramente; confirmação em ações irreversíveis; valor e empresa visíveis antes de confirmar baixa.

Mobile: navegação simples, botões acessíveis, tabela convertida em cartões ou rolagem controlada, upload de comprovante e registro rápido. Navegação por teclado, rótulos para leitores de tela, foco visível, contraste adequado e informação que não depende somente de cor.

Não armazenar dados financeiros offline por padrão. Se houver cache, mostrar idade do dado e impedir que operação não sincronizada pareça concluída.

## 16. Onboarding, ativação e retenção

Fluxo proposto: criar conta → confirmar e-mail → informar empresa e fuso → cadastrar conta e saldo de corte → selecionar modelo de categorias → importar ou cadastrar títulos → verificar dashboard → convidar financeiro/contador.

Não exigir CNPJ, endereço completo e dados de cartão antes de mostrar valor, salvo necessidade real do fluxo escolhido. Separar ambiente de demonstração de operação real. Oferecer “começar sem importar” e “agendar implantação”.

Ativação proposta: empresa com uma conta configurada, pelo menos 10 lançamentos válidos ou uma importação concluída, primeiro dashboard real consultado e retorno em até 7 dias. Adequar volume para empresas pequenas; a meta serve para medir uso, não bloquear clientes.

Retenção: resumo semanal útil, lembrete de conciliação, fechamento mensal assistido, trilha de primeiro uso e contato humano quando cliente não conclui implantação. Disparo automático depende de preferências e finalidade. Medir tempo até primeiro valor, dificuldade de importação e chamados por empresa.

## 17. Permissões e estrutura multiempresa

Usuário é identidade global. Organização/tenant é unidade contratante. Empresa é entidade operacional dentro dela. P0 pode limitar uma empresa por assinatura, mantendo o modelo preparado. Permissões são concedidas por associação ativa, não apenas pelo conhecimento de um identificador.

| Papel | Financeiro | Cadastros | Usuários/plano | Exportação | Estorno/fechamento |
|---|---|---|---|---|---|
| Proprietário | Completo | Completo | Completo | Sim | Sim |
| Administrador financeiro | Completo | Completo | Usuários se delegado; plano não | Sim | Sim |
| Operador | Lançar e baixar conforme concessão | Limitado | Não | Opcional | Não por padrão |
| Contador/analista | Leitura | Leitura | Não | Se autorizado | Não |
| Consulta | Leitura autorizada | Leitura autorizada | Não | Não por padrão | Não |

P0 concede acesso por empresa inteira. P1 pode restringir contas/centros de custo, desde que dashboard e relatórios respeitem as restrições e expliquem visão parcial.

Convites expiram e aceitação vincula identidade autenticada. Revogação invalida sessões/credenciais pertinentes. Mudança de proprietário exige reautenticação, confirmação de destino e auditoria. Toda empresa deve manter ao menos um proprietário ativo.

Administrador do SaaS não recebe acesso irrestrito aos financeiros por padrão. Suporte acessa sob fluxo controlado, com motivo, escopo, prazo e trilha; não usar senha do cliente nem impersonação invisível.

## 18. Regras financeiras e integridade do núcleo

Separar **título** (obrigação/direito), **baixa** (liquidação), **movimento** (impacto em conta), **linha de extrato** (evidência) e **lançamento gerencial/razão** (registro econômico). Um único registro genérico para tudo torna parcelas, conciliação e DRE difíceis de manter corretas.

Proposta técnica: razão auxiliar com partidas balanceadas, invisível ao usuário comum. Não se apresenta como contabilidade oficial. Eventos financeiros gravam entradas imutáveis; correções geram contrapartidas. Definir mapas por tipo de evento e validar com profissional de contabilidade antes de implementar DRE/competência.

Regras transversais:

1. Valores monetários em centavos inteiros ou decimal de precisão fixa; nunca ponto flutuante binário para saldos.
2. Moeda explícita por conta e título; P0 rejeita mistura de moedas.
3. Data financeira em campo de data; horário técnico em UTC; fuso IANA por empresa, sugerindo America/Sao_Paulo quando adequado.
4. Criação de baixa, movimentos, razão e auditoria dentro de transação consistente.
5. Chave de idempotência por empresa e operação; rejeitar reutilização com conteúdo diferente.
6. Bloqueio transacional ou controle de versão para evitar baixa/edição concorrente.
7. Estorno técnico distingue-se de devolução real: um corrige erro; outro registra dinheiro retornando em nova data.
8. Fechamento bloqueia competência/baixas antigas conforme política. Reabertura exige autorização e motivo; ajuste em período atual fica identificado.
9. Eventos efetivados não são apagados por exclusão da categoria, cliente ou importação.
10. Cancelar título não apaga comprovante de dinheiro que realmente entrou/saiu.
11. Todo agregado reconstrói-se a partir de registros de origem; caches não são fonte oficial.
12. Desconto, tarifa, juro, principal e retenção têm componentes separados e totais conciliáveis.
13. Pagamento a maior gera crédito/adiantamento explícito ou bloqueio com orientação; não saldo aberto negativo silencioso.
14. Recebível baixado como perda não é recebimento em caixa; tem evento próprio e motivo.
15. Retenções tributárias, adiantamentos e empréstimos demandam componentes próprios; no P0, suportar classificação controlada ou declarar limitação ao cliente, sem improvisar como receita/despesa comum.

## 19. Modelo de dados de referência

| Entidade | Campos/relacionamentos fundamentais |
|---|---|
| users | Identidade, provedor de autenticação, estado |
| tenants | Organização contratante, proprietário, configuração |
| companies | Tenant, nome, documento opcional, moeda, fuso |
| memberships | Usuário, tenant/empresa, papel, estado |
| invitations | Destino, empresa, papel, expiração, hash do token |
| financial_accounts | Empresa, tipo, moeda, status |
| counterparties | Empresa, pessoa/empresa, papéis, contato |
| categories | Empresa, pai, natureza, grupo, vigência |
| titles | Empresa, tipo, principal, competência, vencimento, pessoa |
| title_allocations | Título, categoria, valor; expansível para rateios |
| recognition_schedules | Título/evento, competência, valor reconhecido |
| settlements | Título, principal, desconto, acréscimos, data e conta |
| settlement_components | Taxas, juros, retenções e respectivos grupos |
| transfers | Empresa, origem, destino, valor, data e estado |
| journal_entries / journal_lines | Evento, contas auxiliares, débitos/créditos, reversão |
| recurrence_rules / occurrences | Regra, versão, data da ocorrência e título gerado |
| import_batches / import_rows | Origem, hash, mapeamento, estado e erro por linha |
| bank_statement_lines | Conta, identificador externo, data, valor e origem |
| reconciliation_links | Linha bancária, movimento, valor vinculado e usuário |
| attachments | Empresa, objeto, tamanho, tipo, hash e estado de análise |
| period_closures | Empresa, período, usuário, fechamento/reabertura |
| audit_events | Ator, empresa, evento, recurso, motivo e alterações relevantes |
| notifications / deliveries | Evento, destinatário, canal e tentativas |
| plans / entitlements | Limites e capacidades versionados |
| subscriptions / billing_events | Tenant, provedor, ciclo e estados |
| webhook_events / outbox_events | Origem, identificador, hash, processamento e tentativas |

Em tabelas financeiras, usar tenant_id/company_id e relações que impeçam referência cruzada entre empresas, inclusive chaves estrangeiras compostas quando apropriado. UUID não substitui autorização. Índices iniciais: empresa + vencimento; empresa + competência; conta + data; empresa + estado; identificador externo + provedor; regra + ocorrência.

Documentar dicionário de campos, nulabilidade, precisão, índices e restrições em migrations versionadas. O modelo acima é lógico; o esquema físico deve ser revisado antes de codificar.

## 20. Arquitetura recomendada

Começar com **monólito modular**, API e workers compartilhando módulos de domínio. Isso reduz custo operacional e permite transações financeiras consistentes. Separar serviços só quando houver necessidade comprovada.

Opção de referência, sujeita à experiência da equipe: frontend React/Next.js com TypeScript; backend TypeScript organizado em módulos; PostgreSQL gerenciado; armazenamento privado compatível com S3; fila durável para jobs; serviço de e-mail; provedor de autenticação ou implementação consolidada. Não há necessidade de usar versões experimentais. A escolha de hospedagem e versões deve ser cotada e validada na implantação.

Módulos internos: identidade; empresas/permissões; cadastros; títulos; liquidação/razão; importação/conciliação; relatórios; notificações; assinatura; administração. O módulo financeiro expõe serviços de domínio; a interface não grava saldos diretamente.

Fluxo de escrita: navegador autenticado → API valida empresa/permissão → serviço valida regra → transação no banco → registro de outbox → worker envia notificações/atualiza projeções. Falha no envio de e-mail não deve desfazer pagamento já registrado.

RLS do PostgreSQL pode reforçar isolamento por linha. A documentação registra exceções para proprietários, superusuários e papéis BYPASSRLS [5]. Por isso, a aplicação não deve operar rotineiramente com papel que burla políticas. Testar acesso real com o mesmo papel de produção, além da autorização na API.

### Contratos de API de referência

| Operação | Contrato esperado |
|---|---|
| POST /companies/{id}/titles | Criação validada, idempotência e retorno do título |
| POST /titles/{id}/settlements | Principal/componentes, conta, data e versão |
| POST /settlements/{id}/reversals | Motivo obrigatório, autorização e período |
| POST /companies/{id}/transfers | Validação das duas contas e transação atômica |
| POST /companies/{id}/imports | Upload autorizado e job assíncrono |
| POST /reconciliations | Vínculos, valores e validação de disponibilidade |
| GET /companies/{id}/dashboard | Filtros validados, instante de referência e definições |
| POST /companies/{id}/exports | Snapshot autorizado e status de geração |
| POST /billing/webhooks/{provider} | Assinatura, deduplicação e processamento assíncrono |

Paginação e ordenação estáveis, limites de consulta, contratos documentados, erros de negócio legíveis e identificador de correlação. PATCH deve usar versão/ETag quando houver risco de perda de atualização. A empresa do caminho não é confiável até verificar associação ativa.

## 21. Integrações e cobrança da assinatura

Separar dois domínios: **você cobrando a assinatura do SaaS** e **seu assinante cobrando os clientes dele**. Contas, credenciais, webhooks e contabilidade não se misturam.

P0: um PSP para sua assinatura, selecionado após verificar recorrência, Pix/boleto quando necessários, cartão, retries, tarifas, antifraude, estornos e suporte. Não definir vários provedores antes de validar demanda. Checkout hospedado evita lidar diretamente com PAN/CVV.

Webhook é sinal externo que exige validação. Verificar assinatura sobre corpo original, identificador único, horário/replay quando suportado e correspondência com assinatura local. Processar duplicados e eventos fora de ordem; confirmar situação no provedor em transições críticas. A documentação de webhooks da Stripe é uma referência desse cuidado [6], sem implicar seleção comercial desse fornecedor.

Nunca liberar plano pago só porque o navegador voltou de uma tela “sucesso”. Job periódico compara cobranças locais e provedor; fila de falhas recebe revisão. Emails de cobrança não devem sair duplicados por reentrega do webhook.

Estados: trial, ativo, pagamento pendente, em carência, suspenso para escrita, cancelamento agendado e encerrado. Proposta comercial: trial de 14 dias sem cartão; carência operacional configurável, inicialmente 7 dias; cancelamento ao fim do ciclo; exportação acessível conforme política de retenção. Esses prazos são escolhas a validar contratualmente, não prazos legais afirmados.

Upgrade pode ser imediato com regra de proporcionalidade exibida. Downgrade no próximo ciclo, com prévia de limites excedidos. Não apagar dados para caber em plano menor. Exibir histórico de cobrança, recibos/faturas e caminho de cancelamento acessível.

Open Finance P2: integração por parceiro com arranjo adequado ao ecossistema regulado; consentimento, revogação, cobertura bancária, sincronização, custos e papéis de tratamento definidos. Não prometer conexão com todos os bancos. O Banco Central mantém regras e informações sobre participantes [4].

## 22. Segurança, privacidade e contratos

Segurança de dados financeiros faz parte do produto inicial. A LGPD define controlador/operador e disciplina tratamento e direitos dos titulares [3]. Mapear responsabilidades por finalidade: a empresa SaaS pode ser controladora dos dados de cadastro/cobrança e operadora de parte dos dados inseridos pelo assinante, conforme os contratos e a operação efetiva.

Checklist de engenharia: TLS; criptografia em repouso; segredos em cofre; rotação de chaves; MFA obrigatório para administradores internos e recomendado para proprietários; limitação de tentativas; sessões revogáveis; recuperação de conta robusta; proteção contra CSRF quando aplicável; validação de entrada; defesa contra XSS/injeção; dependências monitoradas; acesso de menor privilégio; ambientes separados.

Anexos privados, limites por arquivo, verificação de tipo real, análise de malware e URLs de curta duração. Não registrar CPF, senhas, tokens, documentos completos ou conteúdo financeiro desnecessário em logs. Exportações também são dados privados, com expiração e trilha de acesso.

Plano de privacidade: inventário de dados; finalidade/base aplicável por operação; política de retenção por classe; canal de direitos; identificação de subprocessadores; avaliação de transferências internacionais quando houver; contratos de tratamento; exportação e encerramento. Consentimento não é base automática para tudo. Revisão jurídica precisa considerar operação concreta e regras vigentes.

Documentos antes do lançamento: termos de uso; política de privacidade; contrato/DPA quando pertinente; política de cobrança e cancelamento; escopo de suporte; política de retenção e exclusão; procedimentos de incidente; lista de subprocessadores. Validar emissão fiscal das próprias assinaturas com contador e fornecedor, sem confundir com emissão fiscal para assinantes.

Incidente: detectar → conter → preservar evidência mínima → avaliar impacto → acionar responsável → avaliar comunicações cabíveis → restaurar → revisar causa. Confirmar os prazos regulatórios aplicáveis no momento, inclusive regras específicas para agentes de pequeno porte; não codificar um único prazo genérico sem essa análise. A ANPD possui regulamento específico de comunicação de incidentes [7].

Exclusão: aplicar política por finalidade e obrigação de retenção; bloquear acesso aos dados encerrados; apagar/anomimizar quando cabível; prever expiração de backups e reaplicação de exclusões após restauração. A promessa comercial deve explicar o que é retido e por quê.

## 23. Operação, disponibilidade e observabilidade

Metas iniciais de engenharia, sujeitas a validação por testes e infraestrutura: disponibilidade mensal de 99,9%; API interativa p95 abaixo de 500 ms nos endpoints simples; dashboard p95 abaixo de 2 s com até 100 mil movimentos por empresa; importação de 10 mil linhas em até 2 minutos no cenário de teste definido. Não anunciar SLA contratual antes de medir capacidade.

Backup: PostgreSQL com recuperação pontual, cópias protegidas, versionamento de objetos e restauração ensaiada. Metas propostas: RPO de até 15 minutos e RTO de até 4 horas, condicionadas ao serviço contratado e ensaio real. Backup diário isolado não atende RPO de 15 minutos.

Restaurar uma empresa em ambiente temporário antes de reintegrar dados: restaurar o banco inteiro indiscriminadamente pode desfazer movimentações de outros clientes. Definir reconciliação de dados após recuperação e preservar trilha de incidentes.

Monitorar: erros por endpoint; latência; falhas de autenticação; uso de banco; filas; jobs atrasados; recorrências não geradas; webhooks rejeitados; e-mails; divergências de saldos; exportações; custos por tenant. Não incluir conteúdo sensível nas métricas.

Deploy: desenvolvimento, homologação e produção separados; dados sintéticos em testes; CI com testes de domínio e autorização; migrations compatíveis; backup/rollback planejados; feature flags; implantação gradual; smoke test após publicação. Rollback de aplicação não reverte automaticamente migrations ou eventos financeiros; usar plano específico.

Runbooks: indisponibilidade; restauração; falha de PSP; fila parada; vazamento; divergência financeira; importação problemática; chargeback; perda de acesso do proprietário. Definir responsáveis e canal de escalonamento.

## 24. Administração interna e suporte

Painel operacional: empresas, plano, estado da assinatura, uso, ativação, cobranças, tickets, falhas de importação e integrações. Dados financeiros do cliente ficam ocultos por padrão.

Ações controladas: reenviar convite; recuperar acesso após verificação; conceder extensão de trial com motivo; suspender abuso; ajustar plano; emitir exportação autorizada; reprocessar job idempotente. Mudanças manuais em cobrança e acessos geram auditoria e, quando necessário, aprovação separada.

Suporte inicial: horário comercial publicado, base de ajuda curta e contato dentro do app. Não vender suporte 24 horas sem cobertura real. Classificar incidente crítico de segurança/saldo, indisponibilidade, funcionalidade bloqueada e dúvida. Metas de resposta precisam refletir equipe contratada.

Base de ajuda mínima: começar; saldo inicial; importar; receber/pagar parcialmente; diferença entre caixa e competência; transferir; conciliar; corrigir lançamento; convidar contador; cancelar e exportar.

## 25. Planos e monetização

**Preços propostos para teste, não preços de concorrentes nem promessa de aceitação.** Cobrar por empresa, usuários adicionais e capacidades úteis. Evitar limites apertados de lançamentos que obriguem o cliente a deixar de registrar operações; adotar política de uso justo explícita.

| Plano | Mensal sugerido | Anual sugerido | Proposta de conteúdo |
|---|---:|---:|---|
| Essencial | R$ 59 | R$ 590 | 1 empresa, 2 usuários, 3 contas, núcleo P0, importação manual |
| Profissional | R$ 119 | R$ 1.190 | 1 empresa, 5 usuários, 10 contas, planejamento e projetos após P1 |
| Gestão | R$ 229 | R$ 2.290 | 1 empresa, 10 usuários, aprovações e controles avançados após P1 |

Anual equivale a pagar 10 mensalidades por 12 meses; desconto de aproximadamente 16,7%. Para MRR, dividir valor anual por 12, não contar o caixa antecipado inteiro como receita recorrente de um mês.

**Lançamento:** vender somente Essencial e, se fizer sentido, oferta de implantação. Publicar planos maiores apenas quando benefícios estiverem entregues; lista de espera não equivale a recurso disponível. Contador convidado pode ter assento de leitura/exportação sem custo adicional, como incentivo de distribuição.

Implantação opcional sugerida: R$ 297 a R$ 997 conforme volume e qualidade dos dados, com escopo escrito, limite de revisões e aceite da migração. Oferecer configuração de categorias, saldo inicial, importação e treinamento. Medir horas de trabalho para não transformar receita extra em prejuízo.

Adicionais futuros: empresa extra; mais usuários; pacote de mensagens; conexão bancária; implantação avançada; portal BPO. Mostrar custo previsível. APIs e IA com consumo variável exigem franquia/limite antes de oferecer “ilimitado”.

Evitar plano gratuito permanente no início se suporte e ativação forem assistidos. Trial e demonstração permitem testar valor sem sustentar indefinidamente empresas sem receita.

## 26. Economia do negócio e cenários

As contas abaixo são simulações gerenciais para decidir viabilidade, não projeções garantidas nem orçamento cotado. Não incorporam desenvolvimento, financiamento ou todos os efeitos tributários.

### Modelo por assinatura

Hipótese ilustrativa: ticket médio mensal reconhecido de R$ 99; 12% da receita reservados conjuntamente para tributos, processamento e perdas, sem representar alíquota legal; R$ 18 por cliente/mês para consumo técnico e suporte variável. Margem de contribuição = 99 × 0,88 − 18 = **R$ 69,12 por cliente/mês**.

Custos fixos ilustrativos de R$ 6.000/mês para operação enxuta geram equilíbrio operacional em ceil(6.000 ÷ 69,12) = **87 clientes**. Se o custo fixo real for R$ 20.000, seriam **290 clientes**, mantidas as mesmas hipóteses. Essas despesas fixas devem incluir remuneração de quem opera; trabalho do fundador não é economicamente gratuito.

| Clientes pagantes | MRR a R$ 99 | Contribuição a R$ 69,12 | Saldo após R$ 6.000 fixos |
|---:|---:|---:|---:|
| 50 | R$ 4.950 | R$ 3.456 | −R$ 2.544 |
| 100 | R$ 9.900 | R$ 6.912 | R$ 912 |
| 300 | R$ 29.700 | R$ 20.736 | R$ 14.736 |
| 500 | R$ 49.500 | R$ 34.560 | R$ 28.560 |

O custo fixo provavelmente cresce com base, suporte e desenvolvimento. O último campo não representa lucro líquido: exclui aquisição incremental, investimento inicial e outros custos que não estiverem nos R$ 6.000.

Exemplo de aquisição: CAC de R$ 250 e contribuição de R$ 69,12 dão payback de aproximadamente 3,6 meses. Com churn mensal hipotético de 4%, LTV simplificado de contribuição seria 69,12 ÷ 0,04 = R$ 1.728 e LTV/CAC ≈ 6,9. Com churn de 8%, LTV cai para R$ 864. Essa fórmula pressupõe taxas estáveis e não substitui análise de coortes; evitar utilizá-la como promessa com poucos clientes.

### Orçamento para construir

Modelo de esforço proposto: 750 a 1.150 horas totais para descoberta, UX, backend/frontend, integrações, QA, segurança, operação e piloto do P0 descrito. É estimativa preliminar; conciliação, migração e razão financeiro são os principais riscos de expansão.

Exemplo aritmético com custo médio hipotético de R$ 100/h: R$ 75.000 a R$ 115.000; com reserva de 20%: R$ 90.000 a R$ 138.000. Não é pesquisa de preço nem recomendação de contratar por esse valor. Fundador técnico pode reduzir desembolso, mas precisa contabilizar tempo e manutenção. Obter propostas comparáveis usando este escopo e critérios de aceite.

Orçamento operacional deve separar: banco e backup, aplicação/workers, arquivos, e-mail, observabilidade, domínio, PSP, suporte, jurídico/contabilidade, marketing, integrações e manutenção. Registrar custos fixos e variáveis para não contá-los duas vezes. Validar por cotação antes de escolher infraestrutura.

## 27. Comercialização e aquisição

Proposta de lançamento: nicho único, primeiras vendas conduzidas pelo fundador e implantação próxima. “Serve para qualquer empresa” dificulta mensagem, suporte e desenvolvimento.

### Oferta inicial

“Organizamos suas contas e mostramos o caixa das próximas semanas em um painel simples.” Demonstrar com cenário sintético do segmento; não prometer aumento de lucro ou economia sem medir. Oferta inclui assinatura, escopo de implantação opcional e cancelamento transparente.

### Primeiros 30 clientes

Selecionar cerca de 60 empresas do nicho como lista de trabalho, sem pressupor conversão. Conduzir entrevistas e demonstrações individuais, registrar motivos de perda, fechar 5 pilotos e expandir por indicação e casos reais autorizados. A lista pode vir da rede profissional e parceiros; respeitar contexto e preferências de contato.

Roteiro de demonstração: problema atual → contas da próxima semana → saldo projetado → importação/conciliação → fechamento → proposta → próximo passo. Mostrar o produto com dados que o cliente reconhece, sem expor dados de terceiros.

Canal de contadores/BPO: validar parceria com poucos escritórios, acesso delegado, indicação rastreável, contrato e comissão viável. Portal multicliente somente depois de confirmar demanda. Não oferecer marca branca antes de ter operação estável.

Site: público e promessa claros, capturas reais, benefícios, preço, demonstração, FAQ, segurança explicada, contato e termos. Depoimentos só com autorização; nenhuma métrica fabricada. Conteúdo de aquisição: caixa versus lucro, fechamento, vencimentos e migração de planilha.

Mídia paga: iniciar com orçamento experimental limitado somente após medir ativação e conversão. Comparar CAC por canal, retenção e suporte gerado, não apenas custo por cadastro.

## 28. Métricas de produto, receita e operação

| Métrica | Definição recomendada |
|---|---|
| MRR | Receita recorrente mensal normalizada, sem implantação e sem trial |
| ARR | MRR × 12; convenção de run rate, não receita já recebida |
| Ticket médio/ARPA | MRR ÷ empresas pagantes, na mesma data |
| Churn de clientes | Cancelados no mês ÷ pagantes no início do mês |
| Churn de receita | MRR perdido da base inicial ÷ MRR inicial |
| NRR | (MRR inicial + expansão − contração − cancelamentos) ÷ MRR inicial |
| CAC | Custo atribuível de aquisição ÷ novos clientes pagantes |
| Conversão do trial | Trials convertidos ÷ trials elegíveis da mesma coorte |
| Ativação | Empresas que concluíram critérios de valor ÷ cadastros elegíveis |
| Retenção de uso | Empresas da coorte que executam rotina relevante após 30/60/90 dias |
| Tempo até valor | Tempo entre cadastro e primeiro dashboard com dados válidos |
| Custo de servir | Infra variável + APIs + suporte atribuível por cliente |
| Confiabilidade | Erros, atrasos de jobs, incidentes e divergências confirmadas |

Eventos de produto: onboarding iniciado/concluído; conta criada; importação concluída; baixa registrada; conciliação concluída; relatório exportado; convite aceito; trial convertido; cancelamento e motivo. Analytics recebe identificadores mínimos e metadados, não valores pessoais desnecessários ou documentos financeiros completos.

Metas internas iniciais para discussão: pelo menos 60% dos pilotos ativados em 7 dias; 80% dos pilotos ativos realizando rotina semanal até a quarta semana; zero divergência financeira confirmada sem solução antes de expandir. Amostra pequena exige análise qualitativa junto aos percentuais.

## 29. Backlog inicial com critérios de aceite

| ID | História | Prioridade | Critério mínimo |
|---|---|---|---|
| FIN-001 | Como proprietário, criar empresa e acessar dados isolados | P0 | Outra empresa não acessa por UI, API, exportação ou anexo |
| FIN-002 | Como operador, cadastrar conta e saldo inicial | P0 | Saldo inicial não entra como receita |
| FIN-003 | Como operador, organizar categorias/subcategorias | P0 | Desativação preserva histórico e não cria órfãos |
| FIN-004 | Como operador, criar título de entrada/saída | P0 | Datas e valores validados, duplicação de requisição tratada |
| FIN-005 | Como operador, registrar baixa parcial | P0 | Principal residual e dinheiro movimentado corretos |
| FIN-006 | Como administrador, corrigir baixa | P0 | Estorno com motivo e trilha, sem apagar evento original |
| FIN-007 | Como gestor, transferir entre contas | P0 | Consolidado não muda, duas pontas atômicas |
| FIN-008 | Como operador, parcelar e repetir títulos | P0 | Centavos fecham; execução repetida não duplica ocorrência |
| FIN-009 | Como operador, importar extrato | P0 | Prévia, validação, deduplicação e rastreio por linha |
| FIN-010 | Como operador, conciliar pagamentos | P0 | Vincular registro existente não muda caixa |
| FIN-011 | Como gestor, visualizar dashboard | P0 | Cada card reconcilia com detalhe sob mesmos filtros |
| FIN-012 | Como contador, exportar relatório | P0 | Mesma base e total da UI; permissão verificada no download |
| FIN-013 | Como gestor, fechar mês | P0 | Período bloqueado; reabertura exige autorização |
| FIN-014 | Como proprietário, convidar/revogar acesso | P0 | Revogação impede acesso subsequente e exportações novas |
| FIN-015 | Como assinante, contratar e cancelar plano | P0 | Webhook confiável; cancelamento não apaga histórico |
| FIN-016 | Como suporte, diagnosticar falha | P0 | Logs suficientes sem exposição indevida dos dados |
| FIN-017 | Como gestor, orçar despesas | P1 | Comparação usa categoria/período/regime compatíveis |
| FIN-018 | Como gestor, controlar cartão | P1 | Pagamento de fatura não duplica despesa |
| FIN-019 | Como gestor, aprovar saída | P1 | Autor não aprova quando regra de segregação exigir |
| FIN-020 | Como cliente, conectar banco | P2 | Consentimento/revogação, cobertura e falhas observáveis |

Cada história deve receber refinamento, responsável, dependências, desenho, casos de erro e evidência de teste antes de ser concluída. Frontend visualmente pronto não representa história finalizada se persistência/permissões não estiverem verificadas.

## 30. Cenários de teste indispensáveis

| Caso | Resultado esperado |
|---|---|
| Saldo inicial R$ 1.000; recebe R$ 500; paga R$ 200 | Saldo R$ 1.300; receita de caixa R$ 500 |
| Transferir R$ 300 da conta A para B | A −300, B +300, consolidado inalterado |
| Transferência com tarifa R$ 5 | Consolidado cai R$ 5, classificados como tarifa |
| Título R$ 1.000; principal quitado R$ 400 | Saldo aberto R$ 600 |
| Principal R$ 400 quitado, tarifa retida R$ 8 | Banco +R$ 392; tarifa R$ 8; principal liquidado R$ 400 |
| Título R$ 100; desconto R$ 10; dinheiro R$ 90 | Principal totalmente liquidado, caixa +R$ 90 |
| Despesa de janeiro paga em fevereiro | DRE janeiro; caixa fevereiro |
| Parcela R$ 100 em 3 | Soma exata R$ 100 |
| Recorrência dia 31 em fevereiro | Último dia de fevereiro, inclusive ano bissexto |
| Importar extrato duas vezes | Sem duplicação de linhas efetivas/movimentos |
| Conciliar lançamento já pago | Sem segundo pagamento |
| Webhook duplicado e fora de ordem | Estado final correto, sem duplicar assinatura/benefício |
| Duas baixas concorrentes acima do saldo | Uma operação é rejeitada/ajustada por regra explícita |
| Estorno em período fechado | Bloqueio ou procedimento de ajuste/reabertura autorizado |
| Cliente A tenta ID/anexo/exportação de B | Acesso negado em todas as rotas |
| Filtro com conta sem permissão | Conta e totais protegidos, sem inferência em agregados |
| Queda de worker após commit | Reprocessamento recupera sem duplicar |
| Base de comparação igual a zero | “Sem base comparável” |
| Pagamento de fatura já reconhecida | Redução de banco e passivo, sem nova despesa |
| Restauração de backup | Acesso, saldos, anexos e integridade conferidos |

Estratégia: testes unitários do domínio; testes de integração com banco real; testes de autorização e isolamento; E2E dos fluxos principais; testes de carga do cenário declarado; restauração; revisão de segurança. Usar invariantes como “débitos = créditos”, “transferência interna conserva consolidado” e “somatório de parcelas = total”.

## 31. Cronograma e equipe

Proposta de **16 a 20 semanas** para P0 e piloto, assumindo duas pessoas com capacidade de engenharia full stack e apoio parcial de design, QA, segurança e contabilidade. Não é compromisso de entrega; descoberta, integrações e qualidade da migração podem alterar o prazo. Uma pessoa trabalhando parcialmente deve recalcular o calendário.

| Etapa | Janela sugerida | Saída e gate |
|---|---|---|
| Descoberta | Semanas 1–2 | Entrevistas, nicho, pilotos e escopo validado |
| Fluxos e especificação técnica | Semanas 3–4 | Protótipo navegável, regras, modelo e plano de testes |
| Fundação e núcleo financeiro | Semanas 5–8 | Autenticação, isolamento, contas, títulos, baixas e razão |
| Rotina operacional | Semanas 9–11 | Importação, conciliação, recorrência e auditoria |
| Relatórios e comercial | Semanas 12–14 | Dashboard, relatórios, cobrança, administração e exportação |
| Endurecimento e piloto | Semanas 15–17 | Testes, restauração, revisão de segurança e pilotos pagos |
| Correções e lançamento controlado | Semanas 18–20 | Problemas críticos resolvidos, onboarding e suporte preparados |

Responsáveis: fundador decide público/oferta e acompanha pilotos; engenharia responde por integridade e entrega; design valida fluxos; QA verifica casos; especialista financeiro/contador revisa regras e relatórios; jurídico revisa contratos e privacidade. Uma pessoa pode acumular papéis, mas cada responsabilidade precisa existir.

## 32. Checklist de lançamento e critérios de avanço

Produto: cadastro e onboarding completos; núcleo P0 funcional; dados demonstrativos separados; saldos e relatórios validados com casos conhecidos; exportação; cancelamento; permissões; documentação das limitações.

Segurança/operação: isolamento testado; MFA administrativo; segredos protegidos; anexos privados; backup restaurado; monitoramento/alertas; responsáveis por incidentes; revisão de dependências; procedimento de recuperação de conta.

Comercial: preço e escopo publicados; benefícios realmente disponíveis; checkout/webhooks testados; nota/recibo conforme fluxo definido; termos e privacidade revisados; canal de suporte; implantação com limites.

Piloto: 5–10 empresas com rotinas reais; conferência independente de saldo inicial/final; pelo menos um fechamento mensal; coleta de dificuldades; clientes capazes de operar sem intervenção diária do fundador.

**Não expandir aquisição enquanto existir:** divergência financeira sem causa; vazamento entre empresas; baixa duplicada; restauração não verificada; cobrança indevida recorrente; cancelamento inacessível; dependência de edição manual no banco para rotina normal.

Avançar para P1 quando uso, retenção e suporte indicarem valor sustentado. Priorizar o recurso que remove o maior motivo de não compra/cancelamento comprovado, ponderando custo e margem.

## 33. Riscos e respostas

| Risco | Sinal precoce | Resposta |
|---|---|---|
| Produto genérico sem demanda | Elogios sem compromisso de pagamento | Nicho e piloto pago |
| Escopo excessivo | ERP, fiscal e IA antes de saldos confiáveis | Gates P0/P1/P2 |
| Divergência financeira | Ajustes manuais frequentes | Razão, invariantes, reconciliação e testes |
| Migração difícil | Cliente abandona importação | Prévia, templates e implantação assistida |
| Suporte inviável | Muitas horas por assinatura | Medir custo e simplificar fluxo |
| Churn após primeiro mês | Cliente não retorna nem fecha mês | Investigar ativação e rotina real |
| Vazamento entre empresas | Falhas em ID, exportação ou storage | Defesa em camadas e testes de isolamento |
| Dependência de fornecedor | Falha de PSP/API interrompe uso | Filas, degradação clara e reconciliação |
| Margem corroída por APIs | Consumo desproporcional ao plano | Franquias, limites e custo por tenant |
| Venda de roadmap | Cliente cobra recurso inexistente | Separar disponível, piloto e planejado |
| Produto vira serviço sob medida | Exceções exclusivas por cliente | Configuração reutilizável e critério de priorização |

## 34. Decisões pendentes e próximos passos

Decisões que ainda precisam de validação: nicho específico; responsáveis pela construção; orçamento e disponibilidade; preço aceito; volume de dados dos pilotos; meios de cobrança necessários; expectativa de importação; necessidade imediata de cartões; papel dos contadores; política de suporte; hospedagem e subprocessadores.

Essas decisões não impedem usar este documento para entrevistar clientes e comparar propostas. A orientação provisória é: empresas de serviços, uma empresa por assinatura, BRL, lançamento manual/importação, plano Essencial, implantação opcional e piloto controlado.

Próximos 10 dias úteis: escolher um nicho; selecionar entrevistados; observar rotinas; reunir modelos anonimizados de planilhas/extratos; validar interesse pago; desenhar dashboard e fluxo de baixa/importação; revisar regras com contador; estimar desenvolvimento por entregas; selecionar 5 pilotos; fechar backlog do P0.

Para contratar desenvolvimento, exigir: repositório e infraestrutura sob seu controle; código e propriedade intelectual definidos em contrato; documentação; migrations; testes; ambiente de homologação; inventário de fornecedores; transferência de conhecimento; marcos de pagamento vinculados a entregas aceitas. Não aprovar somente por capturas de tela.

## 35. Referências e limite das evidências

Consultas realizadas em 25/09/2026. Funcionalidades concorrentes e normas podem mudar. As fontes abaixo embasam apenas as afirmações correspondentes; posicionamento, arquitetura proposta, preços, custos, cronograma e metas deste projeto são decisões/hipóteses de planejamento.

1. Conta Azul — gestão financeira: https://contaazul.com/funcionalidades/gestao-financeira/
2. Omie — funcionalidades: https://www.omie.com.br/funcionalidades
3. Planalto — Lei nº 13.709/2018 (LGPD): https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
4. Banco Central — participantes do Open Finance: https://www.bcb.gov.br/estabilidadefinanceira/openfinance_participantes
5. PostgreSQL — Row Security Policies: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
6. Stripe — Webhooks: https://docs.stripe.com/webhooks
7. ANPD — anúncio do Regulamento de Comunicação de Incidente de Segurança: https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-aprova-o-regulamento-de-comunicacao-de-incidente-de-seguranca

**Resultado esperado da execução do projeto:** um SaaS que registre o dinheiro corretamente, ajude o gestor a agir sobre seu caixa e possua operação comercial mensurável. Receita dependerá da aquisição, ativação, retenção e margem obtidas na prática.
