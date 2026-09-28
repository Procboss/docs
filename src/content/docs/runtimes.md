---
title: Runtimes
description: pboss is runtime-agnostic — one package that executes natively on Bun, Node.js, or Deno through each runtime's own APIs — and manages applications in every language.
section: getting-started
order: 4
---

This page answers both runtime questions: **which runtime runs pboss itself**, and **which runtimes pboss manages for your apps**.

## The runtime pboss runs on

pboss is a **runtime-agnostic process manager for Bun, Node.js, and Deno**. One published package executes under any of the three — and under each one it uses that runtime's **own native APIs**, never a compatibility layer and never a lowest-common-denominator mode. The native performance and features of each runtime are kept, not sacrificed: Bun's fast process spawning, Node's battle-tested HTTP stack, Deno's security model all stay in play.

The principle in one line: **ProcBoss is runtime-agnostic, not runtime-generic.** "Runtime-generic" would mean writing once against the least common denominator and running it anywhere — every runtime reduced to the intersection of all three. pboss refuses that. Being runtime-agnostic means one CLI with one feature set, implemented natively per runtime, three times.

### One package, three runtimes

The same npm package — installed with `bun add -g pboss`, `npm install -g pboss`, or `deno install -g npm:pboss` — is what every runtime executes. Nothing about your machine is baked in at install time: the runtime is detected when the `pboss` command runs, every run. Several runtimes coexisting is not a conflict, and no preference is ever persisted.

### The adapter layer

```text
                        ┌──────────────────────┐
                        │      PBoss Core      │
                        │  (CLI, daemon, all   │
                        │       features)      │
                        └──────────┬───────────┘
                                   │  speaks capability
                                   │  interfaces only
                        ┌──────────▼───────────┐
                        │    Runtime Adapter    │
                        │  (one, chosen once)   │
                        └───┬─────────┬──────────┘
                    ┌───────┘         └───────┐
              ┌─────▼─────┐           ┌───────▼───────┐
              │    Bun    │           │  Node / Deno  │
              └─────┬─────┘           └───────┬───────┘
                    │                         │
             Bun native APIs        Node / Deno native APIs
```

The core (process management, clustering, logs, monitoring, the dashboard) never mentions a runtime. Each adapter implements one small capability interface — process spawning, files, network, misc — with its runtime's native APIs. Detection happens once per process; the adapter is a singleton, and hot paths call the resolved native implementations directly. There is no per-call branching, no re-detection, no dynamic loading in the middle of supervising a process.

### The native API map

| What pboss does | Bun | Node.js | Deno |
|---|---|---|---|
| Spawn & supervise processes | `Bun.spawn` | `node:child_process` | `Deno.Command` |
| File & state I/O | `Bun.file` / `Bun.write` | `node:fs/promises` | `Deno.readTextFile` / `Deno.writeFile` / `Deno.stat` |
| Dashboard & daemon servers | `Bun.serve` | `node:http` | `Deno.serve` |
| Dashboard live updates | native WebSocket | `ws` * | `Deno.upgradeWebSocket` |
| CLI ↔ daemon transport | `fetch` over a Unix socket | HTTP client over `socketPath` | `Deno.connect` (Unix socket) |
| Log compression | `Bun.gzipSync` | `node:zlib` | `node:zlib` † |

\* Node core has no native WebSocket *server* — the dashboard rides `ws`, the de-facto standard library. It is the one dependency pboss ships, loaded lazily, and it exists precisely because there is no native API to use instead.

\† Deno implements `node:` modules natively itself — `node:zlib` under Deno is Deno's own implementation, the same rule Bun follows for the file APIs below.

**Shared where sharing is better.** Synchronous file operations use `node:fs` on all three runtimes — not as a Node compatibility trick, but because Bun and Deno both implement the `node:` module spec natively themselves. That is shared code running on each runtime's own implementation, which is exactly where sharing beats wrapping.

### Detection: once, in this order

The runtime is identified by what it **is**, not by which compatibility APIs happen to be reachable:

