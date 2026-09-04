---
title: Linking a server
description: The pboss login device flow step by step, token storage and renewal, revocation, and the security model.
section: cloud
order: 2
---

`pboss login` links a machine to your procboss.com account using a device authorization flow — the same pattern as `npm login` and `gh auth login`. It's designed so that secrets never travel through terminals or clipboards.

## The flow

```text
CLI                    procboss.com
─────────────────────────────────────────
POST /api/device/start ──▶ pending link
◀── device_code + user_code
    open /link?code=PBSS-XXXX
POST /api/device/token ──▶ pending…
◀── access JWT + refresh token
```

Step by step:

1. **`pboss login`** — the CLI sends anonymous machine facts (hostname, OS, Bun version, agent version) to `POST /api/device/start` and receives two codes: a secret **device code** (kept only by the CLI) and a human **user code** like `PBSS-4F2A`.
2. **Browser approval** — the CLI opens your browser at `procboss.com/link?code=PBSS-4F2A`. If you're not signed in, you authenticate with GitHub or Google OAuth first; the confirmation card then shows the machine facts and an approve/deny choice. Codes expire after **10 minutes**.
3. **Token exchange** — meanwhile the CLI polls `POST /api/device/token`. On approval it receives an **access token** (JWT) and a **refresh token**. The exchange is one-time: once tokens are issued, the device code is dead.
4. **Local storage** — tokens land in `~/.config/pboss/credentials.json` with `0600` permissions. The machine appears in your fleet.

Denying the approval card returns `access_denied` to the CLI; doing nothing until the code expires returns `expired_token`. Either way, nothing is written.

## Token model

| Token | Form | Lifetime | Purpose |
|---|---|---|---|
| Access token | HS256 JWT | 15 minutes | `Authorization: Bearer …` on agent calls |
| Refresh token | opaque `pbr_…` | 30 days | mint new access JWTs |

- The **refresh token is stored only as a hash** server-side; the plaintext exists only in your credentials file.
- The CLI **renews the access token automatically** as expiry approaches — no user interaction needed for the token's whole 30-day life.
- The JWT binds `sub` (your user id) to `srv` (the server row) and `sid` (the agent session) — a token can never touch another machine's data, and every write is ownership-checked again server-side.

## Heartbeat

A linked machine checks in every 15 seconds via `POST /api/agent/heartbeat`, reporting server metrics and its process list. Heartbeats only *report* — process control still happens locally through the daemon. The full HTTP surface is documented in [Agent API](/cloud/agent-api).

## Revoking a machine

Two ways to cut a machine off:

- **From the machine:** `pboss logout` — revokes the agent session and wipes the local credentials file. The server stays in your fleet (marked offline) and can re-link with `pboss login` any time.
- **From your account:** revoke the agent session in the procboss.com dashboard — the same effect, useful when the machine itself is unreachable or decommissioned.

Revocation is immediate: the next heartbeat or refresh attempt fails with `401 session_revoked`, and the machine shows as offline.

## Frequently asked

**Does the cloud run commands on my servers?**
No. Heartbeats are read-only reporting; control always flows through the local pboss daemon.

**What if the machine is offline for a while?**
Nothing breaks. The server shows offline in the fleet view; when it comes back, heartbeats resume and the refresh token (valid 30 days, rolling) picks up where it left off. Beyond the refresh window, run `pboss login` again.

**Where do tokens live?**
`~/.config/pboss/credentials.json`, readable only by your user (`0600`).
