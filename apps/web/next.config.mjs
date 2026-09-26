import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pacotes do monorepo distribuem apenas os fontes TypeScript (sem etapa de
  // build própria) — o Next precisa transpilá-los como se fossem parte do app.
  transpilePackages: ["@ax-finance/db", "@ax-finance/domain"],
  // Empacota só o necessário em .next/standalone (usado pela imagem Docker) —
  // sem isso o Next tenta inferir a raiz do monorepo e pode incluir/faltar
  // arquivos de fora de apps/web.
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
};

export default nextConfig;
