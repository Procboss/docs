---
title: Introduction
description: What ProcBoss is — pboss, the universal open-source process manager built on Bun, and ProcBoss Cloud for fleet visibility across your servers.
section: getting-started
order: 1
---

**ProcBoss** comes in two parts that work independently and together:

- **pboss** — a blazing-fast, universal production process manager built on Bun native APIs. Run, cluster, monitor, and manage any application — Node.js, Bun, Go, Python, Rust, Ruby, PHP, Java, native binaries, and shell scripts — with pure performance and zero overhead. Open source (GPLv3), by [procboss.com](https://procboss.com).
- **ProcBoss Cloud** (procboss.com) — a hosted layer on top of pboss: link the servers you already run, and get fleet visibility, alerts, and metrics from one dashboard.

## Why pboss?

ProcBoss (pboss) is a universal, production-grade process manager built from the ground up for modern developer and DevOps workflows. While engineered on native Bun APIs for maximum throughput and minimal memory overhead, pboss is completely **runtime-agnostic** and manages any program, language, or software stack.

pboss replaces complex, heavyweight process managers with a clean, ultra-fast architecture. It uses `Bun.spawn` for lightning-fast process orchestration, `Bun.serve` for the real-time web dashboard and IPC, native `WebSocket` over Unix sockets, `Bun.file` for high-performance I/O, and `Bun.gzipSync` for automatic log compression. The result is a single machine-level daemon that starts in under 50ms, uses only ~12MB of RAM, and manages your entire infrastructure seamlessly.

## Feature highlights

- **Universal multi-language support** — native auto-detection and execution for Node.js, Bun, Go, Python, Rust, Ruby, PHP, Java JARs, shell scripts, Windows scripts, and compiled binaries. See [Languages & runtimes](/runtimes).
- **Process management** — start, stop, restart, reload, delete, and scale processes with automatic crash restart, configurable restart strategies, memory-limit restarts, and tree killing.
- **Cluster mode** — run multiple instances with per-worker environment injection, automatic port assignment, and zero-downtime rolling reloads.
- **Foreground mode** — `--no-daemon` blocks as PID 1 for Docker, Kubernetes, and any platform that expects the entrypoint to stay in the foreground.
- **Web dashboard** — a self-contained dark-themed dashboard with live WebSocket updates, CPU/memory charts, process controls, and a log viewer. No external dependencies.
- **Prometheus metrics** — a dedicated `/metrics` endpoint in Prometheus exposition format, ready for Grafana.
- **Log management** — automatic capture, size-based rotation, retention, optional gzip compression, and real-time tailing.
- **Health checks** — HTTP probes with configurable intervals, timeouts, and failure thresholds that automatically restart unhealthy processes.
- **Cron restarts** — schedule periodic restarts with standard cron expressions.
- **File watching** — automatic restart on changes, with configurable watch paths and ignore patterns.
- **Ecosystem files** — declare your whole topology in one JSON or TypeScript file.
- **Persistence (default on)** — the process list is saved automatically after every change and the boot service is installed at install time, keeping your apps alive across daemon restarts and system reboots.
- **Remote deployment** — SSH-based deploys with git pull, release directories, symlink rotation, and pre/post hooks.
- **Environment management** — store, retrieve, and inject environment variables per process, with `.env` file support.
- **Module system** — extend pboss with plugins that hook into the process manager lifecycle.
- **IPC architecture** — a daemonized design where the CLI talks to a single machine-level daemon over WebSocket on a Unix socket.

## pboss vs ProcBoss Cloud

| | pboss (open source) | ProcBoss Cloud |
|---|---|---|
| Runs where | Your machines, containers | Your machines — linked to procboss.com |
| Process control | ✅ full CLI + dashboard | ✅ same CLI, same commands |
| Fleet overview across servers | per-machine | one dashboard for every linked server |
| Alerts & uptime history | — | ✅ |
| Linking a machine | — | `pboss login` (see [ProcBoss Cloud](/cloud)) |

The CLI is the same tool in both cases. The cloud layer only adds visibility: when you run `pboss login` on a machine, that machine starts reporting heartbeats (metrics and process lists) to your ProcBoss Cloud account — the CLI keeps working exactly as before, even if the machine goes offline.

## Where to go next

- New to pboss? Start with [Installation](/installation), then the [Quickstart](/quickstart).
- Not running Bun? Read [Languages & runtimes](/runtimes) — pboss manages Go, Python, Java, and more.
- Running processes in production? Read [Foreground mode & Docker](/guide/docker) and [Startup scripts](/cli/startup).
- Curious how it works inside? Read [Architecture](/architecture).
- Want cookbook patterns? Browse [Recipes](/recipes).
- Want the fleet dashboard? Jump to [ProcBoss Cloud](/cloud).
- Looking for a specific command? Browse the [CLI reference](/cli/processes).
