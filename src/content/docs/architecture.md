---
title: Architecture
description: How pboss is built — the runtime-agnostic core, the CLI, the daemon, process containers, the IPC protocol, the dashboard, and the metrics server.
section: more
order: 1
---

pboss is a daemonized process manager: a CLI in the front, one long-running daemon per machine doing the actual work. Under all of it sits the runtime layer that makes the whole thing run natively on Bun, Node.js, or Deno.

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
│  │                 │  │  (HTTP + WS   │  │ (Plugins) │  │
│  │  ┌───────────┐  │  │  REST API)   │  └───────────┘  │
│  │  │ Container │  │  └──────────────┘                  │
│  │  └───────────┘  │  ┌──────────────┐  ┌───────────┐  │
│  │  ┌───────────┐  │  │   Monitor    │  │  Metrics  │  │
│  │  │ Container │  │  │ CPU/Memory  │  │ Prometheus│  │
│  │  └───────────┘  │  └──────────────┘  │   :9616    │  │
│  │  ┌───────────┐  │  ┌──────────────┐ └───────────┘  │
│  │  │ Container │  │  │ Health Check │                  │
│  │  └───────────┘  │  │  HTTP Probes │                  │
│  └─────────────────┘  └──────────────┘                  │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌─────────────┐  │
│  │  Cluster │ │   Logs   │ │  Cron  │ │   Deploy    │  │
│  │ Manager │ │ Manager  │ │Manager │ │   Manager   │  │
│  └──────────┘ └──────────┘ └────────┘ └─────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Runtime Adapter (one of: Bun │ Node │ Deno)│
│  │   process · filesystem · network · misc           │   │
│  └───────────────────────┬─────────────────────────┘   │
└─────────────────────────┼───────────────────────────────┘
                          ▼
              Native APIs of the executing runtime
     (Bun.spawn / node:child_process / Deno.Command …)
