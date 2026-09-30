# Design QA — Login do AX Finance

final result: passed

## Evidência

- Fonte visual: `C:\Users\Sergio Oliveira\Desktop\ax-finance-login\qa\reference.png`.
- Implementação: `http://127.0.0.1:3000/login`, captura renderizada no Codex In-app Browser (evidência inline da execução; o navegador não expôs um caminho de arquivo local para a captura).
- Viewport desktop: 1672 × 941 CSS px, captura 1672 × 941 px, densidade 1x.
- Viewport mobile: 390 × 844 CSS px, densidade 1x; página com 390 px de `scrollWidth`, sem overflow horizontal.
- Estado: login inicial, campos vazios, sem sessão.

## Comparação visual

- Composição: card de aproximadamente 1300 × 760 px, divisão quase 1:1, painel azul curvo e painel de formulário preservados.
- Tipografia: Manrope local nos pesos 400–800; hierarquia, quebras e pesos correspondem à referência.
- Espaçamento: margens externas, padding dos painéis, altura dos campos, posição do CTA e rodapé conferidos no mesmo viewport da fonte.
- Cores: azul de marca, marinho, superfícies claras, bordas e fundo externo reproduzidos pelos tokens locais da tela.
- Imagem: o asset `login-welcome.webp` da referência foi usado diretamente, sem aproximação em CSS.
- Ícones: Phosphor, como no protótipo selecionado.
- Conteúdo: textos visíveis da referência preservados.

## Responsividade

- Em 390 × 844, a interface vira uma coluna, mantém o painel ilustrado completo, preserva todos os controles e usa scroll vertical normal.
- Nenhum elemento provoca rolagem horizontal (`scrollWidth` e largura interna iguais a 390 px).
- O formulário e o CTA permanecem legíveis no primeiro fluxo de rolagem.

## Interações verificadas

- Exibir/ocultar senha alterna o input entre `password` e `text`.
- “Criar minha conta” aponta para `/registro`.
- Recuperação de acesso abre e fecha um diálogo acessível e informa honestamente que o backend de recuperação ainda não existe.
- Privacidade e termos abrem e fecham seus diálogos.
- Formulário principal permanece conectado à Server Action real de login.
- “Lembrar de mim” controla se o cookie recebe expiração persistente ou dura somente durante a sessão do navegador.
- Uma aba nova e limpa não apresentou erros nem avisos no console.

## Histórico da comparação

1. Primeiro passe desktop: nenhuma diferença P0/P1/P2 encontrada. Pequenas variações subpixel de antialiasing são P3 e aceitáveis.
2. Passe mobile: nenhum corte ou overflow encontrado; não foi necessária correção visual adicional.

## Verificação técnica

- `pnpm --filter web exec tsc --noEmit`: passou.
- `git diff --check`: passou.
- A compilação de produção chegou a `Compiled successfully`; o empacotamento final não foi repetido porque já havia um processo Next em execução usando o mesmo diretório `.next`.

## Resultado

Não restaram diferenças visuais P0, P1 ou P2. A implementação está aprovada para entrega.

---

# Design QA — Sidebar recolhível e pesquisa expansível

final result: passed

## Evidência

- Fonte visual: `C:\Users\SERGIO~1\AppData\Local\Temp\codex-clipboard-4fc6583b-86b4-438b-b182-36e9d3d6d08a.png`.
- Implementação: `http://127.0.0.1:3100/dashboard`, capturada no Codex In-app Browser; a captura permanece disponível na aba de prévia entregue.
- Viewports: 1280 × 720 e 720 × 360 CSS px.
- Estado: sidebar recolhido; pesquisa aberta vazia e preenchida; dropdown sem resultados; preferência do sidebar após reload.

## Comparação visual

| Aspecto | Referência | Implementação | Resultado |
| --- | --- | --- | --- |
| Alinhamento vertical no topbar | Lupa, sino e avatar no mesmo eixo | Controles com caixas de 40 px e avatar de 36 px, todos centralizados em uma linha de 40 px | Aprovado |
| Pesquisa | Ícone de lupa compacto | Campo branco em cápsula, expansão para a esquerda, foco automático, placeholder e fechamento | Aprovado |
| Sidebar recolhido | Ícones devem alinhar com o avatar do perfil | Trilho de 72 px; navegação, avatar e saída compartilham o mesmo eixo central | Aprovado |
| Responsividade | Barra desktop compacta | Campo limitado a 320 px e a `calc(100vw - 9rem)` em telas menores | Aprovado |

## Interações verificadas

