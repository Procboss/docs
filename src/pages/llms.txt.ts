import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { siteConfig, sections } from "../config";

/**
 * /llms.txt — the llmstxt.org convention: a markdown MAP of this site for
 * LLMs and AI agents. H1 + blockquote summary, then one section per docs
 * section with every page as a link + one-line description, then the Optional
 * block (full dump, feed, product links).
 *
 * GENERATED from the content collection at build time — a new page appears
 * here the moment it is written; no hand-maintained list can drift.
 */
export const GET: APIRoute = async () => {
  const docs = await getCollection("docs");
  const byId = new Map(docs.map((e) => [e.id, e]));

  /** Sidebar order: sections from config, entries by frontmatter order. */
  const ordered = sections.flatMap((section) =>
    docs
      .filter((e) => e.data.section === section.key)
      .sort((a, b) => a.data.order - b.data.order),
  );

  /** Canonical HTML URL: intro is the site index, everything else /<id>/. */
  const pageUrl = (id: string) =>
    id === "intro" ? `${siteConfig.url}/` : `${siteConfig.url}/${id}/`;

  const intro = byId.get("intro");
  const summary =
    intro?.data.description ??
    "Documentation for ProcBoss (pboss) — the open-source, Bun-native process manager — and ProcBoss Cloud.";

  const lines: string[] = [
    `# ${siteConfig.name}`,
    "",
    `> ${summary}`,
    "",
  ];

  for (const section of sections) {
    const entries = ordered.filter((e) => e.data.section === section.key);
    if (entries.length === 0) continue;
    lines.push(`## ${section.label}`, "");
    for (const entry of entries) {
      lines.push(`- [${entry.data.title}](${pageUrl(entry.id)}): ${entry.data.description}`);
    }
    lines.push("");
  }

  lines.push(
    "## Optional",
    "",
    `- [Full documentation](https://docs.procboss.com/llms-full.txt): every page concatenated as one markdown document`,
    `- [RSS feed](https://docs.procboss.com/rss.xml): new and updated pages`,
    `- [ProcBoss Cloud](https://procboss.com): the hosted fleet dashboard — link servers, alerts, metrics`,
    `- [pboss on GitHub](https://github.com/Procboss/pboss): the open-source CLI (GPLv3)`,
    `- [Per-page markdown](https://docs.procboss.com/quickstart.md): append \`.md\` to any docs URL for its raw markdown`,
    "",
  );

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
