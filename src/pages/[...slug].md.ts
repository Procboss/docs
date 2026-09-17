import type { APIRoute } from "astro";
import type { CollectionEntry } from "astro:content";
import { getCollection } from "astro:content";

/**
 * /[...slug].md — every docs page ALSO exists as raw markdown at its URL
 * with ".md" appended (the Anthropic-docs-style AI-friendly surface). Bodies
 * carry no h1 (the layout renders it), so the title is prepended to make the
 * file self-contained. noindex'd via public/_headers so search engines keep
 * one canonical copy (the HTML) while LLMs and curl get the clean source.
 */
export async function getStaticPaths() {
  const docs = await getCollection("docs");
  return docs.map((entry) => ({
    params: { slug: entry.id },
    props: { entry },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { entry } = props as { entry: CollectionEntry<"docs"> };
  const body = (entry.body ?? "").trim();
  return new Response(`# ${entry.data.title}\n\n${body}\n`, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
