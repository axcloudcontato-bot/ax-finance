import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError, CompanyAccessDeniedError, CompanyPermissionDeniedError, EmailNotVerifiedError, InvalidCredentialsError, InvalidMfaCodeError, MfaChallengeInvalidError, NotAuthenticatedError, EmailAlreadyRegisteredError, TooManyLoginAttemptsError, PlanFeatureUnavailableError } from "@ax-finance/domain";
import { logOperationalError } from "@ax-finance/domain";

/**
 * Serializa BigInt (centavos) como string no JSON — JSON.stringify nativo
 * não sabe lidar com BigInt.
 */
export function json(data: unknown, init?: number | ResponseInit) {
  const body = JSON.stringify(data, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
  const responseInit = typeof init === "number" ? { status: init } : init;
  return new NextResponse(body, {
    ...responseInit,
    headers: { "Content-Type": "application/json", ...responseInit?.headers },
  });
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return json({ error: "VALIDATION_ERROR", message: "Dados inválidos.", issues: error.issues }, 400);
  }
  if (error instanceof NotAuthenticatedError) {
    return json({ error: error.code, message: error.message }, 401);
  }
  if (error instanceof InvalidCredentialsError) {
    return json({ error: error.code, message: error.message }, 401);
  }
  if (error instanceof InvalidMfaCodeError || error instanceof MfaChallengeInvalidError) {
    return json({ error: error.code, message: error.message }, 401);
  }
  if (error instanceof TooManyLoginAttemptsError) {
    return json({ error: error.code, message: error.message }, 429);
  }
  if (error instanceof EmailNotVerifiedError) {
    return json({ error: error.code, message: error.message }, 403);
  }
  if (error instanceof CompanyAccessDeniedError) {
    return json({ error: error.code, message: error.message }, 404);
  }
  if (error instanceof CompanyPermissionDeniedError || error instanceof PlanFeatureUnavailableError) {
    return json({ error: error.code, message: error.message }, 403);
  }
  if (error instanceof EmailAlreadyRegisteredError) {
    return json({ error: error.code, message: error.message }, 409);
  }
  if (error instanceof DomainError) {
    return json({ error: error.code, message: error.message }, 400);
  }

  logOperationalError("web.unhandled_api_error", error);
  return json({ error: "INTERNAL_ERROR", message: "Erro interno." }, 500);
}
