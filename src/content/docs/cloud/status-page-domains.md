---
title: Status page domains
description: The multi-tenant hostname layer — a configurable main landing domain, default slug subdomains, verified custom domains via CNAME, and hostname routing that never special-cases a host.
section: cloud
order: 7
---

The status page isn't one URL — it's a hostname scheme. Every org's page answers on three kinds of addresses at once, and the whole scheme follows one configuration knob with zero code changes:

```env
STATUS_MAIN_DOMAIN=status.zone
STATUS_PROTOCOL=https
```

| Request | Behavior |
|---|---|
| `status.zone` | The status product's landing page (marketing) |
| `google.status.zone` | The org with slug `google` — its status page |
| `unknown.status.zone` | Redirect to `https://status.zone` |
| `status.google.com` | Google's page **if registered + verified** |
| `pending.google.com` | Registered but unverified — quiet "not verified yet" note |
| `random.example.com` | Redirect to `https://status.zone` |
| `procboss.com`, localhost, preview hosts | Untouched — the app itself |

Change `STATUS_MAIN_DOMAIN` to `status.example.com` and every default address becomes `<slug>.status.example.com` automatically. Nothing about the scheme is hardcoded.

## The resolution order

Every incoming request's `Host` header is classified by one module (`src/lib/status-domains.ts`) and routed by the proxy — no page in the app special-cases hostnames:

1. **Main domain** (`STATUS_MAIN_DOMAIN`) — `/` rewrites to the status landing; every other path redirects to the main root. The main domain is a marketing host; the landing is all it serves.
2. **Default subdomain** (exactly one label under the main domain) — `/` rewrites to the path route `/status/<slug>`; other paths redirect to the subdomain root. An unknown slug doesn't 404 — the visitor is redirected to the main landing (a mistyped subdomain should never dead-end). Deeper labels (`a.b.status.zone`) are not status addresses.
3. **Custom or unknown hostname** — everything else rewrites to the resolver, which asks the database. A registered **verified** custom domain renders its org's page. A registered **unverified** one renders an anonymous "not verified yet" note — never fleet data. A stranger is redirected to the main domain.
4. **App hostnames** (`APP_HOSTNAMES` — `procboss.com`, loopback, the preview wildcard) are passed through untouched: the dashboard, login, and landing behave exactly as before.

The proxy is string-only by design — no database in the request path before routing. The two questions that need the DB ("does this slug exist", "is this hostname registered") are answered by the routes the rewrites land on.

## Custom domains

An owner adds a hostname in **Settings → Status page → domains** and points DNS at the default address:

```
status.google.com   CNAME   google.status.zone
```

Verification runs live from the dashboard's **Verify** button: a public DNS lookup must return a CNAME targeting either the org's default subdomain (`<slug>.<main domain>`) or the bare main domain — both prove DNS control and both route to the app. On success the domain flips to **verified** and starts serving immediately; until then it renders nothing but the quiet pending note.

The stored model is built for more verification methods later:

```
status_page_domains: id · organizationId · domain (UNIQUE) · verified ·
                    verifiedAt · verificationMethod ("dns-cname") · createdAt
```

`domain` is stored normalized — lowercase, no port, no trailing dot, no brackets — and carries a unique index, so one hostname can only ever serve one status page. Lookups on the hot path are single indexed reads.

## Limits and guards

- Custom domains are rejected if they're the main domain, inside its subdomain space (those addresses exist by construction), an app hostname, a loopback/internal name, or an IP.
- Max 10 custom domains per status page (hygiene, not a plan gate — status pages are the free tier's public surface).
- Foreign hostnames never reach app routes: any path on a custom domain renders the org's page (or the redirect), so a customer's domain can't leak the ProcBoss dashboard.
- Path-based visits keep the classic behavior: `/status/<unknown>` on the app domain is still a 404, `/status/<slug>` still works everywhere the subdomain can't.
