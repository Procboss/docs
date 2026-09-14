---
title: Modules
description: Extend pboss with modules — install from git, a local path, or npm, and write your own with the PBossModule interface.
section: cli
order: 11
---

pboss supports a plugin system for extending functionality.

## pboss module install

Install a module from a git URL, local path, or npm package name:

```bash
pboss module install https://github.com/user/pboss-logrotate.git
pboss module install ./my-pboss-module
pboss module install pboss-prometheus-pushgateway
```

## pboss module list

List installed modules:

```bash
pboss module list
```

## pboss module uninstall

Remove an installed module:

```bash
pboss module uninstall pboss-prometheus-pushgateway
```

## Writing a pboss module

A pboss module is a package with a default export implementing the `PBossModule` interface:

```typescript
// my-module/index.ts
import type { ProcessManager } from "pboss";

export default {
  name: "my-module",
  version: "1.0.0",

  init(pm: ProcessManager) {
    console.log("[my-module] Initialized with", pm.list().length, "processes");
  },

  destroy() {
    console.log("[my-module] Destroyed");
  },
};
```

- `init` runs when the daemon loads the module — receive the `ProcessManager` instance and hook into the lifecycle.
- `destroy` runs on daemon shutdown — close sockets, flush buffers, stop timers.

The `ProcessManager` instance exposes the same operations as the CLI: `list`, `start`, `stop`, `restart`, `reload`, `scale`, `logs`, and more. See the [programmatic API](/guide/programmatic-api) for the full surface — a module is just code running inside the daemon with that API in hand.

## Reacting to events

Since issue #32, the `pm` handed to `init(pm)` is a real event source: it extends `EventEmitter`, so modules react the instant something happens instead of polling `pm.list()` on a timer. Every daemon-side transition fires a typed `process:*` event — including autonomous ones a module could never see before: crash autorestarts, `maxMemoryRestart` trips, file-watch restarts, cron restarts, and health-check restarts.

```typescript
// crash-shipper/index.ts — a module that reacts instantly
import type { ProcessManager } from "pboss";

export default {
  name: "crash-shipper",
  version: "1.0.0",

  init(pm: ProcessManager) {
    pm.on("process:crashed", (e) => {
      ship("crash", e.process.name, e.exitCode ?? e.exitSignal);
    });
    pm.on("process:restart", (e) => {
      ship("restart", e.process.name, e.source); // user|crash|memory|watch|cron|health
    });
    pm.on("process:errored", (e) => {
      ship("gave-up", e.process.name, e.reason);
    });
  },

  destroy() { /* off() your listeners here */ },
};
```

The keys are `process:start`, `process:stop`, `process:restart`, `process:crashed`, `process:errored`, `process:delete`, and `process:reload`. Payloads are the same `PbossProcessEvent` objects the client API emits — see [Events](/guide/programmatic-api#events) for the full shape. Listener errors are caught and recorded, so a buggy module can never take down the supervisor's exit paths.
