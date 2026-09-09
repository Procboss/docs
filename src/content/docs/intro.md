---
title: Introduction
description: What ProcBoss is — pboss, the universal open-source process manager built on Bun, and ProcBoss Cloud for fleet visibility across your servers.
section: getting-started
order: 1
---

**ProcBoss** comes in two parts that work independently and together:

- **pboss** — a blazing-fast, universal process manager built on Bun native APIs. Run, cluster, monitor, and manage any application — Node.js, Bun, Go, Python, Rust, Ruby, PHP, Java, binaries, shell scripts. Open source (GPLv3), by [procboss.com](https://procboss.com).
- **ProcBoss Cloud** (procboss.com) — the optional hosted layer: link the servers you already run, get fleet visibility, alerts, and metrics from one dashboard.

## Why pboss?

pboss is a production-grade, runtime-agnostic process manager built on native Bun APIs — it manages any program, language, or stack. `Bun.spawn` for orchestration, `Bun.serve` for the dashboard and IPC, native `WebSocket` over Unix sockets, `Bun.file` for I/O, `Bun.gzipSync` for log compression. One daemon: <50ms start, ~12MB RAM.

## Feature highlights

- **Universal multi-language support** — auto-detected: Node.js, Bun, Go, Python, Rust, Ruby, PHP, Java JARs, shell scripts, compiled binaries. See [Languages & runtimes](/runtimes).
- **Process management** — start, stop, restart, reload, delete, scale; crash restart, restart strategies, memory-limit restarts, tree killing.
- **Cluster mode** — N instances, per-worker env, automatic ports, zero-downtime rolling reloads.
- **Foreground mode** — `--no-daemon` blocks as PID 1, for Docker and Kubernetes.
- **Web dashboard** — live WebSocket updates, CPU/memory charts, process controls, log viewer. Zero dependencies.
- **Prometheus metrics** — dedicated `/metrics` endpoint, ready for Grafana.
- **Logs** — automatic capture, size-based rotation, retention, gzip, real-time tailing.
- **Health checks** — HTTP probes with interval, timeout, and failure threshold; unhealthy processes restart.
- **Cron restarts** — scheduled restarts with standard cron expressions.
- **File watching** — restart on changes, with configurable paths and ignore patterns.
- **Ecosystem files** — declare your whole topology in one JSON or TypeScript file.
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
| Alerts & uptime history | — | ✅ |
| Linking a machine | — | `pboss cloud connect` (see [ProcBoss Cloud](/cloud)) |
| Your user login on any CLI | — | `pboss login` / `pboss whoami` |

The CLI is the same tool in both cases. The cloud layer is purely additive: `pboss cloud connect` opens an outbound link that reports state and accepts remote commands — the CLI keeps working exactly as before, even if the machine goes offline or you unlink it.

## Where to go next

- New to pboss? Start with [Installation](/installation), then the [Quickstart](/quickstart).
- Not running Bun? Read [Languages & runtimes](/runtimes) — pboss manages Go, Python, Java, and more.
- Running processes in production? Read [Foreground mode & Docker](/guide/docker) and [Startup scripts](/cli/startup).
- Curious how it works inside? Read [Architecture](/architecture).
- Want cookbook patterns? Browse [Recipes](/recipes).
- Want the fleet dashboard? Jump to [ProcBoss Cloud](/cloud).
- Looking for a specific command? Browse the [CLI reference](/cli/processes).
