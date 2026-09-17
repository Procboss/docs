import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { siteConfig, sections } from "../config";
import { getLastmodMap } from "../lib/lastmod.mjs";

/**
 * /rss.xml — a dependency-free RSS 2.0 feed of the docs (one item per page,
 * pubDate = the git-derived lastmod). Feeds are discovery surfaces for both
 * traditional readers and AI ingestion pipelines.
 */

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const GET: APIRoute = async () => {
  const docs = await getCollection("docs");
  const lastmod = getLastmodMap();

  const ordered = sections.flatMap((section) =>
    docs
      .filter((e) => e.data.section === section.key)
      .sort((a, b) => a.data.order - b.data.order),
  );

  const pageUrl = (id: string) =>
    id === "intro" ? `${siteConfig.url}/` : `${siteConfig.url}/${id}/`;

  let newest = "1970-01-01T00:00:00.000Z";
  const items = ordered.map((entry) => {
    const date = lastmod.get(entry.id) ?? new Date().toISOString();
    if (date > newest) newest = date;
    const url = pageUrl(entry.id);
    return [
      "    <item>",
      `      <title>${esc(entry.data.title)}</title>`,
      `      <link>${esc(url)}</link>`,
      `      <guid isPermaLink="true">${esc(url)}</guid>`,
      `      <description>${esc(entry.data.description)}</description>`,
      `      <pubDate>${new Date(date).toUTCString()}</pubDate>`,
      "    </item>",
    ].join("\n");
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(siteConfig.name)}</title>
    <link>${siteConfig.url}/</link>
    <description>${esc(
      "Documentation for ProcBoss (pboss) — the open-source, Bun-native process manager — and ProcBoss Cloud.",
    )}</description>
    <language>en</language>
    <lastBuildDate>${new Date(newest).toUTCString()}</lastBuildDate>
    <atom:link href="${siteConfig.url}/rss.xml" rel="self" type="application/rss+xml"/>
${items.join("\n")}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
};
