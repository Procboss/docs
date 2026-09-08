import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import GithubSlugger from "github-slugger";

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
  return (tree) => {
    const slugger = new GithubSlugger();
    const walk = (node) => {
      if (Array.isArray(node.children)) node.children.forEach(walk);
      if (node.type !== "element") return;
      if (node.tagName !== "h2" && node.tagName !== "h3") return;
      if (node.properties?.id) return; // already slugged
      const text = node.children
        .filter((c) => c.type === "text")
        .map((c) => c.value)
        .join("");
      const id = slugger.slug(text);
      node.properties = { ...node.properties, id };
      node.children.push({
        type: "element",
        tagName: "a",
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
