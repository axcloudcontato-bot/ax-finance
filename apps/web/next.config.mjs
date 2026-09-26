/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pacotes do monorepo distribuem apenas os fontes TypeScript (sem etapa de
  // build própria) — o Next precisa transpilá-los como se fossem parte do app.
  transpilePackages: ["@ax-finance/db", "@ax-finance/domain"],
};

export default nextConfig;
