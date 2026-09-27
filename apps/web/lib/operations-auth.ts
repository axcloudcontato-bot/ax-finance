import { timingSafeEqual } from "node:crypto";

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function hasOperationsToken(request: Request, environmentName: "METRICS_TOKEN" | "OPERATIONS_TOKEN") {
  const expected = process.env[environmentName]?.trim();
  if (!expected || expected.length < 24) return false;
  const authorization = request.headers.get("authorization") || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  return secureEqual(supplied, expected);
}
