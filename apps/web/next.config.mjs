const noIndexSources = [
  "/login",
  "/registro",
  "/mfa",
  "/onboarding",
  "/recuperar-senha",
  "/redefinir-senha/:path*",
  "/verificar-email/:path*",
  "/convites/:path*",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
      ...noIndexSources.map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      })),
    ];
  },
  // Pacotes do monorepo distribuem apenas os fontes TypeScript (sem etapa de
  // build própria) — o Next precisa transpilá-los como se fossem parte do app.
  transpilePackages: ["@ax-finance/db", "@ax-finance/domain"],
  // O pdfkit lê as fontes padrão (arquivos .afm) do próprio pacote em tempo de execução: fica fora do
  // empacotamento do servidor para esses arquivos continuarem no lugar.
  serverExternalPackages: ["pdfkit", "nodemailer"],
  // Empacota só o necessário em .next/standalone (usado pela imagem Docker).
  // A raiz do monorepo é detectada automaticamente (via pnpm-lock.yaml na
  // raiz) — não precisa de outputFileTracingRoot explícito. No Windows local,
  // o Next tenta criar symlinks durante esse empacotamento e falha sem o modo
  // de desenvolvedor; o deploy Docker roda em Linux e continua standalone.
  output: process.platform === "win32" ? undefined : "standalone",
  // O motor de consultas do Prisma (arquivo binário .so.node) é carregado
  // via caminho calculado em runtime, não via `require()` estático — o
  // rastreador de arquivos do Next não o detecta sozinho e a imagem final
  // fica sem ele ("could not locate the Query Engine"). Força a inclusão.
  outputFileTracingIncludes: {
    "/**/*": ["../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**/*"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "21mb",
    },
  },
};

export default nextConfig;
