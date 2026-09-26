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
