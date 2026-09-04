---
title: Foreground mode & Docker
description: Run pboss as PID 1 with --no-daemon for Docker, Kubernetes, and Railway; --raw for container logs; compose and Kubernetes examples.
section: guides
order: 1
---

By default, pboss spawns a background daemon process and returns immediately — ideal for long-running servers. However, containerized environments like **Docker**, **Kubernetes**, and **Railway** expect the entrypoint process to stay in the **foreground**. If pboss daemonizes and exits, the container stops.

Use `--no-daemon` (alias `-d`) to run pboss in **foreground / blocking mode**. In this mode:

- No background daemon is spawned.
- The `pboss start` process itself stays alive, blocking the terminal (or container).
- All managed child processes are supervised in-process.
- Auto-restart and crash recovery still work normally.
- The process exits only when all child processes stop or a signal (e.g. `SIGTERM`) is received.

## Flags

| Flag | Alias | Description |
|---|---|---|
| `--no-daemon` | `-d` | Run in foreground without spawning a background daemon |

## Usage

```bash
# Foreground — blocks until the process exits
pboss start --no-daemon server.ts

# Flag order is flexible — these are all equivalent
pboss start server.ts --no-daemon
pboss start --no-daemon server.ts --name api
pboss start --name api --no-daemon server.ts
```

## Docker

This is the recommended pattern for running pboss inside a Docker container. The `CMD` instruction should use `--no-daemon` so pboss stays as PID 1 (or the foreground entrypoint) and Docker can track its lifecycle correctly.

**Dockerfile**

```dockerfile
FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .

# Install pboss globally
RUN bun add -g pboss

# Use --no-daemon so pboss stays in the foreground
CMD ["pboss", "start", "--no-daemon", "./server.ts"]
```

### Docker logs and log files

Use `--raw` with `--no-daemon` to keep pboss log files while also exposing the managed process output to the container runtime:

```dockerfile
CMD ["pboss", "start", "--no-daemon", "--raw", "ecosystem.config.cjs"]
```

`--raw` mirrors child stdout to pboss stdout and child stderr to pboss stderr. It does not disable `outFile` or `errorFile`.

**With additional options**

```dockerfile
CMD ["pboss", "start", "--no-daemon", "--name", "api", "--instances", "2", "./server.ts"]
```

**With an ecosystem file**

```dockerfile
CMD ["pboss", "start", "--no-daemon", "ecosystem.config.json"]
```

> **Note:** Ecosystem file support with `--no-daemon` behaves identically to normal mode — all `apps` entries are started and supervised in-process.

## Docker Compose

```yaml
services:
  api:
    build: .
    ports:
      - "3000:3000"
    command: ["pboss", "start", "--no-daemon", "./server.ts"]
    restart: unless-stopped
```

## Kubernetes

```yaml
containers:
  - name: api
    image: your-org/api:latest
    command: ["pboss", "start", "--no-daemon", "./server.ts"]
```

## Behavior differences vs. daemon mode

| Behavior | Daemon mode (default) | Foreground mode (`--no-daemon`) |
|---|---|---|
| CLI returns immediately | ✅ | ❌ — blocks |
| Background daemon spawned | ✅ | ❌ |
| Unix socket IPC | ✅ | ❌ |
| Auto-restart on crash | ✅ | ✅ |
| `pboss list` / `pboss logs` from another shell | ✅ | ❌ — no daemon to query |
| Suitable for Docker / containers | ❌ | ✅ |
| Suitable for long-running servers | ✅ | ✅ |

## Not running Bun apps?

Foreground mode works for every runtime pboss supports — the container story is the same for a Go binary, a Python worker, or a Java JAR:

```dockerfile
CMD ["pboss", "start", "--no-daemon", "./dist/my-go-server"]
```

See [Languages & runtimes](/runtimes) for the full matrix.
