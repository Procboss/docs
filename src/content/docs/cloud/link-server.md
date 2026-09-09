---
title: Linking a server
description: The pboss cloud connect device flow step by step, the machine/user credential split, storage, and revocation.
section: cloud
order: 2
---

`pboss cloud connect` links a machine to your procboss.com account using a device authorization flow — the same pattern as `gh auth login`. It's designed for headless servers: no browser on the box, no secrets through terminals or clipboards.

## The flow

```text
CLI (on the server)          procboss.com                browser (any device)
────────────────────────────────────────────────────────────────────────────
POST /api/device/code ─────▶ DeviceLogin(pending)
      prints URL + F7KD-92XM                              GET /connect
                              ◀────────────────────────  enter code, sign in
                              ◀── POST …/approve ───────  Approve card (facts!)
POST /api/device/token  ──▶ pending… pending…
                              approved → mint secret
      ◀── credential (once!)
      → daemon: cloud.json (0600) + outbound link
```

Step by step:

1. **`pboss cloud connect`** — the CLI posts anonymous machine facts (hostname, OS, arch, agent version) to `POST /api/device/code` and receives two codes: a secret **device code** (`pbd_…`, kept only by the CLI, stored server-side as a sha256 hash) and a human **user code** like `F7KD-92XM` — 8 chars from a confusable-free alphabet (no 0/O/1/I/L), ~40 bits of entropy, valid for **10 minutes**.
2. **Browser approval** — the CLI prints `Open: <cloud>/connect` and the code. On a desktop machine it also tries to open the tab (xdg-open/open/start; over plain SSH without a display it stays print-only — exactly right for servers; `--no-browser` or `PBOSS_NO_BROWSER=1` forces print). You open the URL on any device, sign in with GitHub or Google, and see the approval card: hostname, OS, arch, and agent version — **what you're actually linking** — with Approve/Deny. If you weren't signed in, the sign-in round-trip brings you straight back to the card.
3. **Claim** — the CLI polls `POST /api/device/token`. On approval, the cloud mints the per-server secret **at that moment** and hands the raw form over **exactly once** (the approved→claimed flip is atomic — a raced second poller gets `expired_token`). Raw secrets never rest in the cloud's database; only sha256 hashes do.
4. **The daemon takes over** — the CLI passes the credential to the daemon over the local socket. The daemon writes `~/.pboss/cloud.json` (mode 0600) and opens the outbound WebSocket (`/ws/agent`). The CLI itself never stores the machine secret.

Denial returns `access_denied` to the terminal; waiting past the 10 minutes returns `expired_token`. Either way, nothing is linked and nothing is written.

A legacy pasted-token flow also exists: mint a single-use `pbc_…` token in the dashboard and run `pboss cloud connect pbc_…`. Same credential, same daemon ownership — handy when the terminal can't do an interactive approval.

## Machine vs user credentials

| | Machine (`pboss cloud connect`) | User (`pboss login`) |
|---|---|---|
| File | `~/.pboss/cloud.json` (0600) | `~/.pboss/cloud-user.json` (0600) |
| Credential | `serverId` + `pbs_…` secret | `pbu_…` CLI token |
| Held by | the **daemon** | the **CLI** |
| Powers | state stream, remote commands, `cloud status/servers/reconnect/disconnect` | `pboss whoami`, `pboss logout` |
| Revoked by | dashboard revoke, or `pboss cloud disconnect` | `pboss logout`, or the dashboard |

The split is deliberate: revoking a server in the dashboard never logs you out of your CLI, and logging out never unlinks a server. Each credential dies alone.

## What the linked daemon does

- Opens the outbound **WebSocket** (`/ws/agent`) — commands, state, results, and live log frames all flow over it; automatic reconnect with exponential backoff (1s → 30s, jittered, reset on success).
- Sends a **full state report every 10 seconds** (and after every command): server CPU/memory, and the process list with per-process CPU, memory, restarts, crashes, and uptime.
- Derives **events** from consecutive snapshots — crashes, restarts, online/stopped transitions — which the cloud turns into alert rows.
- **Executes remote commands**: `process.list/start/stop/restart/delete/logs/deploy`, `server.info`, `server.deploy`. Each gets a result frame and triggers a fresh state report, so the dashboard reflects reality immediately.
- **Tails logs live** when a dashboard opens them (`log.watch` / `log.unwatch`); new lines are pushed as they land on disk.
- Answers `pboss cloud servers` — the fleet list fetched by the daemon with the machine credential (the secret never leaves the daemon except toward the cloud).

## Revoking a machine

Two ways to cut a machine off:

- **From the machine:** `pboss cloud disconnect` — asks the cloud to revoke the credential, stops the agent, and wipes `cloud.json`. The server row stays in your fleet (offline) and can re-link any time.
- **From your account:** revoke the server in the procboss.com dashboard — the same effect, useful when the machine itself is unreachable or decommissioned.

Revocation is immediate: the next stream handshake fails with 401, the agent stops, clears the local credential, and the machine shows as offline.

## Frequently asked

**Does the cloud run commands on my servers?**
Yes — that's the point of the link, and it's precise: the command set is exactly the nine `process.*` / `server.*` operations above, executed by the same daemon your local CLI talks to, over the agent's own outbound WebSocket. The cloud can never reach into your network (no inbound ports exist), and revoking the machine kills the channel instantly.

**What if the machine is offline for a while?**
Nothing breaks. The server shows offline in the fleet view; when it comes back, the agent reconnects automatically (backoff, then steady). The credential has no expiry — revoke it when the machine is decommissioned.

**Where do credentials live?**
`~/.pboss/cloud.json` for the machine (owned by the daemon), `~/.pboss/cloud-user.json` for your user login — both mode 0600, both raw secrets that exist server-side only as hashes.
