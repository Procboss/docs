---
title: Notifications
description: Connect Telegram and Discord to ProcBoss Cloud — crash, deploy and server alerts where you already are, with a one-time pairing code and verified webhooks.
section: cloud
order: 4
---

Once a server is linked, ProcBoss Cloud can page you when things go wrong: a process crashes, a deploy fails, a server drops offline or comes back. Alerts go to the channels you connect — Telegram and Discord — plus the dashboard's Alerts view. Nothing is enabled by accident: a channel only receives alerts after you connect it, and each event class has its own on/off switch.

## Telegram

Telegram pairing follows the same philosophy as `pboss cloud connect`: no tokens pasted through terminals, and the proof of intent is a short-lived code.

1. In the dashboard, open **Settings → Integrations → Connect Telegram** — or link straight from onboarding: the last onboarding step offers it (connect now, or skip — the same flow waits in Settings).
2. The panel shows a one-time code (6 characters, 15 minutes) and an **Open Telegram** button — `t.me/<bot>?start=<code>` opens the chat with the code pre-filled.
3. Send the message (or just tap Start in the opened chat). The bot replies "Connected to ProcBoss" and the dashboard flips to **linked** within a couple of seconds — no refresh needed.

From then on the chat receives crash alerts, deploy results, restart notices, resource-threshold warnings and server up/down transitions. The bot is also a remote control: the same agent channel the dashboard uses carries its commands, with the confirmation habit of a production tool.

### Bot commands

The `/` menu in any chat with the bot lists them (the menu is code-defined — `scripts/set-telegram-webhook.ts` pushes it with `setMyCommands`, so it never drifts from what the bot actually answers).

| Command | What it does |
| --- | --- |
| `/status` | Fleet summary — per server: cpu, memory, process count; per process: state, cpu, memory, uptime |
| `/health` | Host health — OS, agent version, last-seen age, memory pressure, open alerts |
| `/logs <name> [lines]` | Tail a process log straight from the machine (default 30, 10–100) |
| `/alerts` | Recent alerts, open ones first |
| `/restart <name>` | Restart a process — asks first (Confirm button) |
| `/stop <name>` | Stop a process — asks first (Confirm button) |
| `/kill <name>` | Force-kill (SIGKILL) — type the process name back to confirm |
| `/menu`, `/help` | The command list |
| `/unlink` | Disconnect this chat (processes are untouched) |

Names that exist on more than one server are pinned with `name@server` — the bot's ambiguity reply shows a ready-to-copy example. Control commands (`/restart`, `/stop`, `/kill`) and `/logs` follow the dashboard's plan gates: trials and subscriptions operate, free accounts monitor.

Every control command carries three guards before anything moves: the update must be **signed** (the webhook secret), the chat must be **linked** to the account that owns the target, and a **confirmation** must complete — a tap on an inline Confirm button (2-minute validity, single-use), or the exact process name typed back for `/kill`. `process.kill` is the SIGKILL path: no graceful shutdown, no cleanup handlers — the process row survives and can be started again.

If the deployment has no bot configured (`TELEGRAM_BOT_TOKEN` unset), the panel says so instead of showing a broken pairing flow.

### Server-side setup (self-hosters / the bot owner)

The bot's environment is part of the deployment's own `.env` — the file is **untracked** (each deployment keeps its own copy; the key contract lives in the tracked `.env.example.txt` / `.env.example2.txt` templates, and every key added to a local `.env` must be mirrored into both).

```bash
# one-time: create the bot with @BotFather, then put in .env
#   TELEGRAM_BOT_TOKEN=123456:…           (from @BotFather)
#   TELEGRAM_WEBHOOK_SECRET=…             (openssl rand -hex 32)
# and register the webhook:
bun scripts/set-telegram-webhook.ts \
  --url https://procboss.com
```

The script registers `POST /api/integrations/telegram/webhook` with Telegram, sets a shared secret (`TELEGRAM_WEBHOOK_SECRET`), and syncs the command menu (`setMyCommands`).

- Every update Telegram delivers carries the `X-Telegram-Bot-Api-Secret-Token` header; forged updates are rejected with 401 — unsigned updates can never read fleet state or run control commands.
- Without a configured secret the webhook runs in a reduced dev mode: pairing still works (knowing the code is the proof), but `/status`, `/unlink` and every control command refuse to run unsigned.
- One bot token carries ONE webhook URL — registering from a different deployment moves the webhook there. Register from the deployment that should receive your chats' messages.
- The webhook listens for both `message` updates (commands) and `callback_query` updates (the Confirm buttons).

## Discord

Discord uses **incoming webhooks** — no bot token, no OAuth round-trip:

1. In your Discord server: channel settings → Integrations → **Create Webhook**, copy the URL.
2. Paste it into **Settings → Integrations → Discord** and click Connect.

ProcBoss verifies the webhook before saving it by posting a "ProcBoss connected" embed to the channel — if the embed doesn't arrive, the URL is rejected and nothing is stored. Alerts arrive as embeds color-coded by severity (red critical / amber warning / green info).

Only `https://discord.com` / `discordapp.com` webhook URLs are accepted. Self-hosted relays can extend the list with `DISCORD_WEBHOOK_ALLOWED_HOSTS` (comma-separated; those entries may use plain http since you opted in explicitly).

## Alert preferences

**Settings → Integrations → Alert preferences** controls which events reach your connected channels:

| Preference | Events |
| --- | --- |
| Process crashes | a process transitions to errored (crash, restart budget exhausted) — also the restart notices ("api restarted", recovery included) |
| Deployments | deploy shipped / deploy failed |
| Server up & down | agent offline (no state report for 45s) / back online — also CPU (≥ 90%) and memory (≥ 92%) threshold warnings, which alert once per crossing and re-arm only after the value drops 10 points below the threshold |

Each test button sends a real message through the channel it belongs to — if delivery fails, the panel shows the recorded error (e.g. a revoked Discord webhook) instead of pretending it worked.

## What the alert looks like

```text
🚨 payment-worker crashed
production-1 · process exited unexpectedly

✅ payment-worker restarted
production-1 · restart #4

⚠️ production-1 CPU at 96%
Sustained CPU above the 90% threshold.

✅ production-1 is back online
Agent reconnected and is reporting state again.

🚀 Deploy 8f12ca3 shipped to production-1
fix: retry after 429 — 6.1s, health checks green.
```

The dashboard's Alerts view records every event with an honest channel label — `telegram+discord` means both channels confirmed delivery; `none` means the event fired but no channel accepted it (you'll see why in the panel).

## Security notes

- Telegram chat ids and Discord webhook URLs are stored on your Integration row, never returned raw by the API (the dashboard shows masked forms — enough to recognize, not to replay).
- The Telegram webhook is the only public endpoint in the chain and it verifies a shared secret on every update.
- Channels are per-user: disconnecting a server, rotating a credential, or signing out sessions never touches them, and vice versa.
