---
name: AX Finance
description: Gestão financeira para quem não é do financeiro — mesa de trabalho clara, em claro e escuro.
colors:
  ink: "#1a1d23"
  ink-muted: "#5b6270"
  paper: "#f4f7fb"
  card: "#ffffff"
  hairline: "#d9dce1"
  field-border: "#858e9e"
  brand-blue: "#4680ff"
  brand-blue-text: "#2f63d6"
  action-blue: "#2e66db"
  action-blue-hover: "#2453b8"
  focus: "#2f63d6"
  nav-active-bg: "#eaf0ff"
  nav-active-text: "#2453b8"
  money-in: "#0a7a5d"
  money-out: "#b42d5f"
  warn: "#96600a"
  danger: "#a4302f"
  chart-1: "#3978db"
  chart-2: "#d58a25"
  chart-3: "#078f85"
  chart-4: "#c23d68"
  chart-5: "#7655d8"
  dark-ink: "#eef4ff"
  dark-ink-muted: "#aab6ca"
  dark-paper: "#0f1726"
  dark-card: "#182235"
  dark-hairline: "#34425a"
  dark-brand-blue: "#6f9cff"
  dark-brand-blue-text: "#8fb2ff"
  dark-focus: "#9fbcff"
  dark-money-in: "#3cc79b"
  dark-money-out: "#ff7aa8"
  dark-warn: "#ffc266"
typography:
  page-title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "clamp(1.4rem, 1.8vw, 1.8rem)"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  metric:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "clamp(1.22rem, 1.7vw, 1.62rem)"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.035em"
    fontFeature: "tnum"
  modal-title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
  metric-label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.76rem"
    fontWeight: 650
    letterSpacing: "0.015em"
  button:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.2
rounded:
  field: "6px"
  nav-item: "8px"
  button: "9px"
  control: "10px"
  surface: "12px"
  metric: "13px"
  card: "14px"
  pill: "999px"
spacing:
  workspace: "24px"
  field-gap: "1rem"
  card-padding: "1.75rem"
  metric-padding: "1rem 1.15rem"
components:
  button-neutral:
    backgroundColor: "{colors.card}"
    textColor: "#44403c"
    rounded: "{rounded.button}"
    padding: "0 0.875rem"
    height: "36px"
  button-neutral-hover:
    backgroundColor: "#fafaf9"
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.card}"
    rounded: "{rounded.button}"
    padding: "0 0.875rem"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.action-blue-hover}"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0.55rem 0.65rem"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-padding}"
  metric:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.metric}"
    padding: "{spacing.metric-padding}"
  nav-item-active:
    backgroundColor: "{colors.nav-active-bg}"
    textColor: "{colors.nav-active-text}"
    rounded: "{rounded.nav-item}"
    height: "40px"
  modal-icon:
    textColor: "{colors.brand-blue-text}"
    rounded: "{rounded.surface}"
    size: "40px"
---

# Design System: AX Finance

Documento de referência do sistema visual. Vale para mim (Claude), para o ChatGPT/Codex e para qualquer pessoa que mexa na interface. Os tokens do topo são a fonte da verdade; o texto explica onde e por que usar cada um. Fonte técnica: `apps/web/app/globals.css` (tokens `:root` e tema escuro), `apps/web/app/(app)/workspace.css` (camada da área logada) e `apps/web/app/login/login.module.css` (login e cadastro). Contexto de produto em `PRODUCT.md`.

## Overview

**Creative North Star: "A Mesa de Trabalho Organizada"**

O AX Finance é usado no computador do escritório, em sessões de lançar, conciliar, conferir e fechar o mês. A interface se comporta como uma mesa limpa: papel claro (ou ardósia no tema escuro), cartões brancos com borda fina, um único azul para ação e foco, e cor de dinheiro (verde, rosa, âmbar) só onde existe dinheiro entrando, saindo ou atrasado. Nada compete com o número.

A densidade é de ferramenta de trabalho, não de vitrine: tabelas legíveis, métricas com números tabulares, janelas com cabeçalho padronizado e rodapé de ações fixo. A marca aparece nos detalhes (o ícone em quadro azul-claro dos modais, o item ativo do menu, o botão principal), não em fundos decorativos. Banners grandes no topo foram rejeitados pelo usuário; avisos são cartões pequenos no canto inferior direito.

Os dois temas são de primeira classe. Toda cor nova precisa do par claro/escuro e de contraste WCAG 2.2 AA (4,5:1 para texto, 3:1 para borda de campo e ícone).

