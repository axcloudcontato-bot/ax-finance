# Sugestão de categoria

Ao digitar a descrição de uma entrada, saída ou compra no cartão e sair do campo com a categoria ainda
vazia, o formulário mostra uma dica com botão "Usar". Nunca preenche sozinho e nunca grava nada.
Código em `packages/domain/src/ai/suggest-category.ts`; rota `POST /api/suggestions/category`.

## Duas camadas

1. **Histórico (sempre ligado, sem custo, nada sai do sistema).** Se a empresa já lançou a mesma
   descrição (sem diferenciar maiúsculas), sugere a categoria que mais usou nela: confiança alta com 2
   ou mais usos, média com 1. Só entram categorias ativas e do tipo certo (entrada = receita).
2. **IA (opcional, desligada por padrão).** Só para descrição nova, só se o recurso estiver ligado e
   dentro do teto mensal do plano.

## O que a IA recebe

- A descrição, depois de limpa: sem e-mail, endereço da web, CPF/CNPJ e números longos; no máximo 120
  caracteres.
- A lista de categorias da própria empresa (id, nome, grupo gerencial), só do tipo certo.
- Nunca: valores, datas, contas, nomes de clientes ou fornecedores, nem nenhum outro lançamento.

A resposta só vale se o id devolvido for exatamente o de uma categoria candidata daquela empresa; um id
inventado, de receita numa saída ou de outra empresa é descartado. O modelo não calcula saldo nem valor.
A descrição é tratada como dado não confiável no prompt (instruções dentro dela são ignoradas).
Falha de rede, recusa ou prazo de 8 s viram "sem sugestão"; o formulário segue normal.

## Custo e limites

- Teto de consultas à IA por empresa e mês: **100** no plano Gestão Pessoal, **500** no Essencial
  (`AI_MONTHLY_LIMIT`). O contador é atômico (`ai_usage`) e conta a consulta mesmo quando a IA não
  encontra categoria, porque o custo já foi gasto. Histórico não conta.
- Modelo padrão `claude-opus-5-5` com esforço baixo, uma chamada curta por descrição nova. Para outro
  modelo, defina `AI_CATEGORY_MODEL`.

## Como ligar (decisão do operador)

Ligar manda texto de usuário a um provedor externo (Anthropic). Antes:

1. Incluir o provedor na lista de subprocessadores e na política de privacidade (item jurídico da
   lista de lançamento comercial).
2. No servidor, digitar no `.env` (a chave nunca vai para o repositório):

```
AI_SUGGESTIONS_ENABLED=true
ANTHROPIC_API_KEY=...
```

3. `./deploy.sh`. Sem as duas variáveis o recurso fica só no histórico.

## Fora desta versão

Sugestão na conciliação de extrato (cada linha do extrato), aprendizado a partir das correções do
usuário e fallback de recusa do modelo.
