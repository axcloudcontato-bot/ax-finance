import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

const LAST_CONTENT_UPDATE = new Date("2026-09-29T00:00:00-03:00");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: LAST_CONTENT_UPDATE, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/demonstracao`, lastModified: LAST_CONTENT_UPDATE, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/faq`, lastModified: LAST_CONTENT_UPDATE, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/suporte`, lastModified: LAST_CONTENT_UPDATE, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/informacoes-fiscais`, lastModified: LAST_CONTENT_UPDATE, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/cancelamento`, lastModified: LAST_CONTENT_UPDATE, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/termos`, lastModified: LAST_CONTENT_UPDATE, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/privacidade`, lastModified: LAST_CONTENT_UPDATE, changeFrequency: "yearly", priority: 0.4 },
  ];
}
