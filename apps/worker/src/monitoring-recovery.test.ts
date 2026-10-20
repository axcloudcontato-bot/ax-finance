import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { monitorOperations } from "./monitoring";
import { readTimestampStatus } from "@ax-finance/domain";

vi.mock("@ax-finance/domain", () => ({
  getOperationalDiagnostics: vi.fn(async () => ({
    outbox: { deadLetter: 0, oldestPendingAgeSeconds: 0 },
    scheduledJobs: { failing: 0, staleLocks: 0, overdue: 0 },
    importJobs: { failed: 0, staleLocks: 0, oldestPendingAgeSeconds: 0 },
  })),
  readTimestampStatus: vi.fn(),
  structuredLog: vi.fn(),
  logOperationalError: vi.fn(),
}));
const fetchMock = vi.fn(async () => ({ ok: true }));
beforeEach(() => {
  vi.stubEnv("ALERT_WEBHOOK_URL", "https://alerts.example.test/recovery");
  vi.stubEnv("RESTORE_DRILL_STATUS_FILE", "restore-success");
  vi.stubEnv("RESTORE_DRILL_FAILURE_FILE", "restore-failure");
  vi.stubEnv("BACKUP_COPY_STATUS_FILE", "external");
  vi.stubEnv("EXTERNAL_BACKUP_REQUIRED", "true");
  vi.spyOn(process, "uptime").mockReturnValue(3600);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  vi.mocked(readTimestampStatus).mockImplementation(async (file) => ({
    available: file !== "restore-failure", ageSeconds: 10,
  } as Awaited<ReturnType<typeof readTimestampStatus>>));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("avisa sobre falha do ensaio mesmo quando a restauração anterior foi recente", async () => {
  vi.mocked(readTimestampStatus).mockResolvedValue({ available: true, ageSeconds: 10 } as Awaited<ReturnType<typeof readTimestampStatus>>);
  await monitorOperations(new Date("2026-10-20T12:00:00Z"));
  expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: expect.stringContaining('"alertCode":"restore_drill_failed"') }));
});
it("avisa quando faltam evidência de restauração e cópia externa obrigatória", async () => {
  vi.mocked(readTimestampStatus).mockImplementation(async (file) => ({
    available: !["restore-success", "restore-failure", "external"].includes(file ?? ""), ageSeconds: null,
  } as Awaited<ReturnType<typeof readTimestampStatus>>));
  await monitorOperations(new Date("2026-10-21T12:00:00Z"));
  const bodies = fetchMock.mock.calls.map((call) => JSON.parse(String((call as unknown as [string, RequestInit])[1].body)).alertCode);
  expect(bodies).toContain("restore_drill_stale");
  expect(bodies).toContain("external_backup_stale");
});
it("não avisa sobre recuperação quando as evidências estão recentes", async () => {
  await monitorOperations(new Date("2026-10-22T12:00:00Z"));
  expect(fetchMock).not.toHaveBeenCalled();
});
