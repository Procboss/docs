---
title: ProcBoss Cloud
description: Link the servers you already run to procboss.com and get fleet visibility, alerts, and metrics from one dashboard — without giving up the CLI.
section: cloud
order: 1
---

ProcBoss Cloud is the hosted layer on top of pboss. You keep running your servers exactly as you do today — the same pboss CLI, the same ecosystem files, the same startup scripts. Link a machine once, and it starts reporting heartbeats to your procboss.com account, where you get:

- **Fleet dashboard** — every linked server in one place: status, CPU, memory, and the full process list of each machine.
- **Alerts** — know when a server goes offline, a process crashes, or a machine's resources run dry.
- **Uptime history** — how your machines behaved over time, not just right now.
- **Zero lock-in** — the CLI keeps working if the machine goes offline or you unlink it. The cloud layer only adds visibility; process control always runs on the machine itself.

## How linking works

```bash
pboss login
```

One command, npm-login style:

1. The CLI generates a device code and opens your browser at `procboss.com/link` with a short code like `PBSS-4F2A`.
2. You sign in (GitHub or Google OAuth) and confirm the machine on the approval card — hostname, OS, Bun version, and agent version are shown before you approve.
3. The CLI receives its tokens and stores them locally (`~/.config/pboss/credentials.json`, mode `0600`). The machine appears in your fleet.

No secrets are pasted around, and the approval expires after 10 minutes. The full flow, token lifecycle, and revocation are covered in [Linking a server](/cloud/link-server).

## What the agent does

Once linked, the machine reports a heartbeat every 15 seconds: server metrics (CPU, memory, status) and the process list, keyed by `pmId` so renames and removals flow through naturally. The access token is a short-lived JWT (15 minutes) renewed automatically from a long-lived refresh token (30 days) — all of it revocable per machine from your account.

Heartbeats are read-only reporting. Process control still flows through the pboss daemon on the machine — the cloud never executes commands on your servers.

## Plans

ProcBoss Cloud pricing and tier details live on [procboss.com](https://procboss.com). The pboss CLI itself is and stays open source (GPLv3) — the CLI's process management features do not require a cloud account.

## Where to go next

- [Linking a server](/cloud/link-server) — the device flow and token security model in detail.
- [Agent API](/cloud/agent-api) — the HTTP surface a linked agent speaks, for custom integrations.
