#!/usr/bin/env bun
/**
 * test-seo.ts — the SEO + LLM surface of the built site, pinned.
 *
 * Owner rule: "For every update, write a test to confirm." This suite runs
 * against dist/ (build first: `bun run build`) and verifies:
 *
 *   1. robots.txt — open to all crawlers incl. named AI bots, sitemap link
 *   2. _headers — the machine mirrors (.md, llms.*) are noindex'd
 *   3. sitemap-index.xml + sitemap-0.xml — AUTOMATIC and COMPLETE: every
 *      docs page present, exactly, with absolute URLs, trailing slashes,
 *      ISO lastmods; no .md mirrors or 404 leaking in
 *   4. Link integrity (the "sitemap based on the links" contract): every
 *      internal href in every built page resolves to a real page or a real
 *      static asset — zero dead links
 *   5. llms.txt — every page listed with its canonical URL + description
 *   6. llms-full.txt — every page's H1 + Source URL + real body content
 *   7. .md mirrors — every page served as raw markdown at <id>.md
 *   8. rss.xml — valid RSS 2.0, one item per page, absolute links, self ref
 *   9. Per-page head — canonical/og:url agreement, og:site_name, og:image
 *      (1200x630) + alt, twitter:card suite, article:section/modified_time
 *  10. JSON-LD — @graph parses; WebSite+Organization+TechArticle+
 *      BreadcrumbList on every page, SoftwareApplication on the index;
 *      headline/dateModified agree with the meta tags
 *  11. og.png — exists, is a PNG, exactly 1200x630
 *  12. 404 — noindex
 *
 * Run: bun scripts/test-seo.ts   (exit 0 = all checks pass)
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

const HERE = dirname(import.meta.path);
const ROOT = join(HERE, "..");
const DIST = join(ROOT, "dist");
const DOCS_SITE = join(ROOT, "src", "content", "docs");
const ORIGIN = "https://docs.procboss.com";

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
  } else {
    failures.push(detail ? `${name} — ${detail}` : name);
  }
}

// --- the page set (the collection, walked by hand — no Astro import) ------
function mdFiles(dir: string, prefix = ""): Array<{ id: string; file: string }> {
  const out: Array<{ id: string; file: string }> = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...mdFiles(full, `${prefix}${entry}/`));
    else if (entry.endsWith(".md")) out.push({ id: `${prefix}${entry.replace(/\.md$/, "")}`, file: full });
  }
  return out;
}

const pages = mdFiles(DOCS_SITE);
const pageUrl = (id: string) => (id === "intro" ? `${ORIGIN}/` : `${ORIGIN}/${id}/`);
/** Slash-less form for link-graph comparison (anchors render without the
 *  trailing slash the directory build serves). */
const pageLink = (id: string) => (id === "intro" ? "/" : `/${id}`);
const htmlFile = (id: string) => join(DIST, id === "intro" ? "index.html" : `${id}/index.html`);

/** Minimal HTML-entity decode — titles like "Monitoring & metrics" render as
 *  "Monitoring &amp; metrics" in meta attributes. */
const unescape = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&") // Astro's attribute escaper emits this form
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&#34;/g, '"');

function frontmatter(file: string): Record<string, string> {
  const m = readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/);
  const out: Record<string, string> = {};
  if (m) {
    for (const line of m[1].split("\n")) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (kv) out[kv[1]] = kv[2].trim();
    }
  }
  return out;
}

// guard: the build must exist
ok("dist exists (run `bun run build` first)", existsSync(DIST));

