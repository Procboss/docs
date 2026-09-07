---
title: ProcBoss Cloud
description: Link the servers you already run to procboss.com and get fleet visibility, alerts, and remote control — without giving up the CLI or opening a single port.
section: cloud
order: 1
---

ProcBoss Cloud is the hosted layer on top of pboss. You keep running your servers exactly as you do today — the same pboss CLI, the same ecosystem files, the same startup scripts. Link a machine once and it streams live state to your procboss.com account, where you get:

- **Fleet dashboard** — every linked server in one place: status, CPU, memory, and the full process list of each machine, live.
- **Remote process control** — restart, stop, start, delete, and read logs from the dashboard or your phone. Commands travel over the agent's own outbound connection; you never open a port.
- **Alerts** — know when a server goes offline, a process crashes, or restarts pile up.
- **CLI fleet view** — `pboss cloud servers` shows the same fleet your dashboard shows, with live presence.
- **Zero lock-in** — the CLI keeps working if the machine goes offline or you unlink it. Every local feature (processes, logs, cron, persistence, deployment) runs without an account; the cloud layer is purely additive.

## How linking works

Servers have no browser, so pboss uses a **device-code flow** — the same pattern as `gh auth login`:

```bash
sudo pboss cloud connect
```

1. The CLI prints a URL (`procboss.com/connect`) and a short code like `F7KD-92XM`, then polls.
2. You open the URL **on any device** (laptop, phone), sign in with GitHub or Google, and approve the card — which shows the machine's hostname, OS, arch, and agent version before you approve anything.
3. The CLI claims its per-server credential (minted at that moment, handed over exactly once) and hands it to the daemon, which stores it in `~/.pboss/cloud.json` (0600) and owns the connection from there on.

No secrets pasted through terminals, no passwords on the server, codes that expire in 10 minutes. `pboss login` is a separate, **user-scope** login for the CLI itself (`pboss whoami` / `pboss logout`) — machine and user identities are independent and revocable separately. The full flow, token model, and revocation semantics are covered in [Linking a server](/cloud/link-server).

## What the agent does

Once linked, the daemon's cloud agent keeps an **outbound-only** connection: an SSE command stream (commands flow cloud → machine) plus state reports every 10 seconds (machine → cloud: server metrics and the process list). Process commands (`process.list/start/stop/restart/delete/logs`, `server.info`) execute through the same daemon that runs your local CLI — the dashboard is just another client of your machine's process engine.

If the agent loses the connection it reconnects automatically with exponential backoff; if the credential is revoked, the agent stops, wipes `cloud.json`, and says so at the terminal.

## Plans

ProcBoss Cloud pricing and tier details live on [procboss.com](https://procboss.com). The pboss CLI itself is and stays open source (GPLv3) — the CLI's process management features do not require a cloud account.

## Where to go next

- [Linking a server](/cloud/link-server) — the device flow, the two credential spaces, and the security model in detail.
- [Agent API](/cloud/agent-api) — the HTTP surface a linked agent speaks, for custom integrations and self-hosting.
