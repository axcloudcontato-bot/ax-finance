import { afterEach, describe, expect, it, vi } from "vitest";
import { testAlertWebhook } from "./monitoring";

const originalWebhook = process.env.ALERT_WEBHOOK_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalWebhook === undefined) delete process.env.ALERT_WEBHOOK_URL;
  else process.env.ALERT_WEBHOOK_URL = originalWebhook;
});

describe("testAlertWebhook", () => {
  it("envia um evento de teste identificável", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://alerts.example.test/hook";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    const now = new Date("2026-09-29T12:00:00.000Z");

    await expect(testAlertWebhook(now)).resolves.toBe("delivered");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toMatchObject({
      service: "ax-finance",
      alertCode: "operational_test",
      timestamp: now.toISOString(),
      test: true,
    });
  });

  it("falha explicitamente quando o webhook não está configurado", async () => {
    delete process.env.ALERT_WEBHOOK_URL;
    await expect(testAlertWebhook()).rejects.toThrow("ALERT_WEBHOOK_URL");
  });

  it("falha quando o destino rejeita o evento", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://alerts.example.test/hook";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(testAlertWebhook()).rejects.toThrow("AlertWebhookRejected");
  });
});
