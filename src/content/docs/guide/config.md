---
title: Configuration reference
description: Every ecosystem file option — process, cluster, log, health check, watch, and deploy configuration.
section: guides
order: 2
---

The complete set of options for [ecosystem files](/cli/ecosystem). Every CLI flag from `pboss start` maps to a field here (camelCase instead of kebab-case).

## Ecosystem file format

The ecosystem file is a JSON or TypeScript file with the following top-level structure:

```typescript
interface EcosystemConfig {
  apps: StartOptions[];
  crons?: CronJobConfig[];
  deploy?: Record<string, DeployConfig>;
}
```

| Top-level field | Type | Description |
|---|---|---|
| `apps` | `StartOptions[]` | Processes to run — the tables below document each entry |
| `crons` | `CronJobConfig[]` | Standalone scheduled commands (friendly schedules like `everyday@9:11`) — see [Cron Jobs](/cli/cron) |
| `deploy` | `Record<string, DeployConfig>` | Deployment environments — see [Deploy configuration](#deploy-configuration) |

## Process options

The complete set of options available for each entry in the `apps` array:

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | Filename | Process name |
| `script` | `string` | required | Path to the script to execute; relative paths resolve against the config file's directory |
| `args` | `string[]` | `[]` | Arguments passed to the script |
| `cwd` | `string` | The config file's directory | Working directory for the process |
| `env` | `Record<string, string>` | `{}` | Environment variables |
| `instances` | `number` or `"max"` | `1` | Number of instances |
| `execMode` | `"fork"` or `"cluster"` | `"fork"` | Execution mode |
| `autorestart` | `boolean` | `true` | Restart on crash |
| `maxRestarts` | `number` | `16` | Maximum restart attempts before giving up |
| `minUptime` | `number` | `1000` | Minimum ms a process must be up to be considered stable |
| `maxMemoryRestart` | `string` or `number` | — | Memory threshold for restart |
| `restartDelay` | `number` | `0` | Delay in ms between restart attempts |
| `killTimeout` | `number` | `5000` | Grace period in ms before SIGKILL |
| `interpreter` | `string` | Auto | Custom interpreter |
| `interpreterArgs` | `string[]` | — | Arguments for the interpreter |
| `nodeArgs` | `string[]` | — | Additional runtime arguments |
| `namespace` | `string` | — | Namespace for grouping processes |
| `sourceMapSupport` | `boolean` | `false` | Enable source map support |
| `waitReady` | `boolean` | `false` | Wait for process to emit ready signal |
| `listenTimeout` | `number` | `3000` | Timeout when waiting for ready signal |
| `noDaemon` | `boolean` | `false` | Run in foreground without a daemon |

## Cluster options

| Option | Type | Default | Description |
|---|---|---|---|
| `instances` | `number` or `"max"` | `1` | Worker count |
| `execMode` | `"cluster"` | `"fork"` | Set to cluster for multi-instance mode |
| `port` | `number` | — | Base port. Worker i gets port + i |

Cluster semantics and per-worker environment variables are covered in [Cluster mode](/cli/cluster).

## Log options

| Option | Type | Default | Description |
|---|---|---|---|
| `outFile` | `string` | `~/.pboss/logs/<name>-<id>-out.log` | Custom stdout log path |
| `errorFile` | `string` | `~/.pboss/logs/<name>-<id>-error.log` | Custom stderr log path |
| `mergeLogs` | `boolean` | `false` | Merge all instance logs into one file |
| `raw` | `boolean` | `false` | Mirror child stdout and stderr to pboss stdout and stderr |
| `logDateFormat` | `string` | — | Date format for log line prefixes |
| `logMaxSize` | `string` or `number` | `"10M"` | Max log file size before rotation |
| `logRetain` | `number` | `5` | Number of rotated files to keep |
| `logCompress` | `boolean` | `false` | Gzip-compress rotated log files |

## Health check options

| Option | Type | Default | Description |
|---|---|---|---|
| `healthCheckUrl` | `string` | — | URL to probe |
| `healthCheckInterval` | `number` | `30000` | Probe interval in ms |
| `healthCheckTimeout` | `number` | `5000` | Probe timeout in ms |
| `healthCheckMaxFails` | `number` | `3` | Consecutive failures before restart |

## Watch options

| Option | Type | Default | Description |
|---|---|---|---|
| `watch` | `boolean` or `string[]` | `false` | Enable file watching |
| `ignoreWatch` | `string[]` | `["node_modules", ".git", ".pboss"]` | Patterns to ignore |

## Deploy configuration

| Option | Type | Description |
|---|---|---|
| `user` | `string` | SSH user |
| `host` | `string` or `string[]` | Remote host(s) |
| `ref` | `string` | Git ref to deploy |
| `repo` | `string` | Git repository URL |
| `path` | `string` | Remote deployment path |
| `preDeploy` | `string` | Command to run locally before deploy |
| `postDeploy` | `string` | Command to run remotely after deploy |
| `preSetup` | `string` | Command to run remotely during setup |
| `postSetup` | `string` | Command to run remotely after setup |
| `ssh_options` | `string` | Additional SSH options |
| `env` | `Record<string, string>` | Environment variables for remote commands |

Deploy semantics (release directories, symlink rotation, cleanup) are covered in [Deployment](/cli/deploy).