// ---------------------------------------------------------------------------
// 1. robots.txt
// ---------------------------------------------------------------------------
const robotsPath = join(DIST, "robots.txt");
ok("robots.txt built", existsSync(robotsPath));
if (existsSync(robotsPath)) {
  const robots = readFileSync(robotsPath, "utf8");
  ok("robots: wildcard allow", /User-agent: \*\s*\nAllow: \//.test(robots));
  for (const bot of ["GPTBot", "ClaudeBot", "anthropic-ai", "PerplexityBot", "Google-Extended", "CCBot"]) {
    ok(`robots: AI bot ${bot} explicitly allowed`, new RegExp(`User-agent: ${bot}\\s*\\nAllow: /`).test(robots));
  }
  ok("robots: sitemap declared", robots.includes(`Sitemap: ${ORIGIN}/sitemap-index.xml`));
  ok("robots: llms.txt surfaced", robots.includes("llms.txt"));
}

// ---------------------------------------------------------------------------
// 2. _headers
// ---------------------------------------------------------------------------
const headersPath = join(DIST, "_headers");
ok("_headers built", existsSync(headersPath));
if (existsSync(headersPath)) {
  const h = readFileSync(headersPath, "utf8");
  ok("headers: .md mirrors noindex", /\/\*\.md[\s\S]*?X-Robots-Tag: noindex/.test(h));
  ok("headers: llms.txt noindex", /\/llms\.txt[\s\S]*?X-Robots-Tag: noindex/.test(h));
  ok("headers: markdown content-type forced", /Content-Type: text\/markdown/.test(h));
}

// ---------------------------------------------------------------------------
// 3. sitemap-index.xml + sitemap-0.xml — the automatic sitemap
// ---------------------------------------------------------------------------
const sitemapIndexPath = join(DIST, "sitemap-index.xml");
ok("sitemap-index.xml built", existsSync(sitemapIndexPath));
const sitemapPath = join(DIST, "sitemap-0.xml");
ok("sitemap-0.xml built", existsSync(sitemapPath));

let sitemapLocs: Array<{ loc: string; lastmod: string | null }> = [];
if (existsSync(sitemapPath)) {
  const sitemap = readFileSync(sitemapPath, "utf8");
  ok("sitemap: <urlset> root", sitemap.includes("<urlset") && sitemap.includes("</urlset>"));
  ok("sitemap: sitemap namespace", sitemap.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'));

  for (const block of sitemap.match(/<url>[\s\S]*?<\/url>/g) ?? []) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? "";
    const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? null;
    sitemapLocs.push({ loc, lastmod });
  }

  const locSet = new Set(sitemapLocs.map((e) => e.loc));
  ok("sitemap: page count matches collection", sitemapLocs.length === pages.length,
    `sitemap has ${sitemapLocs.length}, collection has ${pages.length}`);
  for (const page of pages) {
    ok(`sitemap: ${page.id} present`, locSet.has(pageUrl(page.id)));
  }
  ok("sitemap: no extra URLs", locSet.size === pages.length,
    [...locSet].filter((u) => !pages.some((p) => pageUrl(p.id) === u)).join(", "));
  ok("sitemap: all URLs absolute + canonical origin", sitemapLocs.every((e) => e.loc.startsWith(`${ORIGIN}/`)));
  ok("sitemap: trailing slashes (directory build)", sitemapLocs.every((e) => e.loc === `${ORIGIN}/` || e.loc.endsWith("/")));
  ok("sitemap: no .md mirrors", ![...locSet].some((u) => u.endsWith(".md")));
  ok("sitemap: no 404", !locSet.has(`${ORIGIN}/404`));
  ok("sitemap: every entry has lastmod", sitemapLocs.every((e) => e.lastmod !== null));
  ok("sitemap: lastmods are ISO-8601", sitemapLocs.every((e) => !e.lastmod || /^\d{4}-\d{2}-\d{2}T/.test(e.lastmod)));
  ok("sitemap: lastmods parse as dates", sitemapLocs.every((e) => !e.lastmod || !Number.isNaN(Date.parse(e.lastmod))));
  // real-data pin: the alerts doc was rewritten 2026-09-17 (Task 131)
  const alerts = sitemapLocs.find((e) => e.loc === `${ORIGIN}/cloud/alerts/`);
  ok("sitemap: alerts.md lastmod reflects the 2026-09-17 rewrite",
    !!alerts?.lastmod && alerts.lastmod >= "2026-09-17",
    `got ${alerts?.lastmod}`);
}
if (existsSync(sitemapIndexPath)) {
  const si = readFileSync(sitemapIndexPath, "utf8");
  ok("sitemap-index: references sitemap-0.xml", si.includes("<loc>") && si.includes("/sitemap-0.xml</loc>"));
  ok("sitemap-index: valid xml header", si.startsWith("<?xml"));
}

// ---------------------------------------------------------------------------
// 4. Link integrity — every internal href resolves (sitemap is complete)
// ---------------------------------------------------------------------------
const knownAssets = new Set([
  "/favicon.svg", "/og.png", "/rss.xml", "/llms.txt", "/llms-full.txt",
  "/robots.txt", "/sitemap-index.xml", "/sitemap-0.xml",
]);
const pageLinks = new Set(pages.map((p) => pageLink(p.id)));
const deadLinks: string[] = [];
const internalLinks = new Set<string>();

for (const page of pages) {
  const file = htmlFile(page.id);
  if (!existsSync(file)) continue;
  const html = readFileSync(file, "utf8");
  // Only ANCHOR hrefs — <link rel="stylesheet"/"canonical"/"alternate"> are
  // head metadata, not navigational links in the site's link graph.
  for (const href of html.match(/<a\s[^>]*href="([^"]*)"/g) ?? []) {
    const raw = href.match(/href="([^"]*)"/)?.[1] ?? "";
    if (!raw.startsWith("/") || raw.startsWith("//")) continue; // external / protocol-rel
    const clean = raw.split("#")[0].split("?")[0];
    if (clean === "") continue; // hash-only link
    const normalized = clean === "/" ? "/" : clean.replace(/\/$/, "");
    internalLinks.add(normalized);
    if (!pageLinks.has(normalized) && !knownAssets.has(normalized) && !normalized.startsWith("/pagefind/") && !normalized.startsWith("/_astro/")) {
      deadLinks.push(`${page.id} → ${raw}`);
    }
  }
}
ok("links: zero dead internal links", deadLinks.length === 0, deadLinks.slice(0, 5).join("; "));
ok("links: sidebar pages all cross-linked", [...pageLinks].every((p) => internalLinks.has(p)));