```

Every feature above the adapter band is runtime-agnostic code: it speaks small capability interfaces and never mentions a runtime. The adapter — picked once at startup — implements those interfaces with the executing runtime's own native APIs. See [Runtimes](/runtimes) for the full native API map and the detection order.

## The pieces

**Daemon process** — the daemon is a long-running process running on whichever runtime executes pboss — Bun, Node.js, or Deno, each through its native APIs. It listens on a Unix domain socket at `~/.pboss/daemon.sock` for commands from the CLI. The daemon is automatically started when you first run a pboss command, and can be explicitly killed with `pboss kill`.

**Process container** — each managed process is wrapped in a ProcessContainer that handles spawning (through the runtime adapter — `Bun.spawn` under Bun, `node:child_process` under Node, `Deno.Command` under Deno), log piping, monitoring, restart logic, health checking, watch mode, and signal handling. One container per process; the daemon supervises them all. Containers also report **terminal exits** (a stop, or a crash after the restart budget is exhausted) — but not pboss-initiated stops and not crashes that auto-restart is already handling — so the ProcessManager can evaluate the namespace member-exit policy without ever cascading.

**Namespace lifecycle** — the ProcessManager treats a namespace as one lifecycle unit ([#31](https://github.com/Procboss/pboss/issues/31)): standalone (namespace-less) processes stay fully independent, while a namespace starts **atomically**. Rollback is invocation-scoped — only members the current operation started may be stopped; already-running members are never touched, and rollback is best-effort in reverse start order with the original failure staying the primary error.

**Namespace coordination** — namespace-scoped operations (start/resume/restart/stop/reload/delete) serialize through per-namespace promise-chain locks: two terminals cannot interleave a restart and a stop on the same group, while different namespaces stay independently operable. The `onNsMemberExit` policy (`ignore` default, or `exit`) stops a namespaced process when a sibling exits for good. Membership and the policy persist in the process dump, so both survive daemon restarts.

**Dependency engine** — a dedicated subsystem (`src/dependencies.ts`, issue #33) owns everything dependency-shaped, keeping lifecycle code free of resolution logic. `dependsOn` configuration is parsed into a normalized, persisted form; an **explicit graph** (not a recursive `start()` call) provides cycle detection, topological levels, and reverse lookups; a **provider** layer resolves names — ProcBoss processes first, then systemd via `systemctl show` (checking state, never managing the service).

**Dependency executor** — the engine's level-concurrent executor sits behind every lifecycle path: start, resume, restart, the ecosystem sweep, and boot recovery. It starts stopped ProcBoss dependencies (already-running ones are never restarted), checks external services, records what it started into the invocation's rollback scope, and reports failures as diagnostics that carry the provider, service and state — for humans in the message, for automation in a structured `dependencyFailure` payload.

**IPC protocol** — the CLI and daemon communicate over WebSocket on a Unix socket. Messages are JSON-encoded with a `type` field for routing and an `id` field for request-response correlation. This is the same protocol the [programmatic API](/guide/programmatic-api) rides on — `pboss.send()` gives you direct access to it.

**Event system** — the ProcessManager is the canonical event source ([#32](https://github.com/Procboss/pboss/issues/32)): every ProcessContainer state transition, operator-initiated or autonomous (crash autorestart, `maxMemoryRestart`, watch, cron, health-check), is funneled through it as a typed `process:*` event with its cause and a fresh state snapshot. Modules subscribe directly via `pm.on(...)`.

**Event transport** — remote clients receive the same events over the daemon's SSE-style stream (`subscribeEvents`, the same `ReadableStream` mechanism `streamLogs` uses). Aborting the request detaches the daemon-side listener, so neither side leaks; the stream ending under a live connection surfaces as `daemon:disconnected`.

**Dashboard** — served by the runtime's native HTTP server (`Bun.serve` / `node:http` / `Deno.serve`) with WebSocket upgrade support. A single HTTP server handles the dashboard UI, the [REST API](/guide/dashboard-api), and WebSocket connections.

**Metrics server** — a second server on port 9616 serves Prometheus metrics, keeping the scrape endpoint isolated from dashboard traffic. See [Prometheus & Grafana](/guide/prometheus).

**Foreground exception** — `--no-daemon` collapses the whole architecture into a single foreground process that supervises children in-process, with no socket and no separate daemon. See [Foreground mode & Docker](/guide/docker).

## Why this design

- **Runtime-agnostic, not runtime-generic** — one feature set implemented natively per runtime: `Bun.spawn` / `node:child_process` / `Deno.Command` for orchestration, `Bun.serve` / `node:http` / `Deno.serve` for HTTP and WebSocket, each runtime's native file APIs for I/O. No compatibility layers, no per-runtime feature gaps, and the adapter is resolved once so nothing is paid per call.
- **One source of truth per machine** — every CLI invocation, the dashboard, and the API all talk to the same daemon, so they all see the same process list. There's no state skew between views.
- **Cheap commands** — the CLI is a thin client: it formats a JSON message and prints the response. Command startup cost doesn't scale with the number of processes.
- **Fast by construction** — every hot path calls the executing runtime's native implementation directly. The whole daemon starts in under 50ms and idles around ~12MB of RAM.
- **Supervision that outlives your shell** — because the daemon is detached, processes keep running (and keep being restarted) after your SSH session ends.
- **Explicit group semantics** — a namespace is an opt-in lifecycle boundary, not ambient coupling: standalone processes stay independent, and grouped processes get atomic startup, invocation-scoped rollback, serialized operations, and an explicit member-exit policy. Nothing cascades unless you ask for it.
- **Check, never own** — dependency resolution treats services pboss does not manage as read-only facts: an active systemd unit satisfies a dependency, an inactive one blocks it, and pboss never reaches for `systemctl start`. Infrastructure owned by systemd, another admin, or another orchestrator stays theirs; lifecycle ownership of external services is an explicit opt-in for a future policy, never a side effect.

## Development setup

pboss is TypeScript in strict mode. Bun is the **development toolchain** — the test runner, the bundler, and the compiled-binary builder — while the code itself runs on Bun, Node, or Deno. To hack on it:

```bash
git clone https://github.com/procboss/pboss.git
cd pboss
bun install
bun run src/index.ts list
bun test
```

The `src/runtime/` directory holds the adapter contract (`core/`) and the three native implementations (`bun/`, `node/`, `deno/`) — adding a new runtime is a new directory plus a registration in the detection factory; the core never changes. `bun run build:dist` bundles `dist/cli.js`, the same file the npm package ships, which you can also execute with `node dist/cli.js` or `deno run -A dist/cli.js`.

Contributions are welcome: fork the repository, write tests for new functionality, follow the existing code style, run `bun test` before submitting, and open a pull request with a clear description.
