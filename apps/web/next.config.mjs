/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pacotes do monorepo distribuem apenas os fontes TypeScript (sem etapa de
  // build própria) — o Next precisa transpilá-los como se fossem parte do app.
  transpilePackages: ["@ax-finance/db", "@ax-finance/domain"],
  // Empacota só o necessário em .next/standalone (usado pela imagem Docker).
  // A raiz do monorepo é detectada automaticamente (via pnpm-lock.yaml na
  // raiz) — não precisa de outputFileTracingRoot explícito.
  output: "standalone",
};

export default nextConfig;
