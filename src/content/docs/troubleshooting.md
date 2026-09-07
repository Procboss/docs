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

## "the Bun runtime was not found" — but bun IS installed

The error appears when Bun lives where the daemon cannot see it — typically `~/.bun/bin` (the default `curl bun.sh/install` location) while the daemon was started by systemd/launchd with a minimal service PATH. `which bun` works in your shell because YOUR shell has that directory on PATH; the daemon does not.

pboss searches `PATH`, `$BUN_INSTALL/bin`, `~/.bun/bin`, `/usr/local/bin`, `/usr/bin`, and `/opt/bun/bin` (plus `/opt/homebrew/bin` on macOS) — so if the error still fires, Bun genuinely is not in any of them **for the user the daemon runs as** (for example, Bun installed only for a different account). Check:

```bash
ls -l ~/.bun/bin/bun                # the default location
echo $BUN_INSTALL                   # set by the bun.sh installer
pboss startup status                # whose ~/.pboss the daemon uses
```

Fixes, in order of preference: install Bun for the daemon's user (`curl -fsSL https://bun.sh/install | bash`), set `BUN_INSTALL` in the unit (`sudo systemctl edit pboss` → `Environment=BUN_INSTALL=/opt/bun`), or pick another runtime for that process (`--interpreter node`, `--interpreter none` for binaries). After installing Bun, restart the service: `sudo systemctl restart pboss`.

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
