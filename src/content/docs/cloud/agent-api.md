---
title: Agent API
description: The HTTP surface a linked machine and the CLI speak — device flow, agent stream, state reports, commands, fleet, and user tokens.
section: cloud
order: 3
---

The endpoints below are what the pboss agent (the daemon's cloud link) and the CLI speak against `https://procboss.com` (override with `--url` or `PBOSS_CLOUD_URL`). Documented for custom integrations — build your own agent or a compatible cloud against the same contract. All requests and responses are JSON.

Two credential spaces exist:

- **Machine**: `Authorization: Bearer <serverId>.<pbs_… secret>` — held by the daemon.
- **User (CLI)**: `Authorization: Bearer <pbu_… token>` — held by the CLI (`pboss login`).

## Device flow (both scopes)

### POST /api/device/code

Anonymous. Registers a pending login and returns the codes the CLI needs.

```json
{
  "scope": "machine",
  "hostname": "my-server",
  "os": "linux",
  "arch": "x64",
  "agentVersion": "pboss/1.2.0",
  "client": "pboss-cli"
}
```

Response (`200`):

```json
{
  "deviceCode": "pbd_86jo9jtU_-…",
  "userCode": "F7KD-92XM",
  "verificationUrl": "https://procboss.com/connect",
  "expiresInMs": 600000,
  "intervalMs": 2000
}
```

`deviceCode` is secret — returned exactly once, stored server-side only as a sha256 hash. `userCode` is what the human types at `/connect`.

### GET /api/device/pending/[userCode]

Public. The approval card's data — scope, status, hostname, OS, arch, agentVersion, client, expiry. No secrets, no ids.

### POST /api/device/[userCode]/approve

Browser-side, requires a signed-in session (cookie). Body: `{ "action": "approve" | "deny" }`. Machine scope creates (or re-links — same owner + hostname) the Server row; the secret is **not** minted here. User scope records intent. Late approvals of expired codes are refused (`410`).

### POST /api/device/token

The CLI's poll loop. Body: `{ "deviceCode": "…" }`. Responses follow device-flow semantics:

| State | Status | Body |
|---|---|---|
| Pending | `400` | `{ "error": "authorization_pending" }` |
| Polling too fast | `428` | `{ "error": "slow_down" }` (client grows its interval ×1.5) |
| Denied | `403` | `{ "error": "access_denied" }` |
| Code dead/expired | `410` | `{ "error": "expired_token" }` |
| Granted | `200` | credential (below) — **exactly once** |

Machine grant (the raw secret is minted at claim time; a raced second claim gets `expired_token`):

```json
{
  "scope": "machine",
  "serverId": "srv_…",
  "serverSecret": "pbs_…",
  "serverName": "srv-my-server"
}
```

User grant:

```json
{
  "scope": "user",
  "token": "pbu_…",
  "tokenName": "cli@my-server",
  "user": { "email": "sam@example.com", "name": "Sam Rivera", "handle": "samrivera", "provider": "github" }
}
```

## Agent endpoints (machine credential)

### POST /api/agent/enroll

Legacy pasted-token path: exchange a dashboard-minted single-use `pbc_…` token for the same machine credential. Atomic single-use claim; re-links revoked rows for the same owner + hostname.

### GET /ws/agent

The **transport** — ONE full-duplex WebSocket, opened by the daemon, authenticated with the machine credential. Everything flows over it:

- **agent → cloud frames**: state reports (on the tier heartbeat — 60s default, cloud-adjustable — and after each command) — the JSON below; command results — `{ "type": "command-result", "result": … }`; live log lines — `{ "type": "log", … }` (only while a dashboard is tailing); `metrics.backfill` — one frame per reconnect with a resampled slice of the agent's local metric history covering the outage gap (bounded to 360 samples); `pong` — the heartbeat reply.
- **cloud → agent frames**: commands — `{ "id": "<uuid>", "type": "process.restart", "payload": { "target": "web" }, "issuedBy": "user_…" }` (`issuedBy` is the audit identity, echoed back on the result); `hello` — the registration ack that flips the agent to `connected`; log-tail control — `log.watch` / `log.unwatch`; `ping` — the app-level heartbeat (~15s) arming the dead-socket watchdog; `event-ack` — `{ "ids": ["evt-…"] }`, the receipt for ingested events; `report-interval` — `{ "sec": 60 }`, the plan-tier report cadence, sent on change — the agent re-arms its timer (a `PBOSS_CLOUD_REPORT_MS` pin outranks it).

**Command types:**

- Lifecycle — `process.list`, `process.start`, `process.stop`, `process.restart`, `process.kill` (force-stop; the row survives), `process.delete`, `process.deploy`, `process.scale` (instance count without a full restart)
- Remote ops — `server.info`, `server.deploy`, `process.exec` (ONE command in a process's cwd; hard timeout, capped output), `log.search` (time-ranged regex across rotated + gzipped logs)
- Groups — `namespace.start` / `namespace.stop` / `namespace.restart` (bounce a whole namespace together)
- Scheduled jobs — `cron.list`, `cron.run` (fire now), `cron.enable`, `cron.disable`
- Env — `env.get` (keys only by default; values redacted unless `values: true`), `env.set` (write vars, optionally restart)
- Alerting — `config.alerts.get` / `config.alerts.set` (read/write the threshold document live)
- Deployments — `process.gitinfo`, `deploy.run` (one batch×target job: strategy `release` for created processes — the code lands in `~/apps/{process}/` in the agent OS user's home, i.e. `/home/{username}/apps` for the OS user running the agent, wherever the pboss home itself sits (1.4.9) — `inplace` for adopted ones; backups under `~/.pboss/backups/{targetId}/v{n}_{commit}/`), `deploy.restore` (revert to a recorded backup — the same path the failed-health auto-rollback rides), `deploy.cancel`, `deploy.purge` (Remove with "also delete stored backups and files"). Each run's pipeline output rides the `deploy.progress` frames — re-readable in the dashboard, live while the build runs

Close code `4001` means revoked — the agent wipes its credential and stops; close code `1000` with reason `replaced` means another connection claimed the slot (two daemons sharing one credential — `pboss cloud status` says exactly that); otherwise the agent reconnects with jittered exponential backoff, and a socket that goes silent (no frames, no close — NAT timeout, network switch) is closed by the agent's watchdog and re-dialed.

**Authentication transports.** The dial carries the machine credential as an `Authorization` header AND as the `?agent=` query parameter: some reverse proxies (preview tunnels, corporate gateways) strip the header from WebSocket upgrades while forwarding the URL; the cloud reads whichever arrives. `hello` confirms the authenticated upstream: until it arrives, an open socket is unproven — a proxy can answer the upgrade itself and never dial the origin (a "mirage" open), so the agent sends nothing and stays `connecting…`; no `hello` in 10 seconds forces a redial, and only a confirmed link resets the backoff.

Events in state reports carry a delivery `id`. The agent queues them in an outbox until the cloud acks ingestion (`event-ack`); the cloud dedups by id, so a crash that happens during a network outage is delivered after the reconnect without double-alerting.

**Crash events are pushed the moment a process dies** — the agent listens to its supervisor's own `process:crashed` signal (exit code, signal, best-effort reason, and a log tail read once the last stderr has flushed) instead of waiting for the next snapshot; restart, online/stopped, and threshold events are derived at report time. Clean self-exits (exit 0, no signal) are lifecycle facts, not crashes — they never alert.

**Event kinds.** Lifecycle: `crash`, `restart`, `online`, `stopped`. Resource thresholds (the agent-side detector — see [threshold alerts](/cloud/alerts)): `cpu.spike`, `cpu.sustained`, `mem.spike`, `mem.high`, `restart.loop`, `eventloop.latency`, `handles.leak`, `system.cpu.high`, `system.mem.high`, and the matching `*.recovered` kinds (server-wide events use the `__system__` process name). Health checks: `health.failing`, `health.recovered`. Cron jobs: `cron.failed`, `cron.completed`. Threshold events carry `metricValue`, `thresholdValue`, and (on recovery) `durationSec`; crash events carry a best-effort `reason` ("likely OOM", "uncaught exception") derived from the exit facts.

The state report frame:

```json
{
  "serverId": "srv_…",
  "status": "online",
  "hostname": "my-server",
  "os": "linux",
  "arch": "x64",
  "bunVersion": "1.2.20",
  "agentVersion": "pboss/1.4.7",
  "cpu": 12,
  "memUsed": 800,
  "memTotal": 4000,
  "processes": [
    { "name": "web", "script": "server.ts", "pmId": 0, "status": "online",
      "cpu": 5, "mem": 120, "restarts": 0, "crashes": 0, "uptimeSec": 3600,
      "healthStatus": "healthy", "healthFails": 0,
      "eventLoopMs": 12, "handles": 180, "memLimitMB": 512 }
  ],
  "events": [
    { "kind": "crash", "process": "web", "at": 1690000000000, "detail": "process crashed (exit 137)",
      "exitCode": 137, "reason": "likely OOM" }
  ]
}
```

`healthStatus` / `healthFails` appear only for processes with a `healthCheckUrl` configured (`"healthy"` | `"unhealthy"` | `"unknown"` — unknown until the first probe completes). `eventLoopMs` (event-loop lag), `handles` (open FDs), `memLimitMB` (the `maxMemoryRestart` ceiling) and `alertsDisabled` (the ecosystem switch) ride every report since agent 1.4.7 — the cloud stores them as per-process resource history and its own detectors + AI optimization advice read them; older agents simply never set them. Crash events become alert rows (with exit code, signal, reason, and a log tail for crash reports); threshold, health, and cron events become alert rows or notifications per their severity.

### POST /api/agent/servers

The fleet this machine's owner sees, with **live presence** (a connected agent is `online` regardless of the stored row):

```json
{
  "servers": [
    { "id": "srv_…", "name": "srv-api-01", "host": "api-01.example",
      "status": "online", "os": "linux", "agentVersion": "pboss/1.2.0",
      "cpu": 12, "memUsed": 800, "memTotal": 4000,
      "lastSeen": "2026-09-08T…", "enrolled": true }
  ]
}
```

This is what `pboss cloud servers` renders — fetched by the daemon, so the machine secret never reaches the CLI process.

### POST /api/agent/disconnect

Self-revocation (`pboss cloud disconnect`): nulls the stored credential hash. Idempotent.

## User endpoints (CLI token)

### GET /api/me

`Authorization: Bearer pbu_…`. Returns the account + token metadata (email, name, handle, provider, tokenName, lastUsedAt). Powers `pboss whoami`.

### POST /api/me/revoke

Self-revocation of the presented token (`pboss logout`) — this device only, never the account or other devices. Idempotent.

## Security model recap

- Device codes, machine secrets, and CLI tokens are stored hashed (sha256) server-side; raw forms exist once, in flight, and in the local 0600 files.
- The credential is minted at claim time and handed over exactly once; codes expire in 10 minutes and can be denied at the approval card.
- Everything is outbound from the machine: one WebSocket plus HTTPS POSTs. No inbound port ever exists on the agent side.
- TLS is required: the agent refuses plaintext cloud URLs off-loopback (`PBOSS_CLOUD_ALLOW_INSECURE=1` is the warned opt-out), and `~/.pboss` itself is owner-only (0700) so other local users cannot reach the daemon socket or the credential files.
- Machine credentials, CLI tokens, and browser sessions are three independent revocable spaces.
- Remote commands are a fixed ten-operation whitelist executed by the local daemon; every write is ownership-checked server-side, and the gateway relays nothing but whitelisted command types.
