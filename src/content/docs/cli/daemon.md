---
title: Daemon control
description: pboss ping and pboss kill — check daemon health, stop everything, and how the CLI talks to the daemon.
section: cli
order: 12
---

pboss uses a daemonized architecture: the CLI communicates with a long-running daemon process over a Unix domain socket using the WebSocket protocol. Most commands need the daemon — and it's started on demand if it isn't running.

## pboss ping

Check if the daemon is running:

```bash
pboss ping
```

Useful as a health check in scripts and for quickly verifying an install before anything else.

## pboss kill

Stop all processes and kill the daemon:

```bash
pboss kill
```

This is the "everything off" switch: every managed process is stopped, then the daemon exits. Running any other pboss command afterwards starts a fresh daemon.

## How the daemon fits together

- **On-demand startup** — the first command that needs the daemon spawns it (under 50ms start, ~12MB RAM).
- **One daemon per machine** — all CLI invocations, the dashboard, and the metrics endpoint talk to the same daemon over its Unix socket.
- **Foreground exception** — `--no-daemon` skips all of this and supervises in-process; see [Foreground mode](/guide/docker).
- **Reboots** — pair `pboss save` with `pboss startup install` and the OS service starts the daemon at boot, which resurrects your saved processes; see [Startup scripts](/cli/startup).

## Troubleshooting

If commands hang or the socket seems stuck, check [Troubleshooting — daemon won't start](/troubleshooting#daemon-wont-start) for the diagnostic sequence (`pboss ping`, socket location, stale lockfiles).
