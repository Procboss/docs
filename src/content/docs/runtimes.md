---
title: Runtimes
description: pboss is runtime-agnostic — one package that executes natively on Bun, Node.js, or Deno through each runtime's own APIs — and manages JavaScript and TypeScript first-class.
section: getting-started
order: 4
---

This page answers both runtime questions: **which runtime runs pboss itself**, and **which runtimes pboss manages for your apps**.

## The runtime pboss runs on

pboss is a **runtime-agnostic process manager for Bun, Node.js, and Deno**. One published package executes under any of the three — and under each one it uses that runtime's **own native APIs**, never a compatibility layer and never a lowest-common-denominator mode. The native performance and features of each runtime are kept, not sacrificed: Bun's fast process spawning, Node's battle-tested HTTP stack, Deno's security model all stay in play.

The principle in one line: **ProcBoss is runtime-agnostic, not runtime-generic.** "Runtime-generic" would mean writing once against the least common denominator and running it anywhere — every runtime reduced to the intersection of all three. pboss refuses that. Being runtime-agnostic means one CLI with one feature set, implemented natively per runtime, three times.

### One package, three runtimes

The same npm package — installed with `npm install -g pboss`, `bun add -g pboss`, or `deno install -g -A --min-dep-age=0 --name pboss --reload --force npm:pboss/deno-entry` — is what every runtime executes. Which one that is, is **your explicit, persistent selection**: the installer asks (or takes `--runtime=`), the first `pboss` run asks, and the answer is saved in `~/.pboss/.runtime`. Several runtimes coexisting is not a conflict — the selection decides, and `pboss runtime change` switches it.

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

Inside a running pboss, the executing runtime is identified by what it **is**, not by which compatibility APIs happen to be reachable — the selection already decided which entrypoint launched (the wrapper dispatches to `dist/cli.node.js`, `cli.bun.js`, or `cli.deno.js`); detection tells the core which adapter to load:

1. **Bun** — the `Bun` global. Bun also exposes `process.versions.node` (full Node compatibility), so a Node-first check would misclassify every Bun as a Node.
2. **Deno** — the `Deno` global. Deno's node-compat layer provides `process` for npm packages, so it too must be checked before Node.
3. **Node.js** — `process.versions.node`.

Anything else fails immediately with the supported list — Bun, Node.js, Deno — and pointers to each. There is no silent fallback to Node: a runtime *supporting* Node's APIs is not the same as *being* Node.

### Which runtime is executing pboss?

```bash
pboss runtime      # Configured / Executing / Install — the full picture
```

`pboss runtime` reports the configured selection and the engine actually executing pboss right now, plus the install flavor (for example, `package install running on the system Node.js runtime`), which is also what the boot-service comments record on install. `--runtime=<x>` runs one invocation under another runtime; `pboss runtime change` switches the selection permanently.

### Cluster mode is native per runtime, too

When you scale an app (`--instances 4`), each worker is an independent process spawned by **the executing runtime's native process API** — `Bun.spawn` under Bun, `node:child_process` under Node, `Deno.Command` under Deno. `node:cluster` is Node's own clustering module; it is never used to implement clustering under Bun or Deno, and pboss's Node implementation uses Node's process spawning directly. Details in [Cluster mode](/cli/cluster).

## The runtimes pboss manages

pboss gives **JavaScript and TypeScript first-class treatment**: Bun, Node.js, and Deno apps resolve their runner per machine — `bun run` → `deno run -A` → `node` — natively, with no interpreter configuration.

<!-- 2026-09-29: multi-language support is hidden while the product focuses on JS/TS
     backends. Re-add when it returns: "In addition to that trio, pboss manages
     everything else on the machine — other languages, compiled binaries, and shell
     scripts — detected by file extension, overridable with `--interpreter`." -->

### The JS/TS interpreter chain

On a machine with several runtimes, JavaScript and TypeScript apps resolve their runner in this order:

