import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reportServerError, resetErrorReportingForTests } from "./error-reporting";

const originalWebhook = process.env.ALERT_WEBHOOK_URL;

beforeEach(() => {
  resetErrorReportingForTests();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalWebhook === undefined) delete process.env.ALERT_WEBHOOK_URL;
  else process.env.ALERT_WEBHOOK_URL = originalWebhook;
});

describe("monitoramento de erros não tratados", () => {
  it("loga só o que é seguro: nome, rota-modelo, método, digest e referência", () => {
    delete process.env.ALERT_WEBHOOK_URL;
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const ref = reportServerError(new Error("falha com valor 12345,67 do cliente maria@x.com"), {
      source: "request", route: "/saidas/[titleId]", method: "POST", digest: "abc123",
    });

    const line = JSON.parse(String(log.mock.calls[0]?.[0]));
    expect(line).toMatchObject({ event: "web.unhandled_error", errorRef: ref, route: "/saidas/[titleId]", method: "POST", digest: "abc123" });
    expect(JSON.stringify(line)).not.toContain("12345,67");
    expect(JSON.stringify(line)).not.toContain("maria@x.com");
  });

  it("manda um alerta ao webhook e não repete o mesmo erro na mesma rota dentro do intervalo", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://alerts.example.test/hook";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const now = new Date("2026-10-06T12:00:00Z");
    reportServerError(new Error("boom"), { source: "request", route: "/saidas" }, now);
    reportServerError(new Error("boom"), { source: "request", route: "/saidas" }, new Date(now.getTime() + 60_000));
    reportServerError(new Error("boom"), { source: "request", route: "/entradas" }, now);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ service: "ax-finance", alertCode: "web_unhandled_error" });
    expect(body.summary).toContain("/saidas");
    expect(body.summary).not.toContain("boom");
  });

  it("falha do webhook nunca derruba quem reportou", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://alerts.example.test/hook";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede fora")));
    expect(() => reportServerError(new Error("x"), { source: "action" })).not.toThrow();
    await vi.waitFor(() => expect(console.warn).toHaveBeenCalled());
  });
});
