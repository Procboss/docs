import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * The docs collection. One Markdown file = one page at /<id>.
 *
 * Frontmatter:
 *   title       — page <h1> and sidebar label
 *   description — used for <meta name="description">
 *   section     — sidebar group; one of the keys in src/config.ts `sections`
 *   order       — position inside the section (also drives prev/next)
 */
const docs = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    description: z.string().default(""),
    section: z.string(),
    order: z.number(),
  }),
});

export const collections = { docs };