**Key Characteristics:**
- Fundo papel + cartões brancos com borda fina; profundidade quase toda tonal.
- Um azul de ação; cores de dinheiro reservadas a valores e status.
- Manrope em toda a área logada, com números tabulares nos valores.
- Cantos suaves e consistentes (6 a 14px); pílula só para selos e chips.
- Janelas com o mesmo esqueleto: ícone, título, contexto, fechar, rodapé fixo.

## Colors

Paleta fria e contida: tinta grafite sobre papel azulado, um azul de marca e três cores semânticas de dinheiro.

### Primary
- **Azul AX** (brand-blue): preenchimentos de marca, gráficos, tinta do ícone de modal e fundos com `color-mix` (9 a 24% sobre o card). Não serve para texto sobre branco (só 3,6:1).
- **Azul de Texto** (brand-blue-text): links, texto em azul, anel de foco (`--focus`). É a versão do Azul AX que passa 4,5:1.
- **Azul de Ação** (action-blue / action-blue-hover): fundo do botão principal (`.workspace-primary-action`, "Salvar" das janelas). Um por tela ou por janela.

### Neutral
- **Tinta Grafite** (ink): texto principal.
- **Tinta Suave** (ink-muted): subtítulos, rótulos de métrica, contexto de modal, texto de apoio.
- **Papel** (paper): fundo da página e da área de conteúdo.
- **Cartão** (card): cartões, tabelas, menu lateral, barra do topo, janelas.
- **Linha Fina** (hairline): bordas de cartão, divisórias de cabeçalho e rodapé de modal.
- **Borda de Campo** (field-border): contorno de input, select e textarea (3:1, WCAG 1.4.11).
- **Item Ativo** (nav-active-bg / nav-active-text): item atual do menu lateral.

### Semântica de dinheiro
- **Entrou** (money-in, `--tone-in`): valores recebidos, saldo positivo, sucesso.
- **Saiu / Atrasou** (money-out, `--tone-out`): valores pagos, saldo negativo, vencido, ações destrutivas em ícone.
- **Atenção** (warn, `--tone-warn`): vence em breve, pendência, aviso.
- **Erro** (danger): mensagens de erro de formulário.

### Gráficos
- `chart-1` a `chart-5` (`--chart-*`): séries de gráfico, nessa ordem. Sempre acompanhadas de legenda em texto (`ChartLegend`), nunca só cor.

### Tema escuro
Os tokens `dark-*` substituem os claros sob `:root[data-ax-theme="dark"]`: ardósia (`dark-paper`, `dark-card`), tinta clara, azul mais luminoso e tons de dinheiro mais claros para manter 4,5:1.

### Named Rules
**The Money Color Rule.** Verde, rosa e âmbar significam dinheiro e prazo. Não use essas cores para decorar, destacar seção ou diferenciar categoria.

**The Never Color Alone Rule.** Toda informação em cor também aparece em texto, sinal (+ / −) ou ícone (WCAG 1.4.1, Seção 15 do DIRECAO.md).

**The Token First Rule.** Cor nova entra como token em `:root` e em `:root[data-ax-theme="dark"]`. Hex solto dentro de regra de componente só com o par do tema escuro ao lado e o contraste conferido.

## Typography

**Display Font:** Manrope (com system-ui, sans-serif)
**Body Font:** Manrope (com system-ui, sans-serif)

**Character:** Manrope é geométrica, legível em tamanho pequeno e tem números tabulares bons para colunas de valores. Carregada por `@fontsource/manrope` (400, 500, 600 e 700) só na área logada. Páginas públicas usam a pilha do sistema, exceto a prévia do produto na landing.

### Hierarchy
- **Page title** (700, clamp 1.4–1.8rem, 1.25, −0.035em): `h1` dentro de `.page-header`, um por página, acompanhado de `.subtitle`.
- **Metric** (700, clamp 1.22–1.62rem, números tabulares): valor principal de `.workspace-metric` e dos cartões do painel.
- **Modal title** (650, 1.125rem, 1.3): `h2` do cabeçalho de janela.
- **Body** (400, 14px, 1.6): texto corrido e descrições.
- **Label** (600, 0.875rem): rótulo de campo, acima dele.
- **Metric label** (650, 0.76rem, +0.015em): rótulo de métrica, em Tinta Suave.
- **Button** (500, 0.8125rem): texto de botão.

