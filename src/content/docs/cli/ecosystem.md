---
title: Ecosystem files
description: Declare your whole application topology in one JSON or TypeScript ecosystem file and start everything with a single command.
section: cli
order: 6
---

An ecosystem file defines your entire application topology in a single configuration. pboss supports JSON and TypeScript ecosystem files.

```bash
pboss start ecosystem.config.json
```

```bash
pboss start ecosystem.config.ts
```

## JSON example

```json
{
  "apps": [
    {
      "name": "api",
      "script": "./src/api/server.ts",
      "instances": 4,
      "execMode": "cluster",
      "port": 3000,
      "env": {
        "NODE_ENV": "production",
        "DATABASE_URL": "postgres://localhost/mydb"
      },
      "maxMemoryRestart": "512M",
      "healthCheckUrl": "http://localhost:3000/health",
      "healthCheckInterval": 15000,
      "logMaxSize": "50M",
      "logRetain": 10,
      "logCompress": true
    },
    {
      "name": "worker",
      "script": "./src/worker/index.ts",
      "instances": 2,
      "env": {
        "NODE_ENV": "production",
        "REDIS_URL": "redis://localhost:6379"
      },
      "cron": "0 */6 * * *",
      "maxRestarts": 50
    },
    {
      "name": "scheduler",
      "script": "./src/scheduler/cron.ts",
      "instances": 1,
      "autorestart": true,
      "watch": ["./src/scheduler"]
    }
  ],
  "deploy": {
    "production": {
      "user": "deploy",
      "host": ["web1.example.com", "web2.example.com"],
      "ref": "origin/main",
      "repo": "git@github.com:your-org/your-app.git",
      "path": "/var/www/app",
      "preDeploy": "bun test",
      "postDeploy": "bun install && pboss reload ecosystem.config.json --env production"
    }
  }
}
```

## TypeScript example

```typescript
// ecosystem.config.ts
import type { EcosystemConfig } from "pboss/types";

const config: EcosystemConfig = {
  apps: [
    {
      name: "api",
      script: "./src/server.ts",
      instances: "max",
      execMode: "cluster",
      port: 3000,
      env: {
        NODE_ENV: "production",
      },
      maxMemoryRestart: "1G",
      healthCheckUrl: "http://localhost:3000/health",
    },
  ],
};

export default config;
```

The TypeScript variant gets you type checking, comments, and shared constants — ideal once the file grows past a handful of apps.

## Multiple environments

Run the same topology under different env vars by declaring one entry per environment:

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

Then target a single group by name: `pboss restart api-staging`.

## What's available per app

Every field in the `apps` array mirrors a `pboss start` flag — the full mapping lives in the [configuration reference](/guide/config). The `deploy` block is consumed by [`pboss deploy`](/cli/deploy).

## Recommended boot setup

```bash
pboss start ecosystem.config.json
pboss save
sudo env PATH="$PATH" pboss startup
```

On reboot, systemd / launchd / Task Scheduler starts the pboss daemon, and the daemon automatically resurrects your processes. See [Startup scripts](/cli/startup).
