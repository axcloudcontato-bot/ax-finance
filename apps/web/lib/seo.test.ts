import { describe, expect, it } from "vitest";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { SITE_URL } from "./site";

describe("descoberta pública e SEO", () => {
  it("publica somente URLs canônicas e públicas no sitemap", () => {
    const entries = sitemap();

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.url).toBe(SITE_URL);
    expect(entries.every((entry) => entry.url.startsWith(SITE_URL))).toBe(true);
    expect(entries.some((entry) => /\/(login|registro|dashboard|admin)(?:\/|$)/.test(entry.url))).toBe(false);
  });

  it("referencia o sitemap e protege superfícies privadas no robots", () => {
    const policy = robots();
    const rules = Array.isArray(policy.rules) ? policy.rules : [policy.rules];
    const blocked = rules.flatMap((rule) => {
      if (!rule?.disallow) return [];
      return Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
    });

    expect(policy.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(policy.host).toBe(SITE_URL);
    expect(blocked).toEqual(expect.arrayContaining(["/api/", "/admin", "/dashboard"]));
  });
});