- Abrir a pesquisa pelo mouse e receber foco no campo.
- Digitar uma consulta e exibir o estado de carregamento/resultado.
- Fechar e limpar a pesquisa pelo botão ou pela tecla Escape.
- Recolher e expandir o sidebar.
- Persistir o sidebar recolhido após recarregar a página.
- Manter nomes acessíveis e foco de teclado nos controles.

## Pendências por severidade

- P0: nenhuma.
- P1: nenhuma.
- P2: nenhuma.
- P3: nenhuma relevante para este recorte.

## Verificação técnica

- `pnpm build`: passou.
- `pnpm typecheck`: passou.
- `pnpm test`: 37 arquivos e 169 testes aprovados.
- `git diff --check`: passou.

---

# Design QA — Gráfico de fluxo realizado versus previsto

final result: passed

## Evidência

- Fonte visual: `C:\Users\SERGIO~1\AppData\Local\Temp\codex-clipboard-fccf1380-9e04-43e2-9267-8e182a2b02fe.png`.
- Fonte: 1090 × 422 px, densidade 1×, mostrando o estado anterior do card.
- Implementação: `http://127.0.0.1:3100/dashboard`, captura inline da aba 1 do Codex In-app Browser (a superfície não expõe um caminho de arquivo para a captura).
- Viewport desktop: 1918 × 916 CSS px, densidade 1×; região do card avaliada em aproximadamente 1052 × 447 px.
- Viewport compacto: 560 × 760 CSS px, sidebar recolhido.
- Estado: setembro de 2026, todas as contas/categorias/pessoas/centros de custo, séries com valores e tooltip ativo.

## Comparação de visão completa

- A composição do card, o título e o texto explicativo foram preservados.
- As séries agora usam interpolação monotônica no eixo temporal, com pontas e junções arredondadas, mantendo picos contidos entre os pontos reais.
- Recebimentos e pagamentos ganharam famílias cromáticas próprias; realizado usa tom mais escuro e traço mais espesso, previsto usa tom mais claro e tracejado.
- A legenda deixou de ser uma sequência de quatro rótulos equivalentes e passou a dois grupos semânticos, cada um com amostra real do tipo de traço.
- O tooltip exibe data, cor, nome completo e valor com alinhamento tabular.

## Comparação focada

O recorte do gráfico foi inspecionado em desktop e mobile porque curva, legenda e tooltip exigem leitura em detalhe. No desktop os dois grupos permanecem centralizados e equilibrados; em 560 px passam para duas linhas, sem truncamento ou sobreposição.

## Superfícies de fidelidade

- Tipografia: Manrope do produto preservada; legenda usa pesos 750/550, títulos de grupo mais fortes e rótulos secundários em cinza de alto contraste.
- Espaçamento: separador superior, padding de 12 px e gaps regulares distinguem gráfico e legenda sem aumentar excessivamente o card.
- Cores: verdes identificam recebimentos e rosas identificam pagamentos; variação de luminosidade e tipo de traço diferencia realizado de previsto sem depender apenas da cor.
- Imagens/ativos: não há ativos raster ou ilustrações neste componente; o gráfico continua vetorial pelo Recharts.
- Conteúdo: título e explicação originais foram mantidos; os rótulos foram simplificados apenas dentro dos grupos da legenda.

## Histórico da comparação

1. Estado anterior: curvas visualmente duras em séries esparsas e legenda com quatro marcadores circulares, sem representar sólido versus tracejado.
2. Primeiro passe: aplicado `monotoneX`, hierarquia de espessura, paleta diferenciada, legenda agrupada e tooltip editorial.
3. Pós-fix desktop: curvas suaves, tooltip legível e grupos equilibrados; nenhuma diferença P0/P1/P2 restante.
4. Pós-fix mobile: legenda refluída para duas linhas e eixo reduzido automaticamente; nenhuma sobreposição ou rolagem horizontal causada pelo componente.

## Findings

- P0: nenhuma.
- P1: nenhuma.
- P2: nenhuma.
- P3: o eixo X pode exibir menos datas em telas estreitas, comportamento esperado para manter a legibilidade.

## Interações e acessibilidade verificadas

- Tooltip responde ao hover e mantém os quatro valores no mesmo contexto temporal.
- Legenda possui nome acessível “Legenda do fluxo financeiro”.
- Cor não é o único diferenciador: realizado é sólido e previsto é tracejado.
- Console do navegador sem erros ou avisos.

## Verificação técnica