1. **Bun** — the `Bun` global. Bun also exposes `process.versions.node` (full Node compatibility), so a Node-first check would misclassify every Bun as a Node.
2. **Deno** — the `Deno` global. Deno's node-compat layer provides `process` for npm packages, so it too must be checked before Node.
3. **Node.js** — `process.versions.node`.

Anything else fails immediately with the supported list — Bun, Node.js, Deno — and pointers to each. There is no silent fallback to Node: a runtime *supporting* Node's APIs is not the same as *being* Node.

### Which runtime is executing pboss?

```bash
pboss --runtime    # Runtime: Bun 1.3.14
pboss runtime      # Runtime / Version / Install — the full picture
```

Both report the truth at the moment you ask. `pboss runtime` adds the install flavor (for example, `package install running on the system Node.js runtime`), which is also what the boot-service comments record on install.

### Cluster mode is native per runtime, too

When you scale an app (`--instances 4`), each worker is an independent process spawned by **the executing runtime's native process API** — `Bun.spawn` under Bun, `node:child_process` under Node, `Deno.Command` under Deno. `node:cluster` is Node's own clustering module; it is never used to implement clustering under Bun or Deno, and pboss's Node implementation uses Node's process spawning directly. Details in [Cluster mode](/cli/cluster).

## The runtimes pboss manages

pboss runs and supervises any application, programming language, runtime, or compiled binary. Interpreters for JS/TS apps are auto-detected per machine; anything else is auto-detected from the file extension, and you can override any of it with `--interpreter`.

### The JS/TS interpreter chain

On a machine with several runtimes, JavaScript and TypeScript apps resolve their runner in this order:

