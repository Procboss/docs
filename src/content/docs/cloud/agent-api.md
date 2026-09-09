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

- **agent → cloud frames**: state reports (every 10s and after each command) — the JSON below; command results — `{ "type": "command-result", "result": … }`; live log lines — `{ "type": "log", … }` (only while a dashboard is tailing).
- **cloud → agent frames**: commands — `{ "id": "<uuid>", "type": "process.restart", "payload": { "target": "web" } }`; log-tail control — `log.watch` / `log.unwatch` per process.

Command types: `process.list`, `process.start`, `process.stop`, `process.restart`, `process.delete`, `process.logs`, `process.deploy`, `server.info`, `server.deploy`. Close code `4001` means revoked — the agent wipes its credential and stops; otherwise the agent reconnects with exponential backoff.

The state report frame:

```json
{
  "serverId": "srv_…",
  "status": "online",
  "hostname": "my-server",
  "os": "linux",
  "arch": "x64",
  "bunVersion": "1.2.20",
  "agentVersion": "pboss/1.2.0",
  "cpu": 12,
  "memUsed": 800,
  "memTotal": 4000,
  "processes": [
    { "name": "web", "script": "server.ts", "pmId": 0, "status": "online",
      "cpu": 5, "mem": 120, "restarts": 0, "crashes": 0, "uptimeSec": 3600 }
  ],
  "events": [
    { "kind": "crash", "process": "web", "at": 1690000000000, "detail": "process errored" }
  ]
}
```

Crash events become alert rows (with exit code, signal, and a log tail for crash reports).

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
- Machine credentials, CLI tokens, and browser sessions are three independent revocable spaces.
- Remote commands are a fixed nine-operation whitelist executed by the local daemon; every write is ownership-checked server-side.
