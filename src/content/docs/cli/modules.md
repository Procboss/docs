---
title: Modules
description: Extend pboss with modules — install from git, a local path, or npm, and write your own with the PBossModule interface.
section: cli
order: 10
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