### Named Rules
**The Tabular Money Rule.** Todo valor monetário usa `font-variant-numeric: tabular-nums` e fica alinhado à direita em tabela (`th.money` / `td.money`).

**The Bold Parent Rule.** Em listas hierárquicas (categorias), o item pai é negrito e o filho é peso normal; o ícone tem o tamanho da fonte da linha.

## Layout

A área logada é uma casca fixa (`.app-shell`): barra do topo, menu lateral recolhível e área de conteúdo `#conteudo` com rolagem própria. O conteúdo vive em `main` com três larguras: padrão (900px, formulários), `main.narrow` (560px) e `main.wide` (sem teto, para listas e painéis). O respiro lateral e entre o cabeçalho e o conteúdo é `--workspace-space` (24px).

Cabeçalho de página: `.page-header` com `h1` + `.subtitle` à esquerda e ações à direita (botão principal por último). Resumo numérico: `.workspace-metrics` em grade de 2 a 4 colunas, que vira 2 colunas no celular. Formulários usam `.form-grid` em duas colunas, que vira uma em telas estreitas. Tabelas largas ficam dentro de `.table-scroll`, e a página nunca rola na horizontal, nem com zoom de 200% (viewport de 640px).

No celular (< 768px) o menu lateral vira gaveta: abre com foco no primeiro item e deixa o resto da página inerte. O app declara `interactiveWidget: "resizes-content"`, para o teclado virtual encolher a área útil em vez de cobrir o campo.

## Elevation & Depth

Profundidade principalmente tonal: papel atrás, cartão branco com borda fina na frente. Sombras são curtas e baixas, para separar e não para fazer flutuar. A única elevação forte é a das janelas, sobre um véu escuro.

### Shadow Vocabulary
- **Cartão** (`box-shadow: 0 2px 10px rgba(20, 30, 60, 0.05)`): `.card` e superfícies equivalentes.
- **Botão neutro** (`inset 0 1.5px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(28,25,23,.06), 0 1px 2px rgba(28,25,23,.08)`): relevo interno discreto do botão padrão.
- **Botão principal** (`0 3px 9px rgba(47, 104, 232, 0.18)`): leve brilho azul sob a ação principal.
- **Véu de janela** (`.modal-overlay`, `rgba(0, 0, 0, 0.45)`): escurece o fundo atrás de qualquer modal.

### Named Rules
**The Opaque Popover Rule.** Menus suspensos, listas de seleção e popovers têm fundo opaco (`--card`). Nada de vidro translúcido sobre tabela.

## Shapes

Cantos suaves e proporcionais ao tamanho: campo 6px, item de menu 8px, botão 9px, controles e botão de fechar 10px, quadro de ícone e janelas da área logada 12px, métrica 13px, cartão 14px. Pílula (999px) só para selos, chips de status e contadores. Bordas de 1px em Linha Fina; nada de borda grossa colorida em um lado só.

As setas de select (`--select-arrow`, chevron de 14px) ficam a 0,75rem da borda direita, com 2,25rem de respiro reservado para o texto não passar por baixo.

## Components

### Buttons
- **Shape:** cantos suaves (9px), altura mínima de 36px, padding horizontal de 0,875rem.
- **Neutro (padrão):** fundo de cartão, borda clara, texto grafite e relevo interno. Hover clareia o fundo; o clique desce 1px. É o estilo de todo `button[type=submit]`, `button.secondary` e `.button-link` dentro de `.ax-model-buttons`.
- **Principal:** `.workspace-primary-action`, em Azul de Ação com texto branco. Um por tela ou janela ("+ Nova entrada", "Salvar entrada").
- **Foco:** contorno de 2px em `--focus` com 2px de afastamento. Sempre visível no teclado.
- **Desabilitado:** opacidade 0,5.
- **Perigo:** `.danger-button`, rosa sólido, só em ações destrutivas confirmadas.
- **Atenção à especificidade:** as regras de `.ax-model-buttons` são muito específicas. Ajustes precisam vir depois no arquivo ou ser mais específicos, nunca com `!important` espalhado.

### Cards / Containers
- **Corner Style:** 14px (`.card`), 13px (`.workspace-metric`).
- **Background:** Cartão sobre Papel.
- **Shadow Strategy:** sombra "Cartão" (ver Elevation & Depth).
- **Border:** 1px Linha Fina. A métrica principal (`.workspace-metric-primary`) mistura 42% do azul na borda; a de alerta mistura âmbar.
- **Internal Padding:** 1,75rem em cartão, 1rem × 1,15rem em métrica.

