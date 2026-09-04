---
title: Programmatic API
description: Drive pboss from TypeScript — zero-ceremony imports, the PBoss singleton, events, error handling, and direct ProcessManager usage.
section: guides
order: 5
---

pboss exposes a complete programmatic API. A single machine only needs **one instance** of the process manager — every API function, static method, and singleton instance automatically communicates with that single machine-level daemon.

## Zero-ceremony quick start

Import and call API methods directly — no initialization, construction (`new`), or connection ceremony:

```ts
// 1. Direct function exports (zero initialization needed)
import { getProcesses, list, describe, start, stop, restart } from "pboss";

// Read existing processes immediately
const processes = await getProcesses();
console.log(processes);

// Start, stop, or manage processes
await start({ script: "./server.ts", name: "api", instances: 4, port: 3000 });
await restart("api");
```

```ts
// 2. Default singleton import
import pboss from "pboss";

const procs = await pboss.list();
const metrics = await pboss.metrics();
```

```ts
// 3. PBoss class & static methods
import PBoss from "pboss";

const procs = await PBoss.list();
const info = await PBoss.describe("api");
```

## Reading processes without a daemon

Two helpers read state without spawning anything:

- **`getProcesses(): Promise<ProcessState[]>`** — if the daemon is active, returns live processes; if it's offline, automatically reads the saved process definitions from disk (`~/.pboss/dump.json`) **without spawning a daemon**.
- **`readSavedProcesses(): Promise<ProcessState[]>`** — directly parses `~/.pboss/dump.json` with zero daemon or socket involvement.

```ts
import { getProcesses } from "pboss";

const processes = await getProcesses();
for (const p of processes) {
  console.log(`${p.name} (id: ${p.pm_id}) - ${p.status}`);
}
```

## Connection lifecycle

All API methods auto-connect on demand, so explicit connection is optional — it only matters if you want to listen for lifecycle events before issuing commands.

- **`pboss.connect(): Promise<PBoss>`** — connect to the daemon; spawns it if it isn't running and waits up to 5 seconds for responsiveness.
- **`pboss.disconnect(): Promise<void>`** — disconnect; stops polling timers but does **not** kill the daemon or your processes.
- **`pboss.connected: boolean`** — read-only connection state.
- **`pboss.daemonPid: number | null`** — PID of the daemon, or null before connecting.

```ts
import PBoss from "pboss";

const pboss = new PBoss();
await pboss.connect();
console.log(`Connected to daemon PID ${pboss.daemonPid}`);
```

## API surface

Every CLI command has a method twin:

| Area | Methods |
|---|---|
| Process control | `start(options)`, `startEcosystem(config)`, `stop(target?)`, `restart(target?)`, `reload(target?)`, `del(target?)` / `delete(target?)`, `scale(target, count)`, `sendSignal(target, signal)`, `reset(target?)` |
| Introspection | `list()`, `describe(target)`, `logs(target?, lines?)`, `streamLogs(target, cb, signal?)`, `flush(target?)` |
| Monitoring | `metrics()`, `metricsHistory(seconds?)`, `prometheus()`, `startPolling(intervalMs?)`, `stopPolling()` |
| Persistence | `save()`, `resurrect()` |
| Dashboard | `dashboard(port?, metricsPort?)`, `dashboardStop()` |
| Modules | `moduleInstall(nameOrPath)`, `moduleUninstall(name)`, `moduleList()` |
| Daemon | `ping()`, `kill()`, `daemonReload()` |
| Low-level | `send(message: DaemonMessage)` — arbitrary daemon messages over the Unix socket |

`streamLogs` is the programmatic tail:

```ts
await pboss.streamLogs("my-api", (log) => {
  console.log(log.name, log.out ?? log.err);
}, abortController.signal);
```

## Events

The `PBoss` class extends `EventEmitter` and emits typed events:

| Event | Payload | Description |
|---|---|---|
| `daemon:connected` | — | Daemon connection established |
| `daemon:disconnected` | — | Client disconnected from daemon |
| `daemon:launched` | `pid: number` | Daemon was spawned by this client |
| `daemon:killed` | — | Daemon was killed via `kill()` |
| `error` | `error: Error` | Transport or polling error |
| `process:start` | `processes: ProcessState[]` | Process(es) started |
| `process:stop` | `processes: ProcessState[]` | Process(es) stopped |
| `process:restart` | `processes: ProcessState[]` | Process(es) restarted |
| `process:reload` | `processes: ProcessState[]` | Process(es) reloaded |
| `process:delete` | `processes: ProcessState[]` | Process(es) deleted |
| `process:scale` | `processes: ProcessState[]` | Process group scaled |
| `metrics` | `snapshot: MetricSnapshot` | Metrics snapshot received |
| `log:data` | `logs: Array<{ name, id, out, err }>` | Log data retrieved |

```ts
import PBoss from "pboss";

const pboss = new PBoss();

pboss.on("daemon:connected", () => console.log("Connected!"));
pboss.on("process:start", (procs) => {
  console.log("Started:", procs.map((p) => p.name).join(", "));
});
pboss.on("error", (err) => console.error("pboss error:", err.message));

await pboss.connect();
```

## Error handling

Methods that communicate with the daemon throw a `PBossError` when the daemon returns a failure response. The error includes the command that failed and the full daemon response. Transport-level errors (daemon unreachable, socket closed) throw standard `Error` instances.

```ts
import { PBossError } from "pboss";

try {
  await pboss.describe("nonexistent");
} catch (err) {
  if (err instanceof PBossError) {
    console.error(`Command "${err.command}" failed: ${err.message}`);
    console.error("Full response:", err.response);
  }
}
```

| `PBossError` property | Type | Description |
|---|---|---|
| `message` | `string` | Human-readable error message |
| `command` | `string` | The daemon command type that failed |
| `response` | `DaemonResponse` | The full response object from the daemon |

## Direct ProcessManager usage

For in-process usage **without a running daemon**, use `ProcessManager` directly — useful for embedding pboss into your own application or for custom tooling:

```ts
import { ProcessManager, Dashboard } from "pboss";

const pm = new ProcessManager();

// Start a process
const states = await pm.start({
  name: "my-api",
  script: "./server.ts",
});

// All the same lifecycle operations are available
await pm.stop("my-api");
const list = await pm.list();
```

This is also the object [modules](/cli/modules) receive in their `init` hook.
