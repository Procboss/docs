import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { siteConfig, sections } from "../config";

/**
 * /llms-full.txt — the entire docs site as ONE markdown document (the
 * llmstxt.org "full" variant). Every page in sidebar order, its canonical
 * URL stamped right under its H1 (unambiguous provenance for retrieval),
 * then the page body verbatim. GENERATED from the content collection, so it
 * can never fall behind the site.
 */
export const GET: APIRoute = async () => {
  const docs = await getCollection("docs");

  const ordered = sections.flatMap((section) =>
    docs
      .filter((e) => e.data.section === section.key)
      .sort((a, b) => a.data.order - b.data.order),
  );

  const pageUrl = (id: string) =>
    id === "intro" ? `${siteConfig.url}/` : `${siteConfig.url}/${id}/`;

  const parts: string[] = [
    `# ${siteConfig.name} — full documentation`,
    "",
    `> Every page of ${siteConfig.url}, concatenated as markdown. Each page starts with its canonical URL.`,
    "",
    "---",
    "",
  ];

  for (const entry of ordered) {
    const body = (entry.body ?? "").trim();
    parts.push(
      `# ${entry.data.title}`,
      "",
      `> Source: ${pageUrl(entry.id)}`,
      "",
      body,
      "",
      "---",
      "",
    );
  }

  return new Response(parts.join("\n"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
