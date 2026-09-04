---
title: Deployment
description: pboss deploy — SSH-based deployments with git pull, timestamped release directories, symlink rotation, pre/post hooks, and multi-host support.
section: cli
order: 8
---

pboss includes a built-in deployment system for SSH-based deployments with release management. Deployments are declared in the `deploy` block of an [ecosystem file](/cli/ecosystem).

## pboss deploy setup

Initial setup of the remote server — creates the directory structure and clones the repository:

```bash
pboss deploy ecosystem.config.json production setup
```

This creates the following remote directory structure:

```text
/var/www/app/
├── source/
├── releases/
│   ├── 2025-02-11T10-30-00-000Z/
│   └── 2025-02-10T15-45-00-000Z/
├── current -> releases/2025-02-11T10-30-00-000Z/
└── shared/
```

## pboss deploy

Deploy a new release:

```bash
pboss deploy ecosystem.config.json production
```

The deploy process works as follows:

1. Runs the `preDeploy` hook **locally** (e.g. running tests).
2. Connects via SSH to each configured host.
3. Pulls the latest code from the configured ref.
4. Creates a new timestamped release directory.
5. Updates the `current` symlink to the new release.
6. Runs the `postDeploy` hook **remotely** (e.g. installing dependencies and reloading processes).
7. Cleans up old releases, keeping only the 5 most recent.

## Multi-host deployment

Specify an array of hosts to deploy to all of them sequentially:

```json
{
  "host": ["web1.example.com", "web2.example.com", "web3.example.com"]
}
```

## Configuration reference

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

SSH access must be key-based — the deploy flow is non-interactive, so there's no prompt for passwords.
