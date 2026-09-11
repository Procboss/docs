---
title: ProcBoss Cloud
description: Link the servers you already run to procboss.com and get fleet visibility, alerts, and remote control — without giving up the CLI or opening a single port.
section: cloud
order: 1
---

ProcBoss Cloud is the hosted layer on top of pboss. You keep running your servers exactly as you do today — the same pboss CLI, the same ecosystem files, the same startup scripts. Link a machine once and it streams live state to your procboss.com account, where you get:

- **Fleet dashboard** — every linked server in one place: status, CPU, memory, and the full process list of each machine, live.
- **Remote process control** — restart, stop, start, delete, and read logs from the dashboard or your phone. Commands travel over the agent's own outbound connection; you never open a port.
- **Alerts** — know when a server goes offline, a process crashes, or restarts pile up — delivered to the dashboard's Alerts view **and** to the Telegram chat and Discord webhook you connect (see [Notifications](/cloud/notifications)).
- **CLI fleet view** — `pboss cloud servers` shows the same fleet your dashboard shows, with live presence.
- **Zero lock-in** — the CLI keeps working if the machine goes offline or you unlink it. Every local feature (processes, logs, cron, persistence, deployment) runs without an account; the cloud layer is purely additive.

## How linking works

Servers have no browser, so pboss uses a **device-code flow** — the same pattern as `gh auth login`:

```bash
pboss cloud connect
```

1. The CLI prints a URL (`procboss.com/connect`) and a short code like `F7KD-92XM`, then polls.
2. You open the URL **on any device** (laptop, phone), sign in with GitHub or Google, and approve the card — which shows the machine's hostname, OS, arch, and agent version before you approve anything.
3. The CLI claims its per-server credential (minted at that moment, handed over exactly once) and hands it to the daemon, which stores it in `~/.pboss/cloud.json` (0600) and owns the connection from there on.

No secrets pasted through terminals, no passwords on the server, codes that expire in 10 minutes. `pboss login` is a separate, **user-scope** login for the CLI itself (`pboss whoami` / `pboss logout`) — machine and user identities are independent and revocable separately. The full flow, token model, and revocation semantics are covered in [Linking a server](/cloud/link-server).

## Sign-in origins

Accounts are OAuth-only (GitHub or Google) — the dashboard never sees a password. The sign-in redirect is only ever minted for origins a deployment actually operates: loopback dev hosts, `*.space-z.ai` previews, the `APP_URL` pin, and an allowlist of production hosts (`procboss.com`, `www.procboss.com`, `cloud9000.procboss.com`). A deployment served through another gateway adds it with `OAUTH_ALLOWED_HOSTS` (comma-separated) — otherwise sign-in from that host bounces to `/login?error=unsafe_origin` before the provider is contacted, and a forged `Host` header can never aim the OAuth round-trip at a foreign domain.

## Sign-in hardening

Two further guarantees hold on every sign-in round-trip. The post-login destination (`?next=…`, parked in a cookie for the provider hop) is validated as a same-site relative path — `//evil.com`, `https://…`, and `/\evil` are rejected and the callback falls back to `/dashboard`, so the flow can never be turned into an open redirect. And every response the app sends — the OAuth 307s included — carries the security-header set (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS) from the app itself, with the nginx gateway repeating its edge trio in every `add_header`-carrying location.

## What the agent does

Once linked, the daemon's cloud agent keeps one **outbound-only WebSocket** (`/ws/agent`): commands flow cloud → machine, state reports (every 10 seconds: server metrics + the process list) flow machine → cloud. Process commands (`process.list/start/stop/restart/delete/logs/deploy`, `server.info`, `server.deploy`) execute through the same daemon that runs your local CLI — the dashboard is just another client of your machine's process engine.

If the agent loses the connection it reconnects automatically with exponential backoff; if the credential is revoked, the agent stops, wipes `cloud.json`, and says so at the terminal.

## Plans

ProcBoss Cloud pricing and tier details live on [procboss.com](https://procboss.com). The pboss CLI itself is and stays open source (GPLv3) — the CLI's process management features do not require a cloud account.

## Where to go next

- [Linking a server](/cloud/link-server) — the device flow, the two credential spaces, and the security model in detail.
- [Notifications](/cloud/notifications) — connect Telegram and Discord, alert preferences, and the webhook security model.
- [Agent API](/cloud/agent-api) — the HTTP surface a linked agent speaks, for custom integrations and self-hosting.