1. **Bun** — `bun run` (TS-native; pboss's original worker runtime)
2. **Deno** — `deno run -A` (TS-native)
3. **Node.js** — plain `node` for `.js`/`.mjs`/`.cjs`; `--experimental-strip-types` for `.ts`/`.tsx`/`.jsx`/`.mts` on Node ≥ 22.6

`--interpreter` overrides the chain per app — for example `--interpreter node` pins Node semantics for one process even where Bun exists.

### Runtime matrix

| Runtime / Language | File extension | Auto-detected runner | Example |
|---|---|---|---|
| **TypeScript / JSX** | `.ts`, `.tsx`, `.jsx`, `.mts` | `bun run` → `deno run -A` → `node --experimental-strip-types` | `pboss start server.ts` |
| **JavaScript** | `.js`, `.mjs`, `.cjs` | `bun run` → `deno run -A` → `node` | `pboss start app.js` |
| **Python** | `.py` | `python3 <file>` (or `python`) | `pboss start worker.py` |
| **Go** | `.go` | `go run <file>` | `pboss start main.go` |
| **Compiled binaries (Go / Rust / C / C++)** | *(no ext)*, `.bin`, `.exe` | Direct binary execution | `pboss start ./my-go-server` |
| **Ruby** | `.rb` | `ruby <file>` | `pboss start app.rb` |
| **PHP** | `.php` | `php <file>` | `pboss start server.php` |
| **Java** | `.jar` | `java -jar <file>` | `pboss start app.jar` |
| **Shell / Bash** | `.sh`, `.bash` | `sh <file>` / `bash <file>` | `pboss start job.sh` |
| **Windows scripts** | `.bat`, `.cmd`, `.ps1` | `cmd.exe` / `powershell.exe` | `pboss start script.bat` |
| **Custom interpreter** | *any* | Custom runtime via `--interpreter` | `pboss start app.ts --interpreter "deno run -A"` |

### How pboss finds the JS/TS interpreter

JavaScript and TypeScript workers are spawned by the **daemon** — and the daemon often runs where no login shell ever set a `PATH`: as a systemd service on Linux, a launchd agent on macOS, or a scheduled task on Windows. A PATH-only lookup would miss the most common install locations even though `which bun` finds them in your shell.

**For Bun**, pboss resolves through a full chain, in order: `PATH` → `$BUN_INSTALL/bin` → `~/.bun/bin` → `/usr/local/bin`, `/usr/bin`, `/opt/bun/bin` → `/opt/homebrew/bin` (macOS Homebrew on Apple Silicon, not on a launchd PATH).

**For Deno and Node**, the same rule with their locations: Deno through `PATH` then `~/.deno/bin`; Node through `PATH` then `/usr/local/bin` — plus one shortcut: when pboss itself runs under Node, the executing `node` is the interpreter.

Three layers make this work everywhere: the worker spawn uses the **absolute resolved path** (surviving any PATH); the boot service's `PATH` includes the user's `~/.bun/bin` when present (workers that call a runtime by name resolve); and the daemon prepends the discovered runtime directory to its own `PATH` at startup, healing daemons started by older service definitions. If no runtime exists at all, the error lists every location checked, per runtime, before suggesting `--interpreter` or `--interpreter none`.

### Running native binaries (Go, Rust, C/C++)

Compiled executables are executed directly with zero interpreter wrapper:

```bash
# Start a compiled Go or Rust binary
pboss start ./dist/my-go-api --name api --instances 4

# Run with explicit direct binary mode
pboss start ./my-binary --interpreter none
```

Everything else works identically: `--instances`, `--max-memory-restart`, health checks, log rotation, and the dashboard all apply to native binaries the same way they apply to scripts.

### Running Python services

```bash
# Auto-detects python3 on Linux/macOS or python on Windows
pboss start worker.py --name py-worker

# Custom virtualenv Python interpreter
pboss start worker.py --interpreter ./venv/bin/python
```

Pointing `--interpreter` at a virtualenv's Python is the recommended way to run venv-based services — the process runs with the venv's packages without any activation step.

### Running Node.js applications

```bash
# Run with the Node.js interpreter
pboss start server.js --interpreter node --name node-api

# Pass Node.js / V8 flags
pboss start server.js --interpreter node --node-args "--max-old-space-size=4096"
```

Where Bun is installed, JS/TS apps default to it (the top of the chain above); `--interpreter node` opts a specific process into Node.js semantics. PM2-style apps port over directly, and a machine with only Node installed runs every JS/TS app on Node — TypeScript included, via type stripping on Node ≥ 22.6.

### Running Deno applications

```bash
# Deno runs your app with full permissions by default (deno run -A)
pboss start server.ts --interpreter "deno run -A" --name deno-api

# Narrow your app's permissions with a custom interpreter
pboss start server.ts --interpreter "deno run --allow-net --allow-read" --name deno-api
```

The interpreter chain picks Deno automatically when Bun is absent; the explicit form above pins it and lets you choose your **app's** permission set. pboss itself under Deno is a separate question — see [Installation](/installation#denos-permission-system) for the permissions the process manager needs.

### Custom interpreters

Any executable can serve as the interpreter, with arguments:

```bash
pboss start app.ts --interpreter "deno run -A"
```

The `--interpreter-args` flag separates interpreter arguments from your script's arguments if you prefer them split:

```bash
pboss start script.py --interpreter python3 --interpreter-args "-u"
```

### Recipes

```bash
# TypeScript server — runs on Bun, Deno, or Node per the chain above
pboss start server.ts --name ts-api

# Node.js server, pinned
pboss start server.js --interpreter node --name node-api

# Deno server, pinned, with a scoped permission set
pboss start server.ts --interpreter "deno run --allow-net" --name deno-api

# Go — source in dev, binary in prod
pboss start main.go --name go-dev
pboss start ./dist/my-go-server --name go-prod --instances 4

# Python worker
pboss start worker.py --name py-worker

# Java JAR service
pboss start app.jar --name java-service
```

Whatever you start, the rest of pboss applies: restart policies, [cluster mode](/cli/cluster) (where the app supports multiple instances), [log management](/cli/logs), [health checks](/guide/config#health-check-options), and the [dashboard](/cli/dashboard).
