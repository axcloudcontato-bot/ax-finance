import { createHmac } from "node:crypto";

type LogLevel = "debug" | "info" | "warn" | "error";

type SafeLogValue = string | number | boolean | null | undefined;

const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|payload|email|recipient|name|description|body|amount|document)/i;

function sanitizeValue(key: string, value: SafeLogValue): string | number | boolean | null | undefined {
  if (value === undefined) return undefined;
  if (SENSITIVE_KEY.test(key)) return "[redacted]";
  if (typeof value === "string") return value.slice(0, 250);
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value;
}

export function operationalErrorFingerprint(error: unknown): string {
  if (!error || typeof error !== "object") return "UnknownError";
  const candidate = error as { name?: unknown; code?: unknown };
  const name = typeof candidate.name === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(candidate.name)
    ? candidate.name
    : "Error";
  const code = typeof candidate.code === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(candidate.code)
    ? candidate.code
    : null;
  if (code) return `${name}:${code}`;
  const message = error instanceof Error ? error.message : "";
  if (!message) return name;
  const fingerprintKey = process.env.OUTBOX_ENCRYPTION_KEY
    || process.env.SESSION_SECRET
    || "ax-finance-local-error-fingerprint";
  const digest = createHmac("sha256", fingerprintKey).update(message).digest("hex").slice(0, 12);
  return `${name}:sha256_${digest}`;
}

export function structuredLog(
  level: LogLevel,
  event: string,
  fields: Record<string, SafeLogValue> = {}
) {
  const safeFields = Object.fromEntries(
    Object.entries(fields)
      .map(([key, value]) => [key, sanitizeValue(key, value)] as const)
      .filter((entry) => entry[1] !== undefined)
  );
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: process.env.SERVICE_NAME?.trim() || "ax-finance",
    event: event.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 100),
    ...safeFields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") console.debug(line);
  else console.info(line);
}

export function logOperationalError(
  event: string,
  error: unknown,
  fields: Record<string, SafeLogValue> = {}
) {
  structuredLog("error", event, { ...fields, errorFingerprint: operationalErrorFingerprint(error) });
}
