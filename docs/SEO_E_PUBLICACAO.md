# SEO e publicação do site AX Finance

Domínio canônico: `https://axfinance.axcloud.com.br`

## Arquitetura escolhida

O site comercial e o sistema autenticado são publicados pela mesma aplicação Next.js e pelo mesmo container `web`:

- `/`: site comercial;
- `/demonstracao`, `/faq`, `/suporte` e documentos legais: conteúdo público indexável;
- `/login` e `/registro`: acesso e criação de conta, marcados para não indexação;
- `/dashboard`, módulos financeiros e `/admin`: áreas autenticadas, fora do sitemap e bloqueadas para rastreamento.

Essa estratégia reaproveita o domínio, o túnel Cloudflare, o deploy Docker e os cookies já existentes. Não é necessário criar outro servidor ou separar o frontend comercial agora.

## Endpoints de descoberta

Depois do deploy, devem responder com HTTP 200:

- `https://axfinance.axcloud.com.br/robots.txt`
- `https://axfinance.axcloud.com.br/sitemap.xml`
- `https://axfinance.axcloud.com.br/llms.txt`

O sitemap contém somente páginas públicas canônicas. O `robots.txt` referencia o sitemap e evita o rastreamento de APIs, painéis e módulos financeiros. O `llms.txt` resume o produto, planos, políticas e fontes canônicas para agentes de IA; ele é uma convenção emergente e não deve ser tratado como fator garantido de ranking no Google.

## Publicação em produção

Antes do deploy, confirme no `.env` do servidor:

```env
APP_BASE_URL=https://axfinance.axcloud.com.br
```

O hostname público do túnel Cloudflare deve continuar apontando para `http://localhost:3000` no servidor. Com as alterações commitadas e enviadas ao GitHub, publique assim:

```bash
cd ~/ax-finance
git pull --ff-only
./deploy.sh
```

O `deploy.sh` executa o rebuild, aplica migrations, sobe `web` e `worker`, valida health checks e remove imagens Docker antigas.

## Verificação pós-deploy

```bash
curl -fsS https://axfinance.axcloud.com.br/robots.txt
curl -fsS https://axfinance.axcloud.com.br/sitemap.xml
curl -fsS https://axfinance.axcloud.com.br/llms.txt
curl -I https://axfinance.axcloud.com.br/
curl -I https://axfinance.axcloud.com.br/login
```

Confirme que:

1. a home, demonstração, FAQ, suporte e documentos legais retornam `200`;
2. o sitemap usa apenas URLs HTTPS do domínio canônico;
3. `/login` responde com `X-Robots-Tag: noindex, nofollow, noarchive`;
4. dashboard e admin continuam exigindo autenticação;
5. nenhuma rota pública contém `noindex`.

## Google Search Console

A submissão exige acesso à conta Google que administra o domínio e à zona DNS no Cloudflare.

1. Abra `https://search.google.com/search-console`.
2. Adicione uma propriedade do tipo **Domínio** com `axfinance.axcloud.com.br`.
3. Copie o registro TXT fornecido pelo Google.
4. No Cloudflare, adicione o TXT à zona de `axcloud.com.br` exatamente como informado.
5. Volte ao Search Console e conclua a verificação.
6. Abra **Sitemaps** e envie `https://axfinance.axcloud.com.br/sitemap.xml`.
7. Em **Inspeção de URL**, teste e solicite indexação para:
   - `https://axfinance.axcloud.com.br/`
   - `https://axfinance.axcloud.com.br/demonstracao`
   - `https://axfinance.axcloud.com.br/faq`
8. Valide a home no teste de resultados avançados: `https://search.google.com/test/rich-results`.
9. Acompanhe os relatórios de páginas, HTTPS, dados estruturados e desempenho nas semanas seguintes.

Enviar um sitemap informa URLs preferenciais, mas não garante rastreamento, indexação ou posição. Conteúdo útil, estabilidade, velocidade, links externos legítimos e histórico do domínio continuam determinantes.

## Atualizações futuras

- Atualize a data em `apps/web/app/sitemap.ts` somente quando o conteúdo público mudar de forma relevante.
- Inclua novas páginas no sitemap apenas se forem públicas, canônicas e úteis nos resultados de busca.
- Mantenha preços e recursos iguais entre a página, os dados estruturados e o `llms.txt`.
- Não coloque rotas autenticadas, parâmetros de sessão, convites ou tokens no sitemap.
