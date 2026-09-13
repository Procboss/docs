---
title: Ecosystem files
description: Declare your whole application topology in one JSON or TypeScript ecosystem file and start everything with a single command.
section: cli
order: 6
---

An ecosystem file defines your entire application topology in a single configuration. pboss supports JSON, JavaScript, and TypeScript ecosystem files.

Relative `script` paths resolve against the ecosystem file's own directory — the same place `cwd` defaults to when left unset — so `pboss start /srv/app/ecosystem.config.json` works from any working directory.

```bash
pboss start ecosystem.config.json
```

```bash
pboss start ecosystem.config.ts
```

## Auto-detection

Run `pboss start` with no target and pboss looks for a config file in the current directory, loading the first one that exists — in this priority order:

1. `ecosystem.config.json` · `ecosystem.config.js` · `ecosystem.config.ts`
2. `pboss.config.json` · `pboss.config.js` · `pboss.config.ts`
3. `bm2.config.json` · `bm2.config.js` · `bm2.config.ts`
4. `pm2.config.json` · `pm2.config.js` · `pm2.config.ts`

```bash
pboss start   # loads the first config file above
```

Within a prefix, `.json` beats `.js`, which beats `.ts`. The `pboss`, `bm2`, and `pm2` prefixes mean a project migrating from either naming scheme keeps booting from its existing file.

An explicit target always wins over detection — `pboss start ./server.ts` starts the script, and `pboss start pm2.config.js` loads that file even when an `ecosystem.config.json` sits next to it. When no config file is found, `pboss start` continues to its normal script and name resolution, and only errors when nothing at all can be resolved:

```text
No PBoss configuration file or application was found.

Please provide a config file, executable script, or application to start.
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

## Namespace boundaries ([#31](https://github.com/Procboss/pboss/issues/31))

`pboss start ecosystem.config.*` uses the `namespace` field to divide the topology into lifecycle boundaries:

- Apps **without** a namespace are standalone and independent — a failure is reported, but the start sweep continues: no rollback, no blocking of the other apps.
- Apps sharing a **namespace** form one lifecycle group, started **atomically** at the namespace's first-declaration position (members may be declared non-contiguously — they still form one group). If any member fails, the members that invocation started are rolled back; already-running members are never touched.

A namespace failure never affects other namespaces or standalone apps, and the overall command reports every failure after starting everything startable:

```text
api                     online   (standalone — unaffected)
shop
├── shop-api            rolled back
├── shop-worker         rolled back
└── shop-scheduler      failed
admin
├── admin-api           online   (other namespace — unaffected)
└── admin-worker        online
```

Members can also react to a sibling's terminal exit with the [`onNsMemberExit`](/cli/processes#member-exit-policy-onnsmemberexit) policy — `"ignore"` (default) or `"exit"`, which stops the other running members so the namespace runs complete or not at all.

## What's available per app

Every field in the `apps` array mirrors a `pboss start` flag — the full mapping lives in the [configuration reference](/guide/config). The `deploy` block is consumed by [`pboss deploy`](/cli/deploy).

## Recommended boot setup

```bash
pboss start ecosystem.config.json
pboss save
pboss startup install
```

On reboot, systemd / launchd / Task Scheduler starts the pboss daemon, and the daemon automatically resurrects your processes. See [Startup scripts](/cli/startup).
