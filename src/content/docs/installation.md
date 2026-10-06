---
title: Installation
description: Install pboss with your runtime of choice — Node.js, Bun, or Deno — through the one-line installer or your package manager. The runtime is your explicit, persistent selection. No root required anywhere.
section: getting-started
order: 2
---

## Requirements

- **Platforms:** Linux, macOS, and Windows.
- **Runtimes — any ONE of:** [Node.js](https://nodejs.org) (≥ 20.19), [Bun](https://bun.sh) (≥ 1.0), or [Deno](https://deno.com) (2.x recommended). pboss is runtime-agnostic: it executes under whichever one of the three you **select**, through that runtime's native APIs. Having two or three is fine too — nothing conflicts, your selection decides.
- **Privileges:** none. No root, no `sudo`, no Administrator — anywhere: not for installing, not for the boot service.

## One-line install

The universal installer makes **you** choose the runtime — it never guesses from whatever happens to be installed:

| What you give it | What it does |
|---|---|
| `--runtime=node`, `--runtime=bun`, or `--runtime=deno` | uses exactly that runtime — installs the runtime itself when missing, then installs the published pboss package through that runtime's package ecosystem |
| nothing (interactive) | asks which runtime to use — Node is the default; pressing Enter selects it |
| nothing, no terminal (CI, scripts) | stops and asks you to re-run with an explicit `--runtime` — never a silent fallback |

Your choice is **saved** to `~/.pboss/.runtime` (`%USERPROFILE%\.pboss\.runtime` on Windows) — a plain-text, single-word file that every later `pboss` invocation, and every upgrade, reads back. It never lives inside the package directory, so updating pboss never resets it.

The interactive prompt looks like this:

```text
Kindly select your runtime:

  1. Node
  2. Bun
  3. Deno

Select runtime [1]:
```

**Linux / macOS:**

```bash
curl -fsSL https://procboss.com/install.sh | sh
```

Select the runtime up front instead of being asked:

```bash
curl -fsSL https://procboss.com/install.sh | sh -s -- --runtime=node
curl -fsSL https://procboss.com/install.sh | sh -s -- --runtime=bun
curl -fsSL https://procboss.com/install.sh | sh -s -- --runtime=deno
```

**Windows (PowerShell, no Administrator needed):**

```powershell
powershell -c "irm https://procboss.com/install.ps1 | iex"
```

The installer also accepts `-Runtime node|bun|deno` on the PowerShell command line, sets up the per-user boot service, and adds the install directory to your `PATH` when missing.

> **On Windows, install through the one-line installer — and update only with `pboss upgrade`.** npm and Bun link the `pboss` command as a small shell-script wrapper, which cmd and PowerShell cannot execute natively; the installer writes real `pboss.cmd` / `pboss.ps1` shims instead, and `pboss upgrade` re-heals them after every update. Package-manager updates skip that step — see [Updating](#updating).

## Install with your package manager of choice

Prefer to install pboss yourself? The same published package works everywhere — install it with the package manager of the runtime it should run under. The first `pboss` invocation then asks you to pick the runtime once (or set it immediately with `pboss --runtime=<node|bun|deno> --version`) and saves the answer. Every method below is a global install and sets up nothing beyond the `pboss` command; the per-user boot service comes with `pboss startup install`.

### Node.js (npm)

```bash
npm install -g pboss
```

The `pboss` shim lands in npm's global bin directory — `%APPDATA%\npm` on Windows, or the prefix `npm config get prefix` reports on Linux/macOS. On machines where that prefix is root-owned and you are not root, do it by hand with `npm config set prefix ~/.npm-global`. Update later with `npm install -g pboss@latest`.

> **Windows note:** npm links `pboss` as a small shell wrapper. On plain Windows (cmd or PowerShell without Git Bash on `PATH`), use the [PowerShell installer](#one-line-install) instead — it writes native `pboss.cmd` / `pboss.ps1` shims into the package manager's bin directory. With Git Bash on `PATH`, the npm-installed wrapper runs as-is.

### Bun

```bash
bun add -g pboss
```

If you don't have Bun yet: `curl -fsSL https://bun.sh/install | bash` (Linux/macOS) or `powershell -c "irm bun.sh/install.ps1 | iex"` (Windows). The `pboss` shim lands in `~/.bun/bin`.

Seeing `error: refusing to install dependency with unsafe name` from Bun? That is a corrupted Bun global state — it breaks every `bun install -g`, not just pboss's — and it has a fix: see [Troubleshooting](/troubleshooting). The one-line installer heals it automatically before installing.

### Deno

```bash
deno install -g -A --min-dep-age=0 --name pboss --reload --force npm:pboss/deno-entry
```

The `pboss` shim lands in `~/.deno/bin`. Deno executes npm package bins as **modules**, so a shell wrapper cannot serve the Deno path — the `/deno-entry` subpath hands Deno the JavaScript entrypoint (`dist/cli.deno.js`) directly, and `--name pboss` puts the command on your `PATH`.

`--reload` re-resolves the spec against the live registry instead of Deno's local cache (a stale cached resolution is the other way an old version sticks around), and `--force` overwrites an existing installation — the same command installs, reinstalls, and upgrades in place.

**Deno's 24-hour supply-chain hold.** Deno refuses npm versions published within the last day: an unpinned spec silently installs the *previous* release right after we publish, and an exact pin of a fresh version errors with `Could not find npm package`. The `--min-dep-age=0` flag in the command above is Deno's own escape hatch (the short form of `--minimum-dependency-age=0`, Deno ≥ 2.9): it disables the hold so the spec resolves the release just published — older Deno has no hold, omit the flag there.

The universal installer, `runtime change`, and `pboss upgrade` pass the flag automatically whenever the local Deno supports it — the installer pins the exact version it installs, while `runtime change` and `pboss upgrade` run the same unpinned command; older Denos pin the newest resolvable version instead. To pin manually, use `npm:pboss@<version>/deno-entry` together with the flag.

Deno is **deny-by-default** — a fresh install without permission flags will prompt (or fail, in scripts) the moment pboss touches the filesystem, network, or a child process. Grant what a process manager needs at install time — see the next section.

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
deno install -g --min-dep-age=0 --name pboss --reload --force --allow-run --allow-read --allow-write --allow-net --allow-env --allow-sys npm:pboss/deno-entry
```

Or the short form that grants all of the above at once — the canonical install command:

```bash
deno install -g -A --min-dep-age=0 --name pboss --reload --force npm:pboss/deno-entry
```

Things worth knowing:

- **Prompts vs. scripts.** A missing permission triggers an interactive prompt in a terminal, but a hard `PermissionDenied` error when stdin is not a TTY (cron, systemd, CI). A process manager is headless by nature — grant at install time.
- **The daemon runs with full access anyway.** When pboss starts its daemon under Deno, it re-executes it with `deno run -A`, because supervising arbitrary applications needs every capability. The flags above are what your interactive `pboss` CLI calls need.
- **Scoping is possible but tight.** `--allow-read=$HOME/.pboss`-style restrictions work mechanically, but pboss legitimately reads ecosystem files wherever your apps live and needs the whole environment for child inheritance — scope only on machines you fully control, and expect to widen later.
- **One-off use, no install:** `deno run -A --min-dep-age=0 npm:pboss/deno-entry list` (same permissions, nothing on PATH — the `/deno-entry` subpath and the hold-bypass flag, just like the install command).

### Run without installing

Every runtime can run pboss straight from the registry:

```bash
bunx pboss list
npx pboss list
deno run -A --min-dep-age=0 npm:pboss/deno-entry list
```

This is great for trying pboss or for one-shot scripts. For supervision that survives reboots, use a real install above so the boot service can start it.

### From source (development)

```bash
git clone https://github.com/procboss/pboss.git
cd pboss
bun install
bun run src/index.ts --version
```

Bun is pboss's **development toolchain** (tests, bundling, the compiled-binary builds) — having it as the toolchain does not make it the runtime you must run in production. `bun run ./scripts/build-dist.ts` produces the bundle the npm package ships, which also executes directly under Node (`node dist/cli.node.js`) and Deno (`deno run -A dist/cli.deno.js`).

## The runtime selection

`pboss` never guesses a runtime from whatever happens to be installed — the runtime is **your** explicit, persistent choice, stored in `~/.pboss/.runtime`:

- **First run** — if nothing is configured yet, `pboss` asks once (interactive terminals only) and saves the answer. On a machine with no selection and no terminal, pass the flag explicitly: `pboss --runtime=bun --version`.
- **`--runtime=<node|bun|deno>`** — run one invocation under a runtime. When nothing is configured yet it *initializes* the persistent selection; when a different runtime is configured it overrides for that invocation only — the CLI says so and keeps the file untouched.
- **`pboss runtime`** — show the configured runtime, the executing engine, and how pboss was installed.
- **`pboss runtime change`** — switch permanently: interactive, installs the new runtime when missing, installs/updates the published pboss package for it, and only then flips the selection (a failure keeps the old one).

The `pboss` command itself is a small shell/PowerShell wrapper (`bin/pboss.sh` / `bin/pboss.ps1`) that reads the selection and dispatches to that runtime's own entrypoint — so a Bun-only machine works without Node anywhere, and `pboss runtime change` is all it takes to switch. The wrapper needs no JavaScript runtime to start, which is exactly how it can be the one binary npm links for every runtime mix.

## Verify the installation

```bash
pboss --version
pboss runtime
```

`pboss runtime` reports the configured runtime, the one actually executing pboss right now, and the install mode — `Runtime: Node.js 24.21.0` plus two more lines, for example. If the command is not found, make sure the install directory is on your `PATH`: `~/.bun/bin` (Bun), npm's global bin directory (npm), or `~/.deno/bin` (Deno) — a new terminal is usually all it takes.

## Updating

The one blessed path, every platform and install method:

```bash
pboss upgrade
```

It resolves the update channel **from your configured runtime** (npm for Node, `bun update -g` for Bun, the same unpinned Deno install command with the hold bypassed for Deno) and updates through it. The selection itself (`~/.pboss/.runtime`) is never touched by any update path, and on Windows the native `pboss.cmd` / `pboss.ps1` shims are re-healed after the update — the command keeps working.

> **On Windows, `pboss upgrade` is the only supported way to update.** npm and Bun regenerate their own shims when they update the package — wrappers that cmd and PowerShell cannot run. `pboss upgrade` repairs them afterwards; a raw `npm install -g pboss@latest` or `bun update -g pboss` does not, and the `pboss` command breaks.

Manual commands for Linux and macOS, for when you maintain the install yourself:

| Method | Update command |
|---|---|
| One-line installer | re-run the same `curl -fsSL https://procboss.com/install.sh \| sh` command |
| npm global | `npm install -g pboss@latest` |
| Bun global | `bun update -g pboss` |
| Deno global | `deno install -g -A --min-dep-age=0 --name pboss --reload --force npm:pboss/deno-entry` (Deno ≥ 2.9 — the hold bypassed, the unpinned spec resolves the true latest; older Deno pins the newest resolvable version) |
| From source | `git pull && bun install && bun run ./scripts/build-dist.ts` |

**Upgrading from a pre-1.5.0 one-line install?** Older installers compiled a standalone binary into `~/.local/bin` (or `/usr/local/bin`). `pboss upgrade` re-runs the installer for you and switches the machine to the published package. Afterwards, `which -a pboss` shows every `pboss` on PATH; remove any leftover compiled copy so the package install wins.

The daemon is started on demand, so after an update simply run any `pboss` command — no separate daemon restart is needed.

Reinstalls and upgrades keep everything: the process list and the cloud link (credential in `~/.pboss`) survive the binary swap. `pboss upgrade` restarts the daemon and verifies the link came back, and `pboss cloud status` picks one up even if it appeared after the daemon started.
