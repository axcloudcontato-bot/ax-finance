/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pacotes do monorepo distribuem apenas os fontes TypeScript (sem etapa de
  // build própria) — o Next precisa transpilá-los como se fossem parte do app.
  transpilePackages: ["@ax-finance/db", "@ax-finance/domain"],
  // Empacota só o necessário em .next/standalone (usado pela imagem Docker).
  // A raiz do monorepo é detectada automaticamente (via pnpm-lock.yaml na
  // raiz) — não precisa de outputFileTracingRoot explícito. No Windows local,
  // o Next tenta criar symlinks durante esse empacotamento e falha sem o modo
  // de desenvolvedor; o deploy Docker roda em Linux e continua standalone.
  output: process.platform === "win32" ? undefined : "standalone",
  experimental: {
    // O motor de consultas do Prisma (arquivo binário .so.node) é carregado
    // via caminho calculado em runtime, não via `require()` estático — o
    // rastreador de arquivos do Next não o detecta sozinho e a imagem final
    // fica sem ele ("could not locate the Query Engine"). Força a inclusão.
    outputFileTracingIncludes: {
      "/**/*": ["../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**/*"],
    },
  },
};

export default nextConfig;