1. **Bun** — `bun run` (TS-native; pboss's original worker runtime)
2. **Deno** — `deno run -A` (TS-native)
3. **Node.js** — plain `node` for `.js`/`.mjs`/`.cjs`; for TypeScript, **[tsx](https://github.com/privatenumber/tsx)** when usable, falling back to `--experimental-strip-types` on Node ≥ 22.6

`--interpreter` overrides the chain per app — for example `--interpreter node` pins Node semantics for one process even where Bun exists.

### TypeScript under Node: tsx

Node's built-in type stripping only handles **erasable** TypeScript — it rejects enums, namespaces, parameter properties, and other syntax that needs a real transform. So when the chain lands on Node for a `.ts`/`.tsx`/`.jsx`/`.mts` file, pboss runs it through **[tsx](https://github.com/privatenumber/tsx)**, the established TypeScript runner for Node — full TypeScript, tsconfig `paths` included. A usable copy is found in this order:

1. **Your app's own `node_modules`** — the version your app pinned wins
2. **`tsx` on `PATH`** — a global install
3. **The copy pboss ships** — tsx is an optional dependency of the pboss package, so an npm/bun global install of pboss carries one

When none is usable, Node's `--experimental-strip-types` (Node ≥ 22.6) remains the zero-dependency fallback. An explicit `--interpreter node` is always verbatim — pboss never injects tsx over a deliberate choice.

### Running Bun applications

```bash
# TypeScript, JS, JSX — bun runs them all natively
pboss start server.ts --name bun-api

# Pass Bun flags
pboss start server.ts --node-args "--smol"
```

Where Bun is installed it sits at the top of the chain above — every JS/TS app defaults to it, which is also the runtime pboss itself was born on.

### Running Node.js applications

```bash
# Run with the Node.js interpreter
pboss start server.js --interpreter node --name node-api

# Pass Node.js / V8 flags
pboss start server.js --interpreter node --node-args "--max-old-space-size=4096"
```

A machine with only Node installed runs every JS/TS app on Node — TypeScript included, through tsx per the chain above. PM2-style apps port over directly; `--interpreter node` opts a specific process into Node.js semantics where Bun exists.

### Running Deno applications

```bash
# Deno runs your app with full permissions by default (deno run -A)
pboss start server.ts --interpreter "deno run -A" --name deno-api

# Or state WHAT the app may do — the runtime-unique --permissions flag
pboss start server.ts --interpreter deno --permissions allow-net,allow-read=./config

# A zero-permission Deno app (the -A default is dropped, nothing replaces it)
pboss start worker.ts --interpreter deno --perms none
```

The interpreter chain picks Deno automatically when Bun is absent; the explicit forms above pin it. `--permissions` (short form `--perms`) is **Deno only** — the one pboss runtime with a permission model gets a first-class option, silently ignored under Bun and Node. There is deliberately no single-letter alias — `-p` is already `--port` (PM2 parity), and a `-P`/`-p` typo would silently set the port. pboss itself under Deno is a separate question — see [Installation](/installation#denos-permission-system) for the permissions the process manager needs.

Entries are `allow-<category>` / `deny-<category>` with an optional `=value` scoping (`allow-net=api.example.com`, `allow-env=FOO,BAR`), plus `all` (`-A`) and `none`; categories: `read`, `write`, `net`, `env`, `run`, `sys`, `ffi`, `hrtime`. The same list lives in ecosystem files as `permissions: ["allow-net", "deny-write"]`, and a permission already stated in `--interpreter-args` is never duplicated.

<!-- 2026-09-29: multi-language support is hidden while the product focuses on JS/TS
     backends. Re-add verbatim when it returns (keep it a single HTML comment —
     nothing here renders).

### Every other stack, still managed

Beyond the first-class trio, runners are auto-detected from the file extension — same lifecycle, same restart policies, same logs, same dashboard:

| Language | Extension | Runner | Example |
|---|---|---|---|
| Python | `.py` | `python3` (or `python`) | `pboss start worker.py` |
| Go | `.go` | `go run` | `pboss start main.go` |
| Ruby / PHP | `.rb` / `.php` | `ruby` / `php` | `pboss start app.rb` |
| Java | `.jar` | `java -jar` | `pboss start app.jar` |
| Shell | `.sh`, `.bash` | `sh` / `bash` | `pboss start job.sh` |
| Windows scripts | `.bat`, `.cmd`, `.ps1` | `cmd.exe` / `powershell.exe` | `pboss start script.bat` |
| Compiled binaries (Go / Rust / C / C++) | *(no ext)*, `.bin`, `.exe` | direct execution | `pboss start ./my-go-server` |

Any executable can serve as the interpreter, with arguments — including a virtualenv's Python (`--interpreter ./venv/bin/python`, the recommended venv pattern, no activation step) or a fully permission-scoped Deno invocation:

```bash
pboss start app.ts --interpreter "deno run -A"
pboss start script.py --interpreter python3 --interpreter-args "-u"
```

-->

### How pboss finds the JS/TS interpreter

JavaScript and TypeScript workers are spawned by the **daemon** — and the daemon often runs where no login shell ever set a `PATH`: as a systemd service on Linux, a launchd agent on macOS, or a scheduled task on Windows. A PATH-only lookup would miss the most common install locations even though `which bun` finds them in your shell.

**For Bun**, pboss resolves through a full chain, in order: `PATH` → `$BUN_INSTALL/bin` → `~/.bun/bin` → `/usr/local/bin`, `/usr/bin`, `/opt/bun/bin` → `/opt/homebrew/bin` (macOS Homebrew on Apple Silicon, not on a launchd PATH).

**For Deno and Node**, the same rule with their locations: Deno through `PATH` then `~/.deno/bin`; Node through `PATH` then `/usr/local/bin` — plus one shortcut: when pboss itself runs under Node, the executing `node` is the interpreter.

Three layers make this work everywhere: the worker spawn uses the **absolute resolved path** (surviving any PATH); the boot service's `PATH` includes the user's `~/.bun/bin` when present (workers that call a runtime by name resolve); and the daemon prepends the discovered runtime directory to its own `PATH` at startup, healing daemons started by older service definitions. If no runtime exists at all, the error lists every location checked, per runtime, before suggesting `--interpreter` or `--interpreter none`.
