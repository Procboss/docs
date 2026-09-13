---
title: Processes
description: pboss process management commands — start, stop, restart, reload, delete, scale, describe, list, signal, reset.
section: cli
order: 1
---

Every command accepts a **target**: a numeric id (`0`), a process name (`my-api`), a namespace (`my-namespace`), or `all`. A target that matches a process name (or its cluster instances) always wins; otherwise a namespace target operates on **every process in the group**. Unknown targets are clear errors — `Process or namespace "x" not found — nothing to <verb>` — instead of a silent no-op.

## Namespaces

A namespace is a first-class grouping mechanism, not just metadata. Assign one at start, and every lifecycle verb accepts it as a target:

```bash
pboss start ./web.ts    --name web    --namespace my-app
pboss start ./api.ts    --name api    --namespace my-app
pboss start ./worker.ts --name worker --namespace my-app

pboss restart my-app   # the whole group, in one command
pboss stop my-app      # ✓ Stopped 3 processes in namespace "my-app"
pboss start my-app     # resume every stopped member — atomically
pboss delete my-app    # confirmed first — or --force to skip
```

Group operations report what they touched (a one-line summary above the process table), and the auto-saved dump follows immediately, so the group state survives reboots by default. `pboss list` shows the namespace column.

### Atomic startup ([#31](https://github.com/Procboss/pboss/issues/31))

A namespace is one lifecycle group, so starting it is **atomic**. If any member fails to start, the members **that start invocation brought up** are rolled back — stopped, best-effort, in reverse start order. The original failure stays the primary error; rollback results are reported separately:

```text
namespace "my-app" startup failed: Script not found: ./worker.ts
Rollback: ✓ api stopped, ✓ web stopped
```

The rollback boundary is strictly **invocation-scoped**:

- Members that were **already running** are never rolled back — only what the operation itself started.
- A namespace failure never touches **other namespaces** or **standalone** (namespace-less) processes.
- `pboss start all` applies the same boundaries: standalone processes start independently, every namespace resumes atomically as one unit.
- Namespace `restart` is stop-all + atomic start with the same rollback contract. Namespace `stop`/`reload`/`delete` are best-effort across members — one stubborn member does not leave the rest of the group mid-operation.
- Same-namespace operations are **serialized** — two terminals cannot interleave a `restart` and a `stop` on one group. Different namespaces stay independent.

Standalone behavior is unchanged: a process without a namespace is fully independent, and a failing standalone app never rolls back or blocks the others in an [ecosystem](/cli/ecosystem) start.

### Member-exit policy: `onNsMemberExit`

A namespaced process can decide what to do when **another member of its namespace exits for good** — a terminal stop, or a crash after the restart budget is exhausted. Not a pboss-initiated stop, and not a crash that auto-restart is already handling:

- `ignore` *(default)* — do nothing. Each member keeps running on its own.
- `exit` — stop this process too, so the namespace either runs complete or not at all.

```bash
pboss start ./web.ts --name web --namespace my-app --on-ns-member-exit exit
```

```js
// ecosystem.config.js
module.exports = {
  apps: [
    { name: "web", script: "./web.ts", namespace: "my-app", onNsMemberExit: "exit" },
    { name: "api", script: "./api.ts", namespace: "my-app", onNsMemberExit: "exit" },
  ],
};
```

The policy is per-app and only applies to processes **with** a namespace — standalone processes are never affected by another process's exit. pboss-initiated stops (user stop, rollback, the policy itself) never trigger the policy again, so it cannot cascade. The setting persists in the process dump and survives daemon restarts.

## pboss start

Start a new process or processes.

```bash
pboss start server.ts
```

`pboss start <name|namespace>` — when the positional is not an existing script or config file — **resumes** processes that already exist: every stopped member comes back online, online ones are untouched, nothing new is created. Resuming a **namespace** is atomic — if any member fails to start, only the members this invocation started are rolled back.

```bash
pboss start my-app   # resume every stopped process in the namespace — atomically
pboss start api      # resume one stopped process by name
```