// ---------------------------------------------------------------------------
// 5. llms.txt — the LLM site map
// ---------------------------------------------------------------------------
const llmsPath = join(DIST, "llms.txt");
ok("llms.txt built", existsSync(llmsPath));
if (existsSync(llmsPath)) {
  const llms = readFileSync(llmsPath, "utf8");
  ok("llms.txt: H1 title", llms.startsWith("# ProcBoss Docs"));
  ok("llms.txt: blockquote summary", /\n> /.test(llms));
  for (const page of pages) {
    const fm = frontmatter(page.file);
    ok(`llms.txt: ${page.id} linked`, llms.includes(`[${fm.title}](${pageUrl(page.id)})`));
  }
  ok("llms.txt: full dump offered", llms.includes(`${ORIGIN}/llms-full.txt`.replace(ORIGIN, "https://docs.procboss.com")));
  ok("llms.txt: rss offered", llms.includes("/rss.xml"));
  ok("llms.txt: github offered", llms.includes("github.com/Procboss/pboss"));
  ok("llms.txt: .md suffix trick documented", llms.includes("`.md`"));
}

// ---------------------------------------------------------------------------
// 6. llms-full.txt — the whole site as one document
// ---------------------------------------------------------------------------
const llmsFullPath = join(DIST, "llms-full.txt");
ok("llms-full.txt built", existsSync(llmsFullPath));
if (existsSync(llmsFullPath)) {
  const full = readFileSync(llmsFullPath, "utf8");
  for (const page of pages) {
    const fm = frontmatter(page.file);
    ok(`llms-full: ${page.id} H1`, full.includes(`# ${fm.title}`));
    ok(`llms-full: ${page.id} source url`, full.includes(`> Source: ${pageUrl(page.id)}`));
  }
  // real-content spot checks (bodies really made it in, not just titles)
  ok("llms-full: quickstart body present", full.includes("pboss start app.ts"));
  ok("llms-full: agent-api body present", full.includes("GET /ws/agent"));
  ok("llms-full: page separators", full.split("\n---\n").length >= pages.length);
}

// ---------------------------------------------------------------------------
// 7. .md mirrors — every page as raw markdown
// ---------------------------------------------------------------------------
for (const page of pages) {
  const mdPath = join(DIST, `${page.id}.md`);
  ok(`md mirror: ${page.id}.md built`, existsSync(mdPath));
}
const qsMd = join(DIST, "quickstart.md");
if (existsSync(qsMd)) {
  const qs = readFileSync(qsMd, "utf8");
  const fm = frontmatter(join(DOCS_SITE, "quickstart.md"));
  ok("md mirror: quickstart starts with H1 title", qs.startsWith(`# ${fm.title}`));
  ok("md mirror: quickstart body intact", qs.includes("pboss start app.ts"));
  ok("md mirror: no frontmatter fence leaked", !qs.startsWith("---"));
}
const introMd = join(DIST, "intro.md");
ok("md mirror: intro.md built", existsSync(introMd));
if (existsSync(introMd)) {
  ok("md mirror: intro has no leaked frontmatter keys", !/^section:|^order:/.test(readFileSync(introMd, "utf8")));
}

