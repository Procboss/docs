---
title: Troubleshooting
description: Fixes for common pboss problems — daemon won't start, restart loops, memory, port conflicts, log growth, dashboard access, and containers that exit.
section: more
order: 3
---

Quick fixes for the most common issues. If your case isn't here, the [pboss repo](https://github.com/Procboss/pboss/issues) takes bug reports with the output of `pboss describe <name>` and `pboss logs <name> --err`.

## Daemon won't start

If pboss commands hang or return connection errors, the daemon may have died without cleanup. Remove the stale socket/PID files and try again — the daemon is spawned on demand:

```bash
rm -f ~/.pboss/daemon.sock ~/.pboss/daemon.pid
pboss list
```

## "EBUSY: resource busy or locked, open" right after boot (Windows)

The daemon is almost certainly already running — started at logon by the boot task — and an old pboss could not see it: the CLI's liveness check asked the socket *file* in a way that cannot see a live socket, concluded the daemon was dead, and tried to start a second one whose log files collided with the running daemon's launcher. Fixed in v1.4.6 (`pboss --version`). After upgrading, `pboss ping` answers from the running daemon and `~/.pboss/daemon.err.log` stays clean.

## Saved processes didn't come back after a reboot (Windows)

The daemon auto-starts (`pboss ping` answers) but `pboss list` is empty: installs before v1.4.7 started only the daemon at logon — nothing ran the boot resurrect (the Windows twin of Linux's `ExecStartPost`). Re-run `pboss startup install` so the hidden launcher is regenerated, then reboot once more: saved processes come back at logon. If they still don't, `~\.pboss\resurrect.err.log` says why (timeout, script not found), and `pboss resurrect` restores the list manually.

## "no JavaScript/TypeScript runtime was found" — but one IS installed

The error fires when pboss cannot find **any** of Bun, Deno, or Node for a JS/TS worker — usually because the runtime lives where the daemon cannot see it. The typical case: the runtime is in a user bin directory (`~/.bun/bin`, `~/.deno/bin` — the default `curl`-installer locations) while the daemon was started by systemd/launchd with a minimal service PATH. `which bun` works in your shell because YOUR shell has that directory on PATH; the daemon does not.

pboss searches, per runtime: **Bun** — `PATH`, `$BUN_INSTALL/bin`, `~/.bun/bin`, `/usr/local/bin`, `/usr/bin`, `/opt/bun/bin`, and `/opt/homebrew/bin` on macOS; **Deno** — `PATH`, `~/.deno/bin`; **Node** — `PATH`, `/usr/local/bin` (plus the node running pboss itself, when pboss executes under Node). If the error still fires, no runtime is in any of them **for the user the daemon runs as** — for example, installed only for a different account. Check:

```bash
ls -l ~/.bun/bin/bun ~/.deno/bin/deno 2>/dev/null  # the default locations
echo $BUN_INSTALL                                # set by the bun.sh installer
pboss startup status                              # whose ~/.pboss the daemon uses
```

Fixes, in order of preference: install any runtime for the daemon's user (Bun: `curl -fsSL https://bun.sh/install | bash`), set `BUN_INSTALL` in the unit (`systemctl --user edit pboss` → `Environment=BUN_INSTALL=/opt/bun`), or pick the interpreter explicitly for that process (`--interpreter node`, `--interpreter "deno run -A"`, `--interpreter none` for binaries). After installing a runtime, restart the service: `systemctl --user restart pboss`.

## Which runtime is pboss running on?

Not sure what a given machine is executing pboss with? Ask it:

```bash
pboss runtime      # Configured / Executing / Install — the full picture
```

`pboss runtime` also prints the install flavor (`package install running on the system Node.js runtime`, for example), which is what the boot-service comments record too. To run pboss under a different runtime — on this invocation or permanently — see the selection semantics in [Installation](/installation#the-runtime-selection): `--runtime=<x>` overrides one invocation, `pboss runtime change` switches the persistent selection (installing the new runtime and package for you).

## "Unsupported runtime" error

pboss executes under Bun, Node.js, and Deno — anything else (or something exotic enough to evade detection) stops with the supported list rather than silently guessing. The error names the environment it saw and the three runtimes it supports, with a URL for each. Run pboss with one of the three, and it detects which — once, at startup, honestly.

## "Invalid ProcBoss runtime configuration" error

`~/.pboss/.runtime` holds your selection — one lowercase word: `node`, `bun`, or `deno`. If the file exists but contains anything else (a hand edit gone wrong, a corrupted write), pboss refuses to guess: it stops with this error and the supported list, on every entry point — the wrapper, the installer, and `runtime change` all validate against the same list. Fix it by writing the word back:

```bash
echo node > ~/.pboss/.runtime    # or bun, or deno
```

Or delete the file and pick again on the next run — pboss asks once, the same first-run prompt.

## Deno: PermissionDenied when running pboss

Deno is deny-by-default. A pboss shim installed without permission flags prompts in interactive terminals and fails with `PermissionDenied` in scripts, the moment pboss spawns a process or touches a file. Re-install with the permission set a process manager needs — the table and the recommended command are in [Installation](/installation#denos-permission-system).

## Process keeps restarting

Check the error logs for crash information:

```bash
pboss logs my-app --err --lines 100
```

If the process exits too quickly, it may hit the max restart limit. Check the `minUptime` and `maxRestarts` settings:

```bash
pboss describe my-app
```

Reset the counter if needed:

```bash
pboss reset my-app
```

## High memory usage

If a process is using excessive memory and you have `maxMemoryRestart` configured, pboss will restart it automatically. You can also check the metrics history:

```bash
pboss metrics --history 3600
```

## Port conflicts

In cluster mode, each instance uses `basePort + instanceIndex`. Ensure no other services are using those ports:

```bash
lsof -i :3000-3007
```

On macOS and Windows, also read [cluster mode's platform limitations](/cli/cluster#platform-limitations) — `reusePort` sharing is Linux-only, so workers on those platforms need distinct ports.

## Log files growing too large

Enable log rotation:

```bash
pboss start server.ts --log-max-size 50M --log-retain 5 --log-compress
```

Or flush existing logs:

```bash
pboss flush my-app
```

## Dashboard not accessible

Ensure the dashboard is started and check the port:

```bash
pboss dashboard --port 9615
curl http://localhost:9615
```

If running behind a firewall, ensure ports 9615 (dashboard) and 9616 (metrics) are open — and keep both bound to localhost unless fronted by an authenticated proxy. See the [security note](/guide/dashboard-api#security-note).

## Checking daemon health

```bash
pboss ping
```

This returns the daemon PID and uptime. If it doesn't respond, the daemon needs to be restarted (any command re-spawns it).

## Container exits immediately

If your Docker container exits right after starting, you are likely missing `--no-daemon`. Without it, pboss daemonizes and the foreground process exits, causing Docker to stop the container.

```dockerfile
# ❌ Wrong — pboss daemonizes and the container exits
CMD ["pboss", "start", "./server.ts"]

# ✅ Correct — pboss stays in the foreground
CMD ["pboss", "start", "--no-daemon", "./server.ts"]
```

See [Foreground mode & Docker](/guide/docker) for the full container story.

## Where pboss keeps its files

All data lives in `~/.pboss/`:

```text
~/.pboss/
├── daemon.sock          # Unix domain socket for IPC
├── daemon.pid           # Daemon process ID
├── dump.json            # Saved process list (pboss save)
├── config.json          # Global configuration
├── env-registry.json    # Stored environment variables
├── logs/                # Process log files
│   ├── my-api-0-out.log
│   ├── my-api-0-error.log
│   ├── my-api-0-out.log.1.gz
│   └── daemon-out.log
├── pids/                # PID files
│   └── my-api-0.pid
├── metrics/             # Persisted metric snapshots
└── modules/             # Installed pboss modules
```

Cloud credentials live separately: the machine link at `~/.pboss/cloud.json`, the user login at `~/.pboss/cloud-user.json` (both 0600) — see [Linking a server](/cloud/link-server).
