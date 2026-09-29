---
title: Installation
description: Install pboss with your package manager of choice — Bun, npm, or Deno. One requirement — any single supported runtime. No root required anywhere.
section: getting-started
order: 2
---

## Requirements

- **Platforms:** Linux, macOS, and Windows.
- **Runtimes — any ONE of:** [Bun](https://bun.sh) (≥ 1.0), [Node.js](https://nodejs.org) (≥ 20.19), or [Deno](https://deno.com) (2.x recommended). pboss is runtime-agnostic: it executes under whichever one you already have, through that runtime's native APIs. Having two or three is fine too — nothing conflicts, nothing gets chosen.
- **Privileges:** none. No root, no `sudo`, no Administrator — anywhere: not for installing, not for the boot service.

<!-- 2026-09-29: the one-line universal installer is commented out while the
     product focuses on JS/TS package-manager installs. Re-add verbatim when
     it returns (keep it a single HTML comment — nothing here renders).

## One-line install

The universal installer's only runtime-related job is to make sure **at least one supported runtime exists**:

| What it finds | What it does |
|---|---|
| Bun, Node, or Deno (any one, or several) | nothing — nothing installed, nothing selected |
| none of the three | installs Bun (the only runtime side effect it ever has) |

It then installs the **published pboss package, globally** — `bun install -g pboss`, `npm install -g pboss`, or `deno install -g -A npm:pboss`, whichever package manager is available — and sets up the per-user boot service. The `pboss` command lands in the package manager's bin directory (`~/.bun/bin`, the npm prefix, or `~/.deno/bin`), and the installer adds it to your `PATH` automatically when missing. No root required on any platform.

The installer never selects a runtime, never persists a preference (there is no `PBOSS_RUNTIME` to set), and never compiles anything — no git clone, no toolchain. Which runtime executes pboss is decided at run time by the `pboss` command you invoke, and the installer ends by printing it: `Executing runtime: Bun 1.3.14` (for example).

**Linux / macOS:**

```bash
curl -fsSL https://procboss.com/install.sh | bash
```

**Windows (PowerShell):**

```powershell
powershell -c "irm https://procboss.com/install.ps1 | iex"
```

**Windows (Command Prompt):**

```cmd
curl -fsSL https://procboss.com/install.cmd | cmd
```

-->

## Install with your package manager of choice

Prefer to install pboss yourself? The same published package works everywhere — pick the runtime you already use. Every method below is a global install and sets up nothing beyond the `pboss` command; the per-user boot service comes with `pboss startup install`.

### Bun

```bash
bun add -g pboss
```

If you don't have Bun yet: `curl -fsSL https://bun.sh/install | bash` (Linux/macOS) or `powershell -c "irm bun.sh/install.ps1 | iex"` (Windows). The `pboss` shim lands in `~/.bun/bin`. Update later with `bun update -g pboss`.

### Node.js (npm)

```bash
npm install -g pboss
```

The `pboss` shim lands in npm's global bin directory — `%APPDATA%\npm` on Windows, or the prefix `npm config get prefix` reports on Linux/macOS. On machines where that prefix is root-owned and you are not root, do it by hand with `npm config set prefix ~/.npm-global`. Update later with `npm install -g pboss@latest`.

### Deno

```bash
deno install -g -A npm:pboss
```

The `pboss` shim lands in `~/.deno/bin`. Deno is **deny-by-default** — a fresh install without permission flags will prompt (or fail, in scripts) the moment pboss touches the filesystem, network, or a child process. Grant what a process manager needs at install time — see the next section.

### Deno's permission system

Deno's security model requires every capability to be granted explicitly. pboss is a supervisor: it spawns processes, reads and writes state and logs, and serves sockets. These are the permissions it uses, and why:

| Permission | Why pboss needs it |
|---|---|
| `--allow-run` | Spawn your applications, interpreters, and restart helpers via `Deno.Command` — the heart of a process manager |
| `--allow-read` | Read ecosystem/config files, logs, `/proc/<pid>` metrics, and the saved process list |
| `--allow-write` | Write `~/.pboss` state (dump, pids), log files, and gzip rotations |
| `--allow-net` | The daemon's Unix-socket IPC, the dashboard and metrics servers, and the outbound cloud link |
| `--allow-env` | Inherit the full environment for managed processes, honor `PBOSS_*` variables |
| `--allow-sys` | Host CPU count, load, and memory for the dashboard and Prometheus metrics |

The recommended install grants exactly that set:

```bash
deno install -g --allow-run --allow-read --allow-write --allow-net --allow-env --allow-sys npm:pboss
```

Or the short form that grants all of the above at once:

```bash
deno install -g -A npm:pboss
```

Things worth knowing:

- **Prompts vs. scripts.** A missing permission triggers an interactive prompt in a terminal, but a hard `PermissionDenied` error when stdin is not a TTY (cron, systemd, CI). A process manager is headless by nature — grant at install time.
- **The daemon runs with full access anyway.** When pboss starts its daemon under Deno, it re-executes it with `deno run -A`, because supervising arbitrary applications needs every capability. The flags above are what your interactive `pboss` CLI calls need.
- **Scoping is possible but tight.** `--allow-read=$HOME/.pboss`-style restrictions work mechanically, but pboss legitimately reads ecosystem files wherever your apps live and needs the whole environment for child inheritance — scope only on machines you fully control, and expect to widen later.
- **One-off use, no install:** `deno run -A npm:pboss <command>` (same permissions, nothing on PATH).

### Run without installing

Every runtime can run pboss straight from the registry:

```bash
bunx pboss list
npx pboss list
deno run -A npm:pboss list
```

This is great for trying pboss or for one-shot scripts. For supervision that survives reboots, use a real install above so the boot service can start it.

### From source (development)

```bash
git clone https://github.com/procboss/pboss.git
cd pboss
bun install
bun run src/index.ts --version
```

Bun is pboss's **development toolchain** (tests, bundling, the compiled-binary builds) — having it as the toolchain does not make it the runtime you must run in production. `bun run ./scripts/build-dist.ts` produces the same `dist/cli.js` the npm package ships, which also executes directly under Node (`node dist/cli.js`) and Deno (`deno run -A dist/cli.js`).

## Verify the installation

```bash
pboss --version
pboss --runtime
```

`--runtime` reports the runtime actually executing pboss right now — `Runtime: Node.js 24.21.0`, for example. For the full picture, `pboss runtime` adds the runtime version and how pboss was installed. If the command is not found, make sure the install directory is on your `PATH`: `~/.bun/bin` (Bun), npm's global bin directory (npm), or `~/.deno/bin` (Deno) — a new terminal is usually all it takes.

## Updating

| Method | Update command |
|---|---|
| Bun global | `bun update -g pboss` |
| npm global | `npm install -g pboss@latest` |
| Deno global | `deno install -g -A npm:pboss` |
| From source | `git pull && bun install && bun run ./scripts/build-dist.ts` |

<!-- 2026-09-29: hidden with the universal installer. Re-add when it returns:
     | One-line installer | re-run the same `curl -fsSL https://procboss.com/install.sh \| bash` command | -->

Or just run `pboss upgrade` — it detects how pboss was installed and updates through the same channel.

**Upgrading from a pre-1.5.0 one-line install?** Older installers compiled a standalone binary into `~/.local/bin` (or `/usr/local/bin`). `pboss upgrade` re-runs the installer for you and switches the machine to the published package. Afterwards, `which -a pboss` shows every `pboss` on PATH; remove any leftover compiled copy so the package install wins.

The daemon is started on demand, so after an update simply run any `pboss` command — no separate daemon restart is needed.

Reinstalls and upgrades keep everything: the process list and the cloud link (credential in `~/.pboss`) survive the binary swap. `pboss upgrade` restarts the daemon and verifies the link came back, and `pboss cloud status` picks one up even if it appeared after the daemon started.
