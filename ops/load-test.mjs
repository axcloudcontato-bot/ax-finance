import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

function positiveInteger(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} precisa ser um inteiro positivo.`);
  return value;
}

const baseUrl = new URL(process.env.LOAD_BASE_URL || process.env.APP_BASE_URL || "http://127.0.0.1:3000");
const path = process.env.LOAD_PATH || "/api/health/live";
const allowedPaths = new Set(["/api/health/live", "/api/health/ready"]);
if (!allowedPaths.has(path) && process.env.LOAD_ALLOW_CUSTOM_PATH !== "true") {
  throw new Error("LOAD_PATH só pode apontar para um health check, salvo LOAD_ALLOW_CUSTOM_PATH=true.");
}
const durationSeconds = positiveInteger("LOAD_DURATION_SECONDS", 30);
const requestsPerSecond = positiveInteger("LOAD_REQUESTS_PER_SECOND", 5);
const timeoutMs = positiveInteger("LOAD_REQUEST_TIMEOUT_MS", 5000);
if (durationSeconds > 600) throw new Error("LOAD_DURATION_SECONDS não pode exceder 600.");
if (requestsPerSecond > 100 && process.env.LOAD_ALLOW_HIGH_RATE !== "true") {
  throw new Error("Acima de 100 req/s exige LOAD_ALLOW_HIGH_RATE=true.");
}

const target = new URL(path, baseUrl);
const startedAt = new Date();
const latencies = [];
let attempted = 0;
let succeeded = 0;
let failed = 0;
const pending = new Set();

async function request() {
  attempted += 1;
  const started = performance.now();
  try {
    const response = await fetch(target, { method: "GET", signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    await response.arrayBuffer();
    succeeded += 1;
  } catch {
    failed += 1;
  } finally {
    latencies.push(performance.now() - started);
  }
}

const totalRequests = durationSeconds * requestsPerSecond;
const intervalMs = 1000 / requestsPerSecond;
const startClock = performance.now();
for (let index = 0; index < totalRequests; index += 1) {
  const waitMs = startClock + index * intervalMs - performance.now();
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  const task = request().finally(() => pending.delete(task));
  pending.add(task);
}
await Promise.all(pending);

latencies.sort((a, b) => a - b);
const percentile = (value) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * value))] || 0;
const errorRate = attempted ? failed / attempted : 1;
const maxErrorRate = Number(process.env.LOAD_MAX_ERROR_RATE || 0.01);
const maxP95Ms = Number(process.env.LOAD_MAX_P95_MS || 750);
const result = errorRate <= maxErrorRate && percentile(0.95) <= maxP95Ms ? "passed" : "failed";
const report = {
  formatVersion: 1,
  operation: "load-test",
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  target: `${target.origin}${target.pathname}`,
  configuredRequestsPerSecond: requestsPerSecond,
  durationSeconds,
  attempted,
  succeeded,
  failed,
  errorRate: Number(errorRate.toFixed(6)),
  latencyMs: {
    p50: Number(percentile(0.5).toFixed(2)),
    p95: Number(percentile(0.95).toFixed(2)),
    p99: Number(percentile(0.99).toFixed(2)),
    max: Number((latencies.at(-1) || 0).toFixed(2)),
  },
  thresholds: { maxErrorRate, maxP95Ms },
  result,
};
const serialized = `${JSON.stringify(report, null, 2)}\n`;
const evidenceDir = process.env.OPERATION_EVIDENCE_DIR || ".operations/evidence/load";
await mkdir(evidenceDir, { recursive: true });
const runId = startedAt.toISOString().replaceAll(/[-:.]/g, "").replace("Z", "Z");
const evidencePath = `${evidenceDir}/${runId}.json`;
await writeFile(evidencePath, serialized, { mode: 0o600 });
process.stdout.write(serialized);
process.stdout.write(`${JSON.stringify({ evidencePath, sha256: createHash("sha256").update(serialized).digest("hex") })}\n`);
if (result !== "passed") process.exitCode = 1;
