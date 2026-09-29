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