```bash
pboss start server.ts --name api -- --port 8080 --host 0.0.0.0
```

```bash
pboss start server.ts --name api --env NODE_ENV=production --env API_KEY=xxx
```

```bash
pboss start server.ts --name api --max-memory-restart 512M
```

```bash
pboss start script.py --interpreter python3
```

```bash
pboss start server.ts --name api --wait-ready --listen-timeout 10000
```

Arguments after `--` are passed through to your script. The same set of options is available in [ecosystem files](/cli/ecosystem) and the [configuration reference](/guide/config).

### Options

| Flag | Description | Default |
|---|---|---|
| `--name <name>` | Process name | Script filename |
| `--instances <n>` | Number of instances. Use `max` for all CPUs | `1` |
| `--exec-mode <mode>` | `fork` or `cluster` | `fork` |
| `--cwd <path>` | Working directory | Current directory |
| `--env <KEY=VAL>` | Environment variable (repeatable) | — |
| `--interpreter <bin>` | Custom interpreter binary | Auto-detected |
| `--interpreter-args <args>` | Arguments for the interpreter | — |
| `--node-args <args>` | Additional runtime arguments | — |
| `--max-memory-restart <size>` | Restart when memory exceeds limit | — |
| `--max-restarts <n>` | Maximum consecutive restarts | `16` |
| `--min-uptime <ms>` | Minimum uptime before a restart is considered stable | `1000` |
| `--restart-delay <ms>` | Delay between restarts | `0` |
| `--kill-timeout <ms>` | Grace period before SIGKILL | `5000` |
| `--no-autorestart` | Disable automatic restart | `false` |
| `--cron <expression>` | Cron expression for scheduled restarts | — |
| `--watch` | Enable file watching | `false` |
| `--ignore-watch <dirs>` | Directories to ignore | `node_modules,.git` |
| `--port <n>` | Base port (auto-incremented in cluster mode) | — |
| `--namespace <ns>` | Process namespace for grouping | — |
| `--on-ns-member-exit <policy>` | Reaction to a namespace sibling's terminal exit: `ignore` or `exit` (namespaced processes only) | `ignore` |
| `--wait-ready` | Wait for process ready signal | `false` |
| `--listen-timeout <ms>` | Timeout waiting for ready signal | `3000` |
| `--source-map-support` | Enable source map support | `false` |
| `--merge-logs` | Merge all instance logs into one file | `false` |
| `--log-date-format <fmt>` | Date format prefix for log lines | — |
| `--output <file>` | Custom stdout log path | `~/.pboss/logs/<name>-<id>-out.log` |
| `--error <file>` | Custom stderr log path | `~/.pboss/logs/<name>-<id>-error.log` |
| `--log-max-size <size>` | Max log file size before rotation | `10M` |
| `--log-retain <n>` | Number of rotated log files to keep | `5` |
| `--log-compress` | Gzip rotated log files | `false` |
| `--health-check-url <url>` | HTTP endpoint for health probes | — |
| `--health-check-interval <ms>` | Probe interval | `30000` |
| `--health-check-timeout <ms>` | Probe timeout | `5000` |
| `--health-check-max-fails <n>` | Failures before restart | `3` |
| `--no-daemon`, `-d` | Run in foreground without a daemon (blocks) | `false` |
| `--raw` | Also send child logs to stdout/stderr while retaining log files | `false` |

> **Flags are position-independent.** `--no-daemon` (and all other flags) may appear anywhere relative to the script path:
>
> ```bash
> pboss start --no-daemon app.ts
> pboss start app.ts --no-daemon
> pboss start --name api --no-daemon app.ts --watch
> ```

## pboss stop

Stop a process, all processes with a name, or all processes.

```bash
pboss stop 0
pboss stop my-api
pboss stop my-namespace
pboss stop all
```

A namespace target stops every member of the group (and only those), with a one-line summary naming the group. `all` on an empty list stays a no-op. Group stops are best-effort: a member that refuses to stop does not prevent the others, and the surviving errors are aggregated into one honest report.

Stopping is graceful by default: the process receives `SIGTERM` and has the kill timeout (default 5s) to exit before `SIGKILL` is sent.

