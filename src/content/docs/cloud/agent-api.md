---
title: Agent API
description: The HTTP API a linked machine speaks — device flow endpoints, token exchange semantics, heartbeat, refresh, and logout.
section: cloud
order: 3
---

The endpoints below are what the pboss agent (`pboss login` and the heartbeat loop) speaks against `https://procboss.com`. They're documented for custom integrations — if you're building your own agent, follow the same contract.

All requests and responses are JSON. Machine-facing auth uses `Authorization: Bearer <token>`.

## Device flow

### POST /api/device/start

Anonymous. Registers a pending link and returns the codes the CLI needs.

```json
{
  "hostname": "my-server",
  "os": "linux-x64",
  "bunVersion": "1.1.34",
  "agentVersion": "pboss/1.2.0"
}
```

Response (`201`):

```json
{
  "device_code": "gU8nOzTP…",
  "user_code": "PBSS-H3TN",
  "verification_uri": "https://procboss.com/link?code=PBSS-H3TN",
  "expires_in": 600,
  "interval": 5
}
```

`device_code` is secret — it is returned exactly once and stored server-side only as a hash. `user_code` is what the human sees.

### POST /api/device/authorize

Browser-side, requires a signed-in session (cookie). Body: `{ "code": "PBSS-H3TN", "deny": false }`. On approval the pending link is bound to the signed-in user; on denial it's marked denied.

### POST /api/device/token

The CLI's poll loop. Body: `{ "device_code": "…" }`. Responses follow OAuth device-flow semantics:

| State | Status | Body |
|---|---|---|
| Pending | `400` | `{ "error": "authorization_pending", "interval": 5 }` |
| Polling too fast | `429` | `{ "error": "slow_down", "interval": 5 }` + `Retry-After` |
| Denied | `403` | `{ "error": "access_denied" }` |
| Code dead/expired | `400` | `{ "error": "expired_token" }` |
| Granted | `200` | token bundle (below) |

The exchange is **one-time** — once granted, the device code can never mint a second session.

Token bundle:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs…",
  "refresh_token": "pbr_9f8e7d…",
  "token_type": "Bearer",
  "expires_in": 900,
  "server_id": "srv_…",
  "server_name": "my-server",
  "user": { "id": "usr_…", "name": "Sam Rivera", "email": "sam@example.com" }
}
```

## Agent session

### POST /api/agent/heartbeat

`Authorization: Bearer <access JWT>`. A linked machine's check-in, every 15 seconds:

```json
{
  "cpu": 12,
  "memUsed": 800,
  "memTotal": 4000,
  "status": "online",
  "os": "linux-x64",
  "bunVersion": "1.1.34",
  "agentVersion": "pboss/1.2.0",
  "processes": [
    {
      "name": "web",
      "script": "server.ts",
      "pmId": 0,
      "status": "online",
      "cpu": 5,
      "mem": 120,
      "restarts": 0,
      "crashes": 0,
      "uptimeSec": 3600
    }
  ]
}
```

The process list is synced keyed by `(server, pmId)` — renames and removals flow through naturally. Response: `{ "ok": true, "serverId": "…", "processes": 1, "nextHeartbeatMs": 15000 }`.

Errors: `401 invalid_token` (expired JWT — refresh and retry), `401 session_revoked` (machine was revoked — re-link required).

### POST /api/agent/refresh

`Authorization: Bearer <refresh token>` (the opaque `pbr_…` value). Returns a fresh token bundle (same shape as the grant above) — a new 15-minute JWT, the same refresh token, valid until the session's 30-day window ends.

A `401` here means the refresh token is dead (revoked or expired): the machine must run `pboss login` again.

### POST /api/agent/logout

`Authorization: Bearer <refresh token>`. Revokes the agent session server-side; the CLI also wipes the local credentials file. Idempotent — logging out twice is not an error. The server row stays in the fleet, marked offline.

## Security model recap

- Device codes and refresh tokens are only ever stored hashed server-side.
- The access JWT binds user ↔ server ↔ session; every write is ownership-checked again in the route.
- Heartbeats are read-only reporting — no remote command execution exists in the protocol.
- Sessions are revocable per machine at any time, effective immediately.
