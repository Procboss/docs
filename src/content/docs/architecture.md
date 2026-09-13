---
title: Architecture
description: How pboss is built — the CLI, the daemon, process containers, the IPC protocol, the dashboard, and the metrics server.
section: more
order: 1
---

pboss is a daemonized process manager: a CLI in the front, one long-running daemon per machine doing the actual work. This page walks through the pieces and how they talk to each other.

## The big picture

```text
┌─────────────────────────────────────────────────────────┐
│                      ProcBoss (pboss) CLI                │
│  (pboss start, pboss list, pboss restart, pboss dashboard)│
└────────────────────────┬────────────────────────────────┘
                         │ Unix Socket (WebSocket)
                         │ ~/.pboss/daemon.sock
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    ProcBoss Daemon                       │
│                                                         │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ Process Manager  │  │   Dashboard  │  │  Modules  │  │
│  │                 │  │  (Bun.serve) │  │ (Plugins) │  │
│  │  ┌───────────┐  │  │  HTTP + WS   │  └───────────┘  │
│  │  │ Container │  │  │  REST API    │                  │
│  │  │ (Bun.spawn)│  │  └──────────────┘                 │
│  │  └───────────┘  │                                    │
│  │  ┌───────────┐  │  ┌──────────────┐  ┌───────────┐  │
│  │  │ Container │  │  │   Monitor    │  │  Metrics  │  │
│  │  │ (Bun.spawn)│  │  │ CPU/Memory  │  │ Prometheus│  │
│  │  └───────────┘  │  └──────────────┘  │   :9616    │  │
│  │  ┌───────────┐  │                    └───────────┘  │
│  │  │ Container │  │  ┌──────────────┐                  │
│  │  │ (Bun.spawn)│  │  │ Health Check │                  │
│  │  └───────────┘  │  │  HTTP Probes │                  │
│  └─────────────────┘  └──────────────┘                  │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌─────────────┐  │
│  │  Cluster │ │   Logs   │ │  Cron  │ │   Deploy    │  │
│  │  Manager │ │ Manager  │ │Manager │ │   Manager   │  │
│  └──────────┘ └──────────┘ └────────┘ └─────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## The pieces

**Daemon process** — the daemon is a long-running Bun process that manages all child processes. It listens on a Unix domain socket at `~/.pboss/daemon.sock` for commands from the CLI. The daemon is automatically started when you first run a pboss command, and can be explicitly killed with `pboss kill`.

**Process container** — each managed process is wrapped in a ProcessContainer that handles spawning via `Bun.spawn`, log piping, monitoring, restart logic, health checking, watch mode, and signal handling. One container per process; the daemon supervises them all. Containers also report **terminal exits** (a stop, or a crash after the restart budget is exhausted) — but not pboss-initiated stops and not crashes that auto-restart is already handling — so the ProcessManager can evaluate the namespace member-exit policy without ever cascading.

**Namespace lifecycle** — the ProcessManager treats a namespace as one lifecycle unit ([#31](https://github.com/Procboss/pboss/issues/31)): standalone (namespace-less) processes stay fully independent, while a namespace starts **atomically**. Rollback is invocation-scoped — only members the current operation started may be stopped; already-running members are never touched, and rollback is best-effort in reverse start order with the original failure staying the primary error.

**Namespace coordination** — namespace-scoped operations (start/resume/restart/stop/reload/delete) serialize through per-namespace promise-chain locks: two terminals cannot interleave a restart and a stop on the same group, while different namespaces stay independently operable. The `onNsMemberExit` policy (`ignore` default, or `exit`) stops a namespaced process when a sibling exits for good. Membership and the policy persist in the process dump, so both survive daemon restarts.

**IPC protocol** — the CLI and daemon communicate over WebSocket on a Unix socket. Messages are JSON-encoded with a `type` field for routing and an `id` field for request-response correlation. This is the same protocol the [programmatic API](/guide/programmatic-api) rides on — `pboss.send()` gives you direct access to it.

**Dashboard** — served by a `Bun.serve` instance with WebSocket upgrade support. A single HTTP server handles the dashboard UI, the [REST API](/guide/dashboard-api), and WebSocket connections.

**Metrics server** — a separate `Bun.serve` instance on port 9616 serves Prometheus metrics, keeping the scrape endpoint isolated from dashboard traffic. See [Prometheus & Grafana](/guide/prometheus).

**Foreground exception** — `--no-daemon` collapses the whole architecture into a single foreground process that supervises children in-process, with no socket and no separate daemon. See [Foreground mode & Docker](/guide/docker).

## Why this design

- **One source of truth per machine** — every CLI invocation, the dashboard, and the API all talk to the same daemon, so they all see the same process list. There's no state skew between views.
- **Cheap commands** — the CLI is a thin client: it formats a JSON message and prints the response. Command startup cost doesn't scale with the number of processes.
- **Fast by construction** — `Bun.spawn` for orchestration, `Bun.serve` for HTTP/WebSocket, `Bun.file` for I/O, `Bun.gzipSync` for log compression. The whole daemon starts in under 50ms and idles around ~12MB of RAM.
- **Supervision that outlives your shell** — because the daemon is detached, processes keep running (and keep being restarted) after your SSH session ends.
- **Explicit group semantics** — a namespace is an opt-in lifecycle boundary, not ambient coupling: standalone processes stay independent, and grouped processes get atomic startup, invocation-scoped rollback, serialized operations, and an explicit member-exit policy. Nothing cascades unless you ask for it.

## Development setup

pboss is TypeScript in strict mode, built on Bun. To hack on it:

```bash
git clone https://github.com/procboss/pboss.git
cd pboss
bun install
bun run src/index.ts list
bun test
```

Contributions are welcome: fork the repository, write tests for new functionality, follow the existing code style, run `bun test` before submitting, and open a pull request with a clear description.