## pboss restart

Stop and restart a process. The process is fully stopped and then re-spawned — there **will** be downtime. For zero-downtime reloads, use `reload`.

```bash
pboss restart my-api
pboss restart my-namespace
pboss restart all
```

A namespace target restarts every member — including members that were stopped (restart on a stopped process starts it). The restart is **atomic**: stop-all, then an atomic start — if any member fails to come back, the members this restart brought up are rolled back, while members that never stopped (a failed stop) stay running.

## pboss reload

Graceful zero-downtime reload. New instances start before old ones are killed, ensuring your application always has live workers handling requests.

```bash
pboss reload my-api
pboss reload my-namespace
pboss reload all
```

A namespace reload reloads every member, best-effort — one member failing to reload does not skip the rest of the group. (Atomicity does not apply: graceful reload is zero-downtime by design.)

The reload works per instance:

1. A new process is spawned.
2. pboss waits for it to become stable (or emit a ready signal when `--wait-ready` is enabled).
3. The old process receives `SIGTERM` and the kill timeout to shut down gracefully.
4. The cycle moves to the next instance.

## pboss delete

Stop and remove a process from pboss's management.

```bash
pboss delete 0
pboss delete my-api
pboss delete my-namespace
pboss delete my-namespace --force
pboss delete all
```

Deleting a **namespace** removes every process in the group, best-effort — every member is removed even if one refuses to stop. Because that can take several processes at once, pboss asks for confirmation first — `[y/N]` in a terminal, and a hard refusal with a `--force` hint when stdin is not a TTY (scripts, CI, pipes). Name and cluster deletes keep their old unconfirmed behavior, as does `delete all`.

## pboss scale

Dynamically scale a process group up or down.

```bash
pboss scale my-api 8
pboss scale my-api 2
```

When scaling up, new instances inherit the configuration of existing instances. When scaling down, the highest-numbered instances are stopped and removed first.

## pboss describe

Show detailed information about a process.

```bash
pboss describe my-api
```

```text
┌─────────────────────┬──────────────────────────────────────────┐
│ Name                │ my-api-0                                 │
│ ID                  │ 0                                        │
│ Status              │ online                                   │
│ PID                 │ 4521                                     │
│ Exec Mode           │ cluster                                  │
│ Instances           │ 4                                        │
│ Uptime              │ 2h 15m                                   │
│ Restarts            │ 0                                        │
│ Unstable Restarts   │ 0                                        │
│ CPU                 │ 0.3%                                     │
│ Memory              │ 42.1 MB                                  │
│ File Handles        │ 24                                       │
│ Script              │ /home/user/app/server.ts                 │
│ CWD                 │ /home/user/app                           │
│ Interpreter         │ bun                                      │
│ Watch               │ disabled                                 │
│ Max Memory Restart  │ 512 MB                                   │
│ Health Check        │ http://localhost:3000/health (healthy)    │
│ Cron Restart        │ disabled                                 │
│ Namespace           │ production                               │
│ Created             │ 2025-02-11T10:30:00.000Z                 │
│ Out Log             │ /home/user/.pboss/logs/my-api-0-out.log    │
│ Error Log           │ /home/user/.pboss/logs/my-api-0-error.log  │
└─────────────────────┴──────────────────────────────────────────┘
```

## pboss list

List all managed processes with status, resource usage, and uptime. Supports a **live mode** with auto-refresh and interactive keyboard shortcuts.

```bash
pboss list
pboss list --live
```

Live mode keyboard shortcuts:

| Key | Action |
|---|---|
| `R` | Reload table manually |
| `M` | Sort by memory usage |
| `C` | Sort by CPU usage |
| `U` | Sort by uptime |
| `Q` | Quit live mode |

Live mode refreshes the table every second by default; sorting can be changed on the fly with the shortcuts above.

## pboss signal

Send an OS signal to a process.

```bash
pboss signal my-api SIGUSR2
```

## pboss reset

Reset the restart counter for a process.

```bash
pboss reset my-api
pboss reset all
```