### Inputs / Fields
- **Style:** fundo de cartão, borda de 1px em Borda de Campo, cantos de 6px, texto de 1rem (16px, evita o zoom automático do iOS).
- **Rótulo:** `label` em bloco acima do campo (600, 0,875rem), com 1rem de margem superior.
- **Dinheiro:** `type="text" inputMode="decimal"`; o `MoneyInputMask` global formata e a action converte com `parseAmountToCents`.
- **Seleção rica:** `CategorySelect`, `CategoryPicker` e `PartyPicker` são listas próprias (com ícone, pai em negrito e busca), mas o `select` nativo escondido continua dono do valor e dispara `change`.
- **Erro:** mensagem em `.error` acima do formulário; a janela que falhou reabre com `initiallyOpen`.

### Navigation
- **Menu lateral:** itens de 40px com ícone, cantos de 8px; o ativo usa Item Ativo e peso 700. Grupos recolhíveis. No celular vira gaveta com foco preso.
- **Barra do topo:** cartão com identidade da empresa, "+" de criação rápida, busca, sino de notificações e avatar (que abre Aparência, Novidades e Sair).
- **Gerenciar:** ações por linha de tabela ficam no `RowActionsMenu` ("Gerenciar"), nunca em fileira de botões na célula.

### Janelas (signature component)
Todo modal segue o mesmo esqueleto (`ActionModal`, `Modal`, criação rápida e `StackedModal`):
- **Cabeçalho:** quadro de ícone de 40px (ícone de 20px, fundo azul a 9%, cantos de 12px; variantes `is-warning` e `is-danger`), título 1,125rem, linha de contexto em Tinta Suave e botão de fechar de 36px. Uma linha fina separa o cabeçalho do corpo.
- **Corpo:** rola sozinho; os campos usam `.form-grid`.
- **Rodapé:** `.modal-form-footer` fixo no fim da janela, com Cancelar e a ação principal. `scroll-padding-bottom` garante que o campo focado não fique atrás dele.
- **Janela sobre janela:** `StackedModal` (cadastro rápido de categoria ou cliente dentro de um lançamento) abre por cima, com seu próprio véu, e devolve o item criado já selecionado (`useSelectAfterCreate`).
- **Teclado:** Esc fecha, Tab circula dentro da janela e o foco volta ao botão que abriu.

### Avisos
Retorno de ação por `?salvo=1` / `?erro=...` vira `.success-box` ou `.error` no topo do conteúdo. Notificações ficam em cartão pequeno no canto inferior direito (`NotificationToasts`). Nada de faixa larga no topo da página.

### Login e cadastro
Têm identidade própria (`login.module.css`, tokens `--l-*` em `.page`): coluna limpa com o formulário e painel com um extrato de exemplo que fecha o saldo. Usam o mesmo azul e as mesmas cores de dinheiro, mas não herdam `.ax-model-buttons`. Mudanças nessas telas pedem aprovação do usuário.

## Do's and Don'ts

### Do:
- **Do** usar os tokens (`var(--text)`, `var(--muted)`, `var(--border)`, `var(--card)`, `var(--accent)`, `var(--tone-*)`) e conferir as duas aparências.
- **Do** manter 4,5:1 para texto e 3:1 para bordas de campo e ícones, nos dois temas.
- **Do** usar o esqueleto de janela (ícone, título, contexto, fechar, rodapé fixo) em todo modal novo.
- **Do** mostrar valor, conta e empresa antes de confirmar baixa, estorno ou exclusão.
- **Do** alinhar valores à direita com números tabulares e sinal explícito.
- **Do** testar em 640px de largura (zoom de 200%) sem rolagem horizontal na página.
- **Do** registrar a novidade visível no topo de `apps/web/lib/changelog.ts`.

### Don't:
- **Don't** criar banner grande no topo da página para aviso ou notificação.
- **Don't** usar popover, menu ou lista translúcida.
- **Don't** usar o Azul AX (#4680ff) como cor de texto sobre fundo claro.
- **Don't** usar verde, rosa ou âmbar fora do significado de dinheiro e prazo.
- **Don't** colocar mais de um botão principal azul na mesma tela ou janela.
- **Don't** encostar a seta de select na borda; use o padrão global de `--select-arrow`.
- **Don't** usar ícones desproporcionais ao texto da linha (nem maiores, nem menores).
- **Don't** alterar login ou cadastro sem aprovação do usuário.
