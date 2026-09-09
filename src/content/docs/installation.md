---
title: Installation
description: Install pboss with the one-line installer, Bun, or build from source — no root required on any platform. Requirements and updates.
section: getting-started
order: 2
---

## Requirements

- **Platforms:** Linux, macOS, and Windows.
- **Privileges:** none. No root, no `sudo`, no Administrator — anywhere: not for installing, not for the boot service.

## Installation methods

### One-line install

Compiles the standalone `pboss` executable and sets up the per-user boot service. No root required: the binary goes to `~/.local/bin` (Linux/macOS) or `%LOCALAPPDATA%\pboss` (Windows).

**Linux / macOS:**

```bash
curl -fsSL https://procboss.com/install.sh | bash
```

**Windows (PowerShell):**

```powershell
powershell -c "irm https://procboss.com/install.ps1 | iex"
```

**Windows (Command Prompt):**

```cmd
curl -fsSL https://procboss.com/install.cmd | cmd
```

### Bun global install

If you don't have Bun yet: `curl -fsSL https://bun.sh/install | bash` (Linux/macOS) or `powershell -c "irm bun.sh/install.ps1 | iex"` (Windows).

```bash
bun add -g pboss
```

The `pboss` shim lands in `~/.bun/bin`. Update later with `bun update -g pboss`. The boot service is a per-user systemd unit (`~/.config/systemd/user`), so a user-local install is the recommended setup; if the host has no user systemd session, pboss prints the one command to enable it later (`pboss startup install`).

### Build from source

```bash
git clone https://github.com/procboss/pboss.git
cd pboss
bun install
bun run build:bin
```

`build:bin` produces the same standalone executable the one-line installer delivers.

## Verify the installation

```bash
pboss --version
```

If the command is not found, make sure the install directory is on your `PATH`: `~/.local/bin` (one-line installer), `~/.bun/bin` (Bun global), or `/usr/local/bin` (root install).

## Updating

| Method | Update command |
|---|---|
| One-line installer | re-run the same `curl -fsSL https://procboss.com/install.sh \| bash` command |
| Bun global | `bun update -g pboss` |
| From source | `git pull && bun install && bun run build:bin` |

Or just run `pboss upgrade` — it detects how pboss was installed and updates through the same channel.

The daemon is started on demand, so after an update simply run any `pboss` command — no separate daemon restart is needed.

Reinstalls and upgrades keep everything: the process list and the cloud link (credential in `~/.pboss`) survive the binary swap. The installer reports a detected link, `pboss upgrade` restarts the daemon and verifies the link came back, and `pboss cloud status` picks one up even if it appeared after the daemon started.