- `pnpm build`: passou.
- `pnpm typecheck`: passou.
- `pnpm test`: 37 arquivos e 169 testes aprovados.
- `git diff --check`: passou.

---

# Design QA — Central de filtros do dashboard

final result: passed

## Evidência

- Estado anterior: `C:\Users\SERGIO~1\AppData\Local\Temp\codex-clipboard-8bf1fb67-e6a9-434a-a1a2-cd3c7d45d6e0.png`.
- Implementação: `http://127.0.0.1:3100/dashboard`, inspecionada no Codex In-app Browser.
- Viewports avaliados: 1918 × 916, 1280 × 720, 900 × 760 e 560 × 760 CSS px.
- Estados avaliados: sidebar aberto e recolhido, seletor de período aberto, modal de nova receita e filtros sem seleção.

## Auditoria do estado anterior

1. A faixa superior separava período e ações dos filtros que alteram os mesmos indicadores.
2. O espaço vazio entre os controles e o card reduzia a relação visual entre seleção e resultado.
3. Os botões de receita e despesa tinham peso de cards independentes, competindo com os indicadores financeiros.
4. A leitura funcional estava dividida em duas regiões: primeiro período/ações e depois segmentação analítica.

## Resultado implementado

- Período, segmentação e ações financeiras agora formam um único painel de comando.
- Em telas largas, título, período e ações ocupam a mesma linha.
- Em larguras intermediárias, o período desce como um grupo completo dentro do mesmo painel, sem colisões.
- Em 560 px, ações, período e filtros refluem para uma coluna sem overflow horizontal (`scrollWidth` igual a 560 px).
- Botões rápidos ficaram mais compactos e mantêm distinção semântica por cor.
- O dashboard inicia mais próximo do topo, removendo a faixa vazia anterior.

## Interações e acessibilidade verificadas

- Seletor de período abre com atalhos, mês, intervalo personalizado e comparação.
- Modal de nova receita abre e mantém título, campos e controle de fechamento acessíveis.
- Ordem de leitura apresenta contexto, período, ações e segmentação antes dos indicadores.
- Rótulos de período, filtros e grupo de ações permanecem expostos à árvore de acessibilidade.
- A auditoria visual não substitui testes completos com leitor de tela.

## Verificação técnica

- `pnpm build`: passou.
- `pnpm typecheck`: passou.
- `pnpm test`: 37 arquivos e 169 testes aprovados.
- `git diff --check`: passou.

---

# Design QA — Controle de recolhimento do sidebar

final result: passed

## Evidência

- Fonte visual: `C:\Users\SERGIO~1\AppData\Local\Temp\codex-clipboard-8f488e92-0769-46be-8aed-567785771556.png`.
- Fonte: 464 × 198 px, densidade 1×, mostrando o espaço vazio criado pela linha exclusiva do controle.
- Implementação: `http://127.0.0.1:3100/dashboard`, captura inline no Codex In-app Browser (a superfície não expõe caminho local para a captura).
- Viewport e captura da implementação: 1438 × 894 CSS px, densidade 1×.
- Estados avaliados: sidebar aberto e recolhido, dashboard rolado ao topo e persistência da preferência existente.

## Comparação de visão completa

- A faixa vazia acima do Dashboard foi removida; o item ativo agora começa no primeiro alinhamento vertical útil do sidebar.
- No estado aberto, o controle ocupa o mesmo eixo horizontal do Dashboard e fica separado do alvo de navegação.
- No estado recolhido, o controle vira uma alça compacta na borda direita, sem deslocar nem cobrir o ícone do Dashboard.
- A largura do conteúdo principal acompanha os dois estados sem salto, corte ou sobreposição com o painel de filtros.

## Comparação focada

O topo do sidebar foi inspecionado em ambos os estados porque esta é a região afetada. O alinhamento do Dashboard, o alvo do botão e a divisória lateral permaneceram legíveis; não foi necessário um segundo recorte do restante da página.

## Superfícies de fidelidade

- Tipografia: família, tamanho e peso dos itens de navegação foram preservados.
- Espaçamento: removidos a margem inferior e o bloco exclusivo do controle; o primeiro item agora respeita apenas o padding normal do sidebar.
- Cores: superfícies, bordas, estado ativo e cores de ícones permanecem nos tokens existentes.
- Imagens/ativos: não há ativos raster neste recorte; os ícones animados existentes foram reutilizados.
- Conteúdo: nomes, ordem e destinos de navegação não foram alterados.

## Histórico da comparação

