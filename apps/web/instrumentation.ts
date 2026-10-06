/**
 * Gancho do Next.js para erros não tratados no servidor (renderização, rotas de API, server actions
 * que lançam). Cada erro vira log estruturado e, se configurado, alerta no webhook operacional.
 * Ver lib/error-reporting.ts para o que é e o que nunca é registrado.
 *
 * O import fica DENTRO do `if (NEXT_RUNTIME === "nodejs")`: o Next compila este arquivo também para o
 * runtime edge, que não tem `node:crypto`, e só descarta o ramo quando a condição tem esta forma.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string },
) {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { reportServerError } = await import("./lib/error-reporting");
    reportServerError(error, {
      source: "request",
      route: context.routePath,
      method: request.method,
      digest: (error as { digest?: string } | null)?.digest,
    });
  }
}
