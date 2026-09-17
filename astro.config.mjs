import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import GithubSlugger from "github-slugger";
import { getLastmodMap } from "./src/lib/lastmod.mjs";

/**
 * Tiny rehype plugin: append a "#" anchor to every h2/h3 so deep links are
 * discoverable. Astro's user rehype plugins run BEFORE its built-in heading
 * id pass, so ids aren't on the nodes yet — we slug with github-slugger (the
 * same package/algorithm Astro uses) and write the ids ourselves. Astro's
 * pass then finds ids already present and leaves them alone; our hrefs match
 * exactly, dedup sequences included (our docs use no h1/h4+, so the slug
 * sequences are identical).
 */
function anchorHeadings() {
  /** Full rendered text of a hast node — INCLUDING inline elements
   * (code spans, links). Astro's own slugger uses full text; matching it
   * keeps ids stable for headings like `Member-exit policy: \`onNsMemberExit\``
   * (text-node-only slugging produced trailing-dash ids and broke the
   * cross-page anchors that link to them). */
  const textOf = (node) =>
    Array.isArray(node.children)
      ? node.children.map(textOf).join("")
      : node.type === "text"
        ? node.value
        : "";
  return (tree) => {
    const slugger = new GithubSlugger();
    const walk = (node) => {
      if (Array.isArray(node.children)) node.children.forEach(walk);
      if (node.type !== "element") return;
      if (node.tagName !== "h2" && node.tagName !== "h3") return;
      if (node.properties?.id) return; // already slugged
      const id = slugger.slug(textOf(node));
      node.properties = { ...node.properties, id };
      node.children.push({
        type: "element",
        tagName: "a",
        // NOTE: the decorative "#" must stay out of the search index (it
        // pollutes sub-result titles and excerpts). Astro's markdown
        // serializer drops data-* attributes from rehype properties, so
        // this is handled at the pagefind CLI layer instead:
        //   --exclude-selectors .anchor   (see package.json build script)
        properties: { class: "anchor", href: `#${id}`, ariaLabel: "Link to this section" },
        children: [{ type: "text", value: "#" }],
      });
    };
    walk(tree);
  };
}

// https://astro.build/config
export default defineConfig({
  // Canonical origin — used for sitemap/canonical URLs. Change this if the
  // docs end up living elsewhere (e.g. procboss.com/docs).
  site: "https://docs.procboss.com",

  // Static output (default): every page is prerendered HTML, zero runtime —
  // exactly what Cloudflare Pages wants from us.
  output: "static",

  integrations: [
    // AUTOMATIC SITEMAP — every static route this build produces (i.e. every
    // docs page, derived from the content collection + the link graph) lands
    // in dist/sitemap-index.xml → sitemap-0.xml with a git-derived <lastmod>
    // (the date the source .md was last touched — src/lib/lastmod.mjs, the
    // same module DocLayout uses, so the two can never drift).
    sitemap({
      serialize(item) {
        const slug = new URL(item.url).pathname.replace(/^\/|\/$/g, "");
        const lastmod = getLastmodMap().get(slug);
        return lastmod ? { ...item, lastmod } : item;
      },
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  markdown: {
    rehypePlugins: [anchorHeadings],
    // Single dark theme — code blocks are dark terminals on the light paper
    // page (the brand pattern). global.css forces the ink-black background
    // and adds the brutal chrome.
    shikiConfig: {
      theme: "github-dark",
      wrap: false,
    },
  },
});
