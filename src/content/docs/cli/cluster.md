---
title: Cluster mode
description: Run multiple instances of your app with cluster mode — workers spawned by your runtime's native process API (Bun.spawn, node:child_process, Deno.Command), with per-worker env, automatic ports, and rolling reloads.
section: cli
order: 2
---

Cluster mode spawns multiple instances of your application, each running in its own process. This is ideal for CPU-bound workloads and for taking full advantage of multi-core servers.

```bash
pboss start server.ts --name api --instances max
```

```bash
pboss start server.ts --name api --instances 4
```

```bash
pboss start server.ts --name api --instances 4 --port 3000
```

## Native per runtime — how workers are spawned

Cluster workers are ordinary, independent processes, each wrapped in its own supervised container — not threads, and not workers embedded in the pboss daemon. They are spawned through the [runtime adapter](/runtimes#the-adapter-layer), so **each runtime uses its own native process API**:

| Executing runtime | Workers spawned with |
|---|---|
| **Bun** | `Bun.spawn` — Bun's native process spawning |
| **Node.js** | `node:child_process` — Node's native process spawning |
| **Deno** | `Deno.Command` — Deno's native process spawning |

`node:cluster` is Node's own clustering module — it belongs to Node only. pboss never uses it to implement clustering under Bun or Deno, exactly as it never routes Bun or Deno through Node compatibility APIs anywhere else. Under Node, pboss clusters with Node's native process spawning directly; under Bun and Deno, with theirs.

What this model buys you: every worker is a full OS process with its own environment, its own `PORT`, independent crash/restart accounting, and independent log streams. Restart one worker (or let the restart policy do it) without touching its siblings, and reload the whole cluster one worker at a time with zero dropped requests.

## How workers are addressed

Each cluster worker receives the following environment variables:

| Variable | Description |
|---|---|
| `PBOSS_CLUSTER` | Set to `"true"` in cluster mode |
| `PBOSS_WORKER_ID` | Zero-indexed worker ID |
| `PBOSS_INSTANCES` | Total number of instances |
| `NODE_APP_INSTANCE` | Standard cluster worker index (`PBOSS_WORKER_ID`) |
| `PORT` | `basePort + workerIndex` (if `--port` is specified) |

`NODE_APP_INSTANCE` means PM2-style apps that branch on the instance number port over without changes.

## Cluster-aware port binding

Two strategies share a machine's traffic across workers: **distinct ports** (pboss's `PORT` arithmetic does it for you) and **port sharing** (`reusePort`), which asks the OS to load-balance one port across the processes.

**Distinct ports — portable everywhere.** Pass `--port` and each worker gets `basePort + workerIndex`; put any load balancer (nginx, Caddy, your cloud's) in front:

```typescript
// server.ts — works under Bun, Node, and Deno
const workerId = parseInt(process.env.PBOSS_WORKER_ID || "0");
const port = parseInt(process.env.PORT || "3000");

console.log(`Worker ${workerId} listening on :${port}`);
```

**Port sharing with `reusePort` — on Linux.** All workers bind the same port and the kernel distributes connections:

```typescript
// server.ts under Bun — the Bun.serve reusePort option
Bun.serve({
  port,
  // Share the same port across multiple processes
  // This is the important part!
  reusePort: true,
  fetch(req) {
    return new Response(`Hello from worker ${workerId} on port ${port}`);
  },
});
```

Under Deno, `Deno.serve` accepts the same `reusePort: true` option on Linux. Under Node, core has no `reusePort` server option — use distinct ports (the default strategy above) or run your own `node:cluster` inside the app if you want kernel-shared sockets.

## Platform limitations

Port sharing relies on the OS's `SO_REUSEPORT` socket option:

- **Linux** — port sharing via `reusePort` is fully supported, in every runtime.
- **macOS & Windows** — OS-level limitations mean same-port binding may produce "Address already in use" errors. Use distinct ports per worker (omit `reusePort`, keep the `--port` arithmetic) or a front proxy.

pboss provides the orchestration; the runtime provides the socket behavior. On every platform, the distinct-port strategy keeps working regardless.

## Scaling a running cluster

Use `pboss scale` to change the instance count at runtime — new workers inherit the existing configuration:

```bash
pboss scale my-api 8
```

And `pboss reload` to cycle workers one-by-one without dropping requests:

```bash
pboss reload my-api
```

See [Processes](/cli/processes) for both commands.
