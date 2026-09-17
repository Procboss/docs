# ProcBoss Docs

Documentation site for [pboss](https://github.com/Procboss/pboss) (the open-source universal process manager) and [ProcBoss Cloud](https://procboss.com).

Built with **Astro 5 + Tailwind CSS 4**, fully static — 29 HTML pages with only ~5 KB of inline progressive-enhancement JavaScript (code copy buttons + the search modal — no framework, no external JS files, site fully readable without JS). Hosted on **Cloudflare Pages**.

## Stack

| Piece | Choice |
|---|---|
| Framework | Astro 5 (static output, content collections) |
| Styling | Tailwind CSS 4 (Vite plugin) + typography plugin |
| Syntax highlighting | Shiki, dual themes (`github-light` / `github-dark`) switched by CSS custom properties |
| Search | [Pagefind](https://pagefind.app/) — static index built into `dist/pagefind/` after `astro build`; custom modal UI, core lazy-loaded only on first search |
| JS shipped | ~5 KB inline: code copy buttons + search modal. The Pagefind search core (~30 KB gzipped) is fetched only when a visitor actually searches. Mobile nav is a `<details>` element; TOC is plain anchors |

## Repository layout

```text
src/
├── config.ts               # site facts, sidebar sections
├── content.config.ts       # docs collection (title/description/section/order)
├── content/docs/           # ← the actual documentation (Markdown)
│   ├── intro.md            # served at /
│   ├── installation.md  quickstart.md  runtimes.md
│   ├── cli/                # processes, cluster, logs, monitoring, dashboard,
│   │                       # ecosystem, env, deploy, startup, modules, daemon
│   ├── guide/              # docker, config, dashboard-api, prometheus,
│   │                       # programmatic-api
│   ├── cloud/              # link-server, agent-api (+ cloud.md at top level)
│   ├── architecture.md     # how the CLI/daemon/containers fit together
│   ├── recipes.md          # cookbook: prod, watch, cron, deploys, code
│   └── troubleshooting.md
├── layouts/DocLayout.astro # header + sidebar + prose + TOC + prev/next
│                          #   (marks `data-pagefind-body` — the search index scope)
├── components/             # Header, Sidebar, Toc, PrevNext, Search (Pagefind
│                          #   modal, ⌘K), ThemeInit, ClientEnhancements
│                          #   (copy buttons)
└── styles/global.css       # Tailwind + shiki dual-theme + prose + search styles
astro.config.mjs            # + custom rehype anchor plugin (github-slugger)
```

## Search

Site search is [Pagefind](https://pagefind.app/) with a custom modal UI (`src/components/Search.astro`) — open it from the header button, **⌘K / Ctrl+K**, or `/`. Results are page + section-level, keyboard-navigable (`↑↓` / `↵` / `esc`).

- **Indexing**: `bun run build` runs `astro build && pagefind --site dist` — the index lands in `dist/pagefind/` and deploys as plain static files. Nothing to configure on Cloudflare Pages.
- **Scope**: `data-pagefind-body` on `<main>` in DocLayout — only page content is indexed (headers/sidebars/TOC stay out); the `<h1>` is the result title; the 404 page is excluded.
- **Cost**: the search core is imported on the first open of the modal — visitors who never search never download it. Without JavaScript the site is fully readable; the trigger is inert.
- **Dev server caveat**: `bun run dev` serves no index — the modal explains this honestly. Use `bun run build && bun run preview` to try search locally.

To add a page: drop a Markdown file into `src/content/docs/` with frontmatter `title`, `section` (one of the keys in `src/config.ts`), and `order`. It appears in the sidebar, prev/next, and gets `/slug` routing automatically — **and in the sitemap, `llms.txt`, `llms-full.txt`, `rss.xml`, and its `.md` mirror with zero extra work** (all generated from the collection at build time).

## SEO + LLM/AI surfaces

Every surface below is **generated at build time from the content collection** — a new page appears everywhere the moment it is written. All pinned by `scripts/test-seo.ts` (878 checks, runs after `bun run build`).

| Surface | What it is |
|---|---|
| `/sitemap-index.xml` → `/sitemap-0.xml` | Automatic sitemap (`@astrojs/sitemap`) — every static route, absolute URLs, git-derived `<lastmod>` per page |
| `/robots.txt` | Open to all crawlers — AI/LLM bots (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot, …) explicitly welcomed, sitemap + `llms.txt` declared |
| `/llms.txt` | The [llmstxt.org](https://llmstxt.org) map for LLMs: H1 + summary, every page linked with its description, plus the Optional block (full dump, RSS, GitHub) |
| `/llms-full.txt` | The whole site as ONE markdown document — every page's H1 + `> Source: <url>` + body |
| `/<slug>.md` | Every page as raw markdown at its URL + `.md` (Anthropic-docs-style). `noindex` via `_headers` — HTML stays canonical for search engines |
| `/rss.xml` | Dependency-free RSS 2.0, one item per page, `pubDate` = git lastmod |
| `/og.png` | 1200×630 branded Open Graph card (regenerate: `agent-browser set viewport 1200 630` → open `scripts/og-image.html` → screenshot `public/og.png`) |

Per-page head: canonical + `og:url` (trailing-slash, directory build), `og:site_name` / `og:image` (+width/height/alt) / `og:locale`, the `twitter:card` suite (`summary_large_image`), `article:section` + `article:modified_time` (git lastmod), `theme-color`, RSS + markdown `<link rel="alternate">`s, and one JSON-LD `@graph`: **WebSite + Organization + TechArticle + BreadcrumbList** (the index adds **SoftwareApplication** for pboss). Builders live in `src/lib/seo.ts`; the shared lastmod lives in `src/lib/lastmod.mjs` (git → mtime → now, fail-soft).

## Development

```bash
bun install
bun run dev        # http://localhost:4321
bun run build      # static site in dist/
bun run preview    # serve dist/ locally
```

> When changing `astro.config.mjs` (markdown/rehype settings), clear the render cache: `rm -rf .astro node_modules/.astro` — Astro 5's content layer caches rendered Markdown in `node_modules/.astro/` and won't re-render on config changes alone (clearing `.astro` alone is NOT enough; this repo learned it the hard way).

## Deploying to Cloudflare Pages

The site is 100% static — no server, no functions, no headers needed.

### Git integration (recommended)

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
2. Select the `Procboss/docs` repository.
3. Build settings:
   - **Framework preset:** Astro
   - **Build command:** `bun run build`
   - **Build output directory:** `dist`
   - Build image: Ubuntu 22.04; install Bun with the official setup, or set the build command to:
     `curl -fsSL https://bun.sh/install | bash && ~/.bun/bin/bun install && ~/.bun/bin/bun run build`
4. Save and deploy. Subsequent pushes to `main` deploy automatically.

### Direct upload (no CI)

```bash
bun run build
npx wrangler pages deploy dist --project-name=procboss-docs
```

Point your custom domain (e.g. `docs.procboss.com`) at the Pages project — `site` in `astro.config.mjs` is already set to `https://docs.procboss.com` for canonical URLs.

## Content sources

CLI reference content is derived from [pboss DOCS.md](https://github.com/Procboss/pboss/blob/main/DOCS.md) (the full manual previously shipped as the README — the README is now a short intro that points here) and kept in sync manually — when pboss gains flags or commands, update the matching page under `src/content/docs/cli/`. Cloud pages document the `pboss login` device flow and agent API implemented on procboss.com. This site at **docs.procboss.com** is the canonical home for all ProcBoss documentation.

## License

Documentation content is licensed alongside the pboss project (GPLv3). The site scaffolding itself is plain Astro/Tailwind — reuse freely.
