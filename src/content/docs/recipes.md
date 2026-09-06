---
title: Recipes
description: Copy-paste recipes for pboss — production APIs with clustering and health checks, watch mode, cron restarts, containers, deploys, and programmatic monitoring.
section: more
order: 2
---

Short, copy-pasteable recipes for real situations. Each links to the full reference behind it.

## Language quick starts

```bash
# TypeScript / Bun server
pboss start server.ts --name bun-api

# Node.js server
pboss start server.js --interpreter node --name node-api

# Go — source in dev, binary in prod
pboss start main.go --name go-dev
pboss start ./dist/my-go-server --name go-prod --instances 4

# Python worker
pboss start worker.py --name py-worker

# Java JAR service
pboss start app.jar --name java-service
```

The full runtime matrix — Rust, Ruby, PHP, shell, Windows scripts, custom interpreters — lives in [Languages & runtimes](/runtimes).

## Production API with clustering and health checks

```bash
pboss start server.ts \
  --name api \
  --instances max \
  --port 3000 \
  --max-memory-restart 512M \
  --health-check-url http://localhost:3000/health \
  --health-check-interval 15000 \
  --log-max-size 50M \
  --log-retain 10 \
  --log-compress
```

One command: every CPU core put to work, workers restarted if they bloat past 512MB, unhealthy workers recycled on failed probes, logs rotated at 50MB with 10 gzip-compressed generations. Background: [cluster mode](/cli/cluster), [health checks](/guide/config#health-check-options), [log rotation](/cli/logs#log-rotation).

## Development mode with watch

```bash
pboss start server.ts --name dev-api --watch --ignore-watch node_modules,.git,dist
```

Restart on save, with `node_modules`, `.git`, and build output excluded so a build doesn't bounce your server. See [watch options](/guide/config#watch-options).

## Scheduled restart (daily at 3 AM)

```bash
pboss start server.ts --name api --cron "0 3 * * *"
```

For applications that benefit from regular recycling — leaking native buffers, long-lived connections — a standard cron expression restarts the process on schedule. See the [`--cron` flag](/cli/processes#pboss-start).

## Multiple environments via ecosystem

```json
{
  "apps": [
    {
      "name": "api-staging",
      "script": "./server.ts",
      "env": { "NODE_ENV": "staging", "PORT": "3000" }
    },
    {
      "name": "api-production",
      "script": "./server.ts",
      "env": { "NODE_ENV": "production", "PORT": "8080" }
    }
  ]
}
```

One file, both environments, independently addressable: `pboss restart api-staging`. See [ecosystem files](/cli/ecosystem).

## Docker container (foreground mode)

```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun add -g pboss
CMD ["pboss", "start", "--no-daemon", "./server.ts"]
```

`--no-daemon` keeps pboss as the foreground entrypoint so the container stays up. Compose, Kubernetes, and the `--raw` logging pattern are in [Foreground mode & Docker](/guide/docker).

## Full production setup

```bash
pboss start ecosystem.config.json
pboss save
sudo env PATH="$PATH" pboss startup
pboss dashboard
pboss list
```

Start the whole topology, persist it, install the boot service, and open the dashboard. After a reboot, systemd / launchd / Task Scheduler starts the daemon and your processes resurrect automatically. See [Startup scripts](/cli/startup).

## Monitoring with Prometheus and Grafana

```bash
pboss dashboard --metrics-port 9616
curl http://localhost:9616/metrics
```

Then add the target to your `prometheus.yml` and import the Grafana dashboard. The metric catalog and alert rules are in [Prometheus & Grafana](/guide/prometheus).

## Zero-downtime deploy

```bash
pboss deploy ecosystem.config.json production
```

Or manually:

```bash
git pull origin main
bun install
pboss reload all
```

`reload` cycles workers one at a time — new instances come up before old ones get SIGTERM. See [Deployment](/cli/deploy) and [`pboss reload`](/cli/processes#pboss-reload).

## Programmatic monitoring service

```ts
import PBoss from "pboss";

const pboss = new PBoss();
await pboss.connect();

// Alert when any process uses more than 512 MB
pboss.on("metrics", (snapshot) => {
  for (const proc of snapshot.processes) {
    if (proc.memory > 512 * 1024 * 1024) {
      console.warn(`⚠️  ${proc.name} using ${Math.round(proc.memory / 1024 / 1024)} MB`);
    }
  }
});

pboss.startPolling(5000);

// Keep running
process.on("SIGINT", async () => {
  pboss.stopPolling();
  await pboss.disconnect();
  process.exit(0);
});
```

## Programmatic deploy pipeline

```ts
import PBoss from "pboss";

const pboss = new PBoss();
await pboss.connect();

// Deploy new code, then reload
console.log("Reloading all processes...");
const reloaded = await pboss.reload("all");
console.log(`Reloaded ${reloaded.length} processes`);

// Verify everything is healthy
const processes = await pboss.list();
const allOnline = processes.every((p) => p.status === "online");

if (allOnline) {
  console.log("✅ All processes online");
  await pboss.save();
} else {
  console.error("❌ Some processes failed to come online");
  const failed = processes.filter((p) => p.status !== "online");
  for (const p of failed) {
    console.error(`  ${p.name}: ${p.status}`);
  }
}

await pboss.disconnect();
```

Both examples use the same daemon-facing API the CLI uses — the full surface is in [Programmatic API](/guide/programmatic-api).
