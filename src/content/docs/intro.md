---
title: Introduction
description: What ProcBoss is — pboss, the runtime-agnostic process manager that runs on Bun, Node.js, or Deno through each runtime's native APIs, and ProcBoss Cloud for fleet visibility across your servers.
section: getting-started
order: 1
---

**ProcBoss** comes in two parts that work independently and together:

- **pboss** — a runtime-agnostic process manager for **Bun, Node.js, and Deno**. It runs on whichever runtime your machine already has, through that runtime's **own native APIs** — no compatibility layers, no lowest-common-denominator mode, no forced dependencies. Open source (GPLv3), by [procboss.com](https://procboss.com).
- **ProcBoss Cloud** (procboss.com) — the optional hosted layer: link the servers you already run, get fleet visibility, alerts, and metrics from one dashboard.

<!-- 2026-09-29: multi-language support is hidden while the product focuses on JS/TS
     backends. Re-add when it returns: "In addition to that first-class Node, Bun and
     Deno support, it also manages everything else on the machine: Go, Python, Rust,
     Ruby, PHP, Java, binaries, shell scripts." (append to the pboss bullet above) -->

## Runtime-agnostic, not runtime-generic

One published package, three runtimes. `npm install -g pboss`, `bun add -g pboss`, or `deno install -g -A --name pboss npm:pboss/deno-entry` all deliver the same CLI — and the runtime that executes it is **your** selection:

- **No runtime is forced on you.** Any one of Bun, Node.js, or Deno is enough. You pick it once — at install time or on first run — and the choice is saved in `~/.pboss/.runtime`; the `pboss` wrapper reads it back every run and dispatches to that runtime's own entrypoint. `pboss runtime change` switches it any time.
- **Native performance and features, per runtime.** Under Bun, pboss supervises with `Bun.spawn`, serves the dashboard with `Bun.serve`, reads files with `Bun.file`. Under Node, it is `node:child_process`, `node:http`, and `node:fs/promises`. Under Deno, `Deno.Command`, `Deno.serve`, and the `Deno.*` file APIs. Nothing is routed through another runtime's compatibility layer.
- **Selected by you, reported honestly.** `pboss runtime` tells you the configured selection and the engine actually executing on demand.
- **Same features everywhere.** Process lifecycle, cluster mode, logs, health checks, cron restarts, watch mode, the dashboard, and Prometheus metrics behave identically under all three runtimes.

See [Runtimes](/runtimes) for the full architecture — the adapter layer, the detection order, and the native API map.

## Why pboss?

pboss is a production-grade process supervisor that speaks each runtime's native language. The daemon starts in under 50ms and idles around ~12MB of RAM on every supported runtime. It is one binary-shaped package — install once with any package manager, and it manages your JavaScript and TypeScript applications.

The managed side follows the same focus: JavaScript and TypeScript apps get first-class treatment — per-machine runner resolution (`bun run` → `deno run -A` → `node`, with TypeScript under Node powered by [tsx](https://github.com/privatenumber/tsx)).

## Feature highlights

- **Runtime-agnostic core** — executes under Bun, Node.js, or Deno, each through its native APIs ([Runtimes](/runtimes)).
- **First-class JS/TS runtimes** — managed JavaScript and TypeScript apps resolve their runner per machine: `bun run` → `deno run -A` → `node`, TypeScript under Node through tsx ([Runtimes](/runtimes)).
- **Process management** — start, stop, restart, reload, delete, scale; crash restart, restart strategies, memory-limit restarts, tree killing.
- **Cluster mode** — N instances, per-worker env, automatic ports, zero-downtime rolling reloads; spawned by your runtime's native process API ([Cluster mode](/cli/cluster)).
- **Foreground mode** — `--no-daemon` blocks as PID 1, for Docker and Kubernetes.
- **Web dashboard** — live WebSocket updates, CPU/memory charts, process controls, log viewer. Zero dependencies.
- **Prometheus metrics** — dedicated `/metrics` endpoint, ready for Grafana.
- **Logs** — automatic capture, size-based rotation, retention, gzip, real-time tailing.
- **Health checks** — HTTP probes with interval, timeout, and failure threshold; unhealthy processes restart.
- **Cron restarts** — scheduled restarts with standard cron expressions.
- **File watching** — restart on changes, with configurable paths and ignore patterns.
- **Ecosystem files** — declare your whole topology in one JSON, JS, or TypeScript file.
- **Persistence (default on)** — process list saved after every change; boot service installed at install time — apps survive restarts and reboots.
- **Remote deployment** — SSH deploys with git pull, release directories, symlink rotation, pre/post hooks.
- **Environment management** — per-process env vars, with `.env` file support.
- **Module system** — plugins that hook into the process manager lifecycle.
- **IPC architecture** — the CLI talks to one machine-level daemon over WebSocket on a Unix socket.

## pboss vs ProcBoss Cloud

| | pboss (open source) | ProcBoss Cloud |
|---|---|---|
| Runs where | Your machines, containers | Your machines — linked to procboss.com |
| Process control | ✅ full CLI + dashboard | ✅ same CLI, same commands |
| Fleet overview across servers | per-machine | one dashboard for every linked server |
| Alerts + cron job visibility | — | ✅ |
| Linking a machine | — | `pboss cloud connect` (see [ProcBoss Cloud](/cloud)) |
| Your user login on any CLI | — | `pboss login` / `pboss whoami` |

The CLI is the same tool in both cases. The cloud layer is purely additive: `pboss cloud connect` opens an outbound link that reports state and accepts remote commands — the CLI keeps working exactly as before, even if the machine goes offline or you unlink it.

## Where to go next

- New to pboss? Start with [Installation](/installation), then the [Quickstart](/quickstart).
- Which runtime will pboss use on your machine — and how does it stay native on each? Read [Runtimes](/runtimes).
- Running processes in production? Read [Foreground mode & Docker](/guide/docker) and [Startup scripts](/cli/startup).
- Curious how it works inside? Read [Architecture](/architecture).
- Want cookbook patterns? Browse [Recipes](/recipes).
- Want the fleet dashboard? Jump to [ProcBoss Cloud](/cloud).
- Looking for a specific command? Browse the [CLI reference](/cli/processes).
