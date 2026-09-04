# ProcBoss Docs

Documentation site for [pboss](https://github.com/Procboss/pboss) (the open-source universal process manager) and [ProcBoss Cloud](https://procboss.com).

Built with **Astro 5 + Tailwind CSS 4**, fully static — 25 HTML pages, **zero client-side JavaScript**, ~900KB of output. Dark/light mode via `prefers-color-scheme` with build-time dual-theme syntax highlighting (Shiki). Hosted on **Cloudflare Pages**.

## Stack

| Piece | Choice |
|---|---|
| Framework | Astro 5 (static output, content collections) |
| Styling | Tailwind CSS 4 (Vite plugin) + typography plugin |
| Syntax highlighting | Shiki, dual themes (`github-light` / `github-dark`) switched by CSS custom properties |
| Search | — (nav-first structure; add Pagefind later if needed) |
| JS shipped | 0 bytes. Mobile nav is a `<details>` element; TOC is plain anchors |

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
│   └── troubleshooting.md
├── layouts/DocLayout.astro # header + sidebar + prose + TOC + prev/next
├── components/             # Header, Sidebar, Toc, PrevNext
└── styles/global.css       # Tailwind + shiki dual-theme + prose tweaks
astro.config.mjs            # + custom rehype anchor plugin (github-slugger)
```

To add a page: drop a Markdown file into `src/content/docs/` with frontmatter `title`, `section` (one of the keys in `src/config.ts`), and `order`. It appears in the sidebar, prev/next, and gets `/slug` routing automatically.

## Development

```bash
bun install
bun run dev        # http://localhost:4321
bun run build      # static site in dist/
bun run preview    # serve dist/ locally
```

> When changing `astro.config.mjs` (markdown/rehype settings), clear the render cache: `rm -rf .astro` — Astro's content layer caches rendered Markdown and won't re-render on config changes alone.

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

CLI reference content is derived from the [pboss README](https://github.com/Procboss/pboss) (v1.1.0) and kept in sync manually — when pboss gains flags or commands, update the matching page under `src/content/docs/cli/`. Cloud pages document the `pboss login` device flow and agent API implemented on procboss.com.

## License

Documentation content is licensed alongside the pboss project (GPLv3). The site scaffolding itself is plain Astro/Tailwind — reuse freely.