// ---------------------------------------------------------------------------
// 8. rss.xml
// ---------------------------------------------------------------------------
const rssPath = join(DIST, "rss.xml");
ok("rss.xml built", existsSync(rssPath));
if (existsSync(rssPath)) {
  const rss = readFileSync(rssPath, "utf8");
  ok("rss: 2.0 declaration", rss.includes('<rss version="2.0"'));
  ok("rss: channel title + link", rss.includes("<title>ProcBoss Docs</title>") && rss.includes(`<link>${ORIGIN}/</link>`));
  ok("rss: atom self link", rss.includes('href="https://docs.procboss.com/rss.xml" rel="self"'));
  ok("rss: lastBuildDate", /<lastBuildDate>[A-Z][a-z]{2}, /.test(rss));
  const items = rss.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  ok("rss: one item per page", items.length === pages.length, `${items.length} vs ${pages.length}`);
  const itemLinks = items.map((i) => i.match(/<link>([^<]+)<\/link>/)?.[1] ?? "");
  ok("rss: every page linked", pages.every((p) => itemLinks.includes(pageUrl(p.id))));
  ok("rss: guids are permalinks", items.every((i) => i.includes("<guid isPermaLink=\"true\">")));
  ok("rss: pubDates present + RFC-822", items.every((i) => /<pubDate>[A-Z][a-z]{2}, \d/.test(i)));
  ok("rss: titles escaped-safe", !rss.includes("<title>&") || !/<title>[^<]*&(?!(amp|lt|gt|quot|apos|#))/.test(rss));
}

// ---------------------------------------------------------------------------
// 9 + 10. Per-page head: social meta + JSON-LD
// ---------------------------------------------------------------------------
const pngSize = (file: string) => {
  const b = readFileSync(file);
  return { isPng: b.length > 24 && b[0] === 0x89 && b[1] === 0x50, w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};
const ogFile = join(DIST, "og.png");
ok("og.png built", existsSync(ogFile));
if (existsSync(ogFile)) {
  const { isPng, w, h } = pngSize(ogFile);
  ok("og.png: PNG magic", isPng);
  ok("og.png: 1200x630", w === 1200 && h === 630, `${w}x${h}`);
}

for (const page of pages) {
  const file = htmlFile(page.id);
  if (!existsSync(file)) {
    ok(`head: ${page.id} built`, false);
    continue;
  }
  const html = readFileSync(file, "utf8");
  const fm = frontmatter(page.file);
  const meta = (prop: string) =>
    unescape(html.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`))?.[1] ?? "");
  const canonical = unescape(html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? "");

  ok(`head: ${page.id} canonical`, canonical === pageUrl(page.id), `got ${canonical}`);
  ok(`head: ${page.id} og:url == canonical`, meta("og:url") === canonical);
  ok(`head: ${page.id} og:site_name`, meta("og:site_name") === "ProcBoss Docs");
  ok(`head: ${page.id} og:image absolute`, meta("og:image") === `${ORIGIN}/og.png`);
  ok(`head: ${page.id} og:image dimensions`, meta("og:image:width") === "1200" && meta("og:image:height") === "630");
  ok(`head: ${page.id} og:image:alt`, (meta("og:image:alt") ?? "").length > 20);
  ok(`head: ${page.id} og:locale`, meta("og:locale") === "en");
  ok(`head: ${page.id} twitter:card`, meta("twitter:card") === "summary_large_image");
  ok(`head: ${page.id} twitter:title`, meta("twitter:title") === fm.title);
  ok(`head: ${page.id} twitter:image`, meta("twitter:image") === `${ORIGIN}/og.png`);
  ok(`head: ${page.id} article:section`, (meta("article:section") ?? "").length > 0);
  const mod = meta("article:modified_time");
  ok(`head: ${page.id} article:modified_time ISO`, !!mod && !Number.isNaN(Date.parse(mod)));

  // JSON-LD
  const ldRaw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  ok(`ld: ${page.id} present`, !!ldRaw);
  if (ldRaw) {
    let ld: any;
    try {
      ld = JSON.parse(ldRaw);
    } catch (e) {
      ok(`ld: ${page.id} parses`, false, String(e));
      continue;
    }
    const types = (ld["@graph"] ?? []).map((n: any) => n["@type"]);
    for (const t of ["WebSite", "Organization", "TechArticle", "BreadcrumbList"]) {
      ok(`ld: ${page.id} has ${t}`, types.includes(t));
    }
    const article = (ld["@graph"] ?? []).find((n: any) => n["@type"] === "TechArticle");
    ok(`ld: ${page.id} headline matches`, article?.headline === fm.title);
    ok(`ld: ${page.id} dateModified == meta`, article?.dateModified === mod);
    ok(`ld: ${page.id} article url canonical`, article?.url === canonical);
    ok(`ld: ${page.id} isPartOf website`, article?.isPartOf?.["@id"] === `${ORIGIN}/#website`);
    const bc = (ld["@graph"] ?? []).find((n: any) => n["@type"] === "BreadcrumbList");
    ok(`ld: ${page.id} breadcrumb two steps`, bc?.itemListElement?.length === 2);
    ok(`ld: ${page.id} breadcrumb ends here`, bc?.itemListElement?.[1]?.item === canonical);
    if (page.id === "intro") {
      ok("ld: index has SoftwareApplication", types.includes("SoftwareApplication"));
      const app = (ld["@graph"] ?? []).find((n: any) => n["@type"] === "SoftwareApplication");
      ok("ld: SoftwareApplication offers free", app?.offers?.price === "0");
    }
  }
}

// ---------------------------------------------------------------------------
// 12. 404
// ---------------------------------------------------------------------------
const notFound = join(DIST, "404.html");
ok("404 built", existsSync(notFound));
if (existsSync(notFound)) {
  ok("404: noindex", readFileSync(notFound, "utf8").includes('name="robots" content="noindex"'));
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log(`docs seo: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error("\nFAILED checks:");
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
