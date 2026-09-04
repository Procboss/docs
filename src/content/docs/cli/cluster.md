---
title: Cluster mode
description: Run multiple instances of your app with cluster mode, per-worker env vars, and reusePort-aware port binding.
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

To share a port across processes in Bun, you must explicitly set `reusePort: true`:

```typescript
// server.ts
const workerId = parseInt(process.env.PBOSS_WORKER_ID || "0");
const port = parseInt(process.env.PORT || "3000");

Bun.serve({
  port,
  // Share the same port across multiple processes
  // This is the important part!
  reusePort: true,
  fetch(req) {
    return new Response(`Hello from worker ${workerId} on port ${port}`);
  },
});

console.log(`Worker ${workerId} listening on :${port}`);
```

## Platform limitations

pboss provides the orchestration for clustering, but **Bun's native cluster implementation is currently limited by the underlying OS**:

- **Linux** — port sharing via `reusePort` is fully supported.
- **macOS & Windows** — due to OS-level limitations with `SO_REUSEPORT`, these platforms ignore the `reusePort` option. Clustering on them may produce "Address already in use" errors when multiple workers bind the same port.

pboss leverages the native [Bun.serve cluster logic](https://bun.sh/docs/api/http#cluster) for maximum performance, but it remains subject to the runtime's maturity. On unsupported platforms, prefer distinct ports per worker (omit `reusePort`) or a front proxy.

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