1. Estado anterior: botão isolado em uma linha própria, gerando espaço vazio antes do Dashboard.
2. Primeiro passe: Dashboard promovido a primeira linha útil e controle reposicionado no mesmo eixo.
3. Pós-fix aberto: Dashboard no topo, controle independente e sem sobreposição.
4. Pós-fix recolhido: ícones centralizados e alça de expansão acessível na borda; nenhuma diferença P0/P1/P2 restante.

## Findings

- P0: nenhuma.
- P1: nenhuma.
- P2: nenhuma.
- P3: nenhuma relevante para este recorte.

## Interações e acessibilidade verificadas

- Recolher e expandir o sidebar pelo novo posicionamento.
- Nomes acessíveis, `aria-expanded` e vínculo com a navegação preservados.
- Dashboard continua sendo um link independente do controle.
- Console do navegador sem erros ou avisos.

## Verificação técnica

- `pnpm --filter web exec tsc --noEmit`: passou.
- `pnpm test`: 37 arquivos e 169 testes aprovados.
- `git diff --check`: passou.

---

# Design QA — Site comercial e plano Gestão Pessoal

final result: passed

## Evidência

- Direção visual selecionada: `docs/design-audit-personal-site/selected-option-1.png` (1024 × 1536 px).
- Estado anterior: `docs/design-audit-personal-site/01-home-before.png`, `02-pricing-before.png` e `03-mobile-before.png`.
- Primeiro passe implementado: `docs/design-audit-personal-site/04-implementation-pass1.png`.
- Comparação lado a lado: `docs/design-audit-personal-site/06-side-by-side-comparison.png`.
- Hero final após os ajustes de fidelidade: `docs/design-audit-personal-site/07-final-hero.png`.
- Implementação final: `http://127.0.0.1:3100/`, validada no Codex In-app Browser.
- Viewports avaliados: 1440 × 1024 e 390 × 844 CSS px, densidade 1×.
- Estado: visitante sem sessão, com CTAs públicos de avaliação e demonstração.

## Comparação visual

- Composição: hero editorial com proposta de valor à esquerda e prévia real do dashboard à direita, seguido por benefícios, comparação de planos, demonstração, FAQ e CTA final.
- Tipografia: hierarquia forte em marinho, com título em três linhas no desktop e quatro linhas legíveis no mobile.
- Produto: a prévia usa componentes e gráfico vetorial reais; não há mockup achatado nem gráficos simulados com blocos genéricos.
- Cores: superfícies brancas e azul muito claro, azul de marca, cards financeiros em turquesa, rosa e azul e uma faixa de demonstração em marinho.
- Planos: Gestão Pessoal e Essencial têm paridade visual, exclusões explícitas, preços legíveis e o Essencial recebe ênfase sem esconder a opção de R$ 29,90.
- Espaçamento: seções têm ritmo amplo no desktop e refluem para uma coluna contínua no mobile, sem cortes ou rolagem horizontal.

## Histórico da comparação

1. Estado anterior: página funcional, porém com pouca prova visual do produto, hierarquia comercial genérica e comparação de planos menos escaneável.
2. Primeiro passe: aplicada a direção selecionada com hero, dashboard demonstrativo, benefícios e cards de preço redesenhados.
3. P1 identificado: o CTA claro da faixa de demonstração herdava o gradiente azul e perdia contraste. Corrigido para fundo branco e texto azul.
4. P2 identificado: o título principal quebrava em quatro linhas no desktop. Ajustada a escala responsiva para reproduzir as três linhas da referência.
5. Pós-fix desktop e mobile: nenhuma diferença P0/P1/P2 restante; variações P3 de conteúdo e comprimento da página são intencionais para preservar demonstração, FAQ e documentos comerciais já existentes.

## Interações e acessibilidade verificadas

- Navegação pública e CTAs apontam para os destinos esperados.
- Cada plano preserva seu parâmetro de cadastro (`PERSONAL` e `ESSENTIAL`).
- FAQ abre e revela a resposta por `details/summary` nativo.
- A prévia do dashboard possui nome acessível e conteúdo identificado como fictício.
- Os controles continuam visíveis e legíveis em 390 px.
- Console do navegador sem erros.

## Verificação técnica

- `pnpm typecheck`: passou.
- `pnpm test`: 39 arquivos e 174 testes aprovados.
- `pnpm build`: passou, incluindo compilação, validação de tipos e geração de 55 páginas.
- `pnpm lint`: indisponível porque o repositório não possui arquivo de configuração do ESLint; não é uma regressão desta alteração.

## Resultado

Não restaram diferenças visuais P0, P1 ou P2. O site está aprovado para entrega.
