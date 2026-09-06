---
title: Startup scripts
description: pboss startup, save, and resurrect — generate systemd, launchd, or Task Scheduler services so your processes survive reboots.
section: cli
order: 10
---

pboss installs an OS-level service so the daemon starts at boot — and, combined with `save`, automatically resurrects your process list after the reboot.

## pboss startup

Installs the boot startup service directly — no `install` subcommand needed:

- **Linux:** writes and enables a `systemd` service unit (`/etc/systemd/system/pboss.service`). Requires root — when run without sudo, pboss exits with the exact command to re-run, `sudo env PATH="$PATH" pboss startup`. The env form keeps your PATH visible to sudo, so it finds pboss even in per-user locations like `~/.bun/bin` (plain `sudo pboss` cannot see those directories).
- **macOS:** writes and loads a `launchd` plist (`~/Library/LaunchAgents/com.pboss.daemon.plist`). No root needed.
- **Windows:** registers a Scheduled Task (`PBOSS_Daemon`) that starts the daemon at logon with highest privileges. Requires an elevated shell (Run as Administrator) — pboss checks and tells you when the shell is not elevated.

```bash
# Linux (script installs — keeps your PATH visible to sudo)
sudo env PATH="$PATH" pboss startup

# Linux (compiled one-line install — pboss is already system-wide)
sudo pboss startup

# macOS / Windows (elevated shell)
pboss startup
```

When installed with sudo on Linux/macOS, the generated service runs as the **invoking user** (resolved from `SUDO_USER`), not as root — the boot daemon then uses the same `~/.pboss` data as your daily `pboss` commands instead of silently splitting off into `/root/.pboss`.

The generated file detects how pboss was installed and adapts the daemon command accordingly. On a **compiled standalone install** (one-line installer, `build:bin`) the service re-executes the pboss binary itself — `ExecStart=/usr/local/bin/pboss __daemon` — because the Bun runtime is embedded in the binary and is not required on the system. On a **script install** (`bun add -g pboss`, npm) the service runs the source on the system Bun runtime — `ExecStart=/usr/local/bin/bun run …/daemon.ts`. The generated file's header comment states which mode was detected.

## pboss startup generate

Print the service config for review (or to install by hand) without touching the system:

```bash
pboss startup generate
pboss startup generate win32   # generate for another OS
```

## pboss startup remove

Remove the installed startup service / scheduled task (root on Linux):

```bash
sudo env PATH="$PATH" pboss startup remove
```

## pboss save

Save the current process list so it can be restored on daemon startup:

```bash
pboss save
```

## pboss resurrect

Restore previously saved processes:

```bash
pboss resurrect
```

## Recommended boot setup

```bash
pboss start ecosystem.config.json
pboss save
sudo env PATH="$PATH" pboss startup
```

On reboot, systemd, launchd, or Task Scheduler starts the pboss daemon, and the daemon automatically runs resurrect to restore your processes. (On macOS drop the sudo — LaunchAgents are per-user; on a compiled one-line install, plain `sudo pboss startup` is enough.)

> **Tip:** After changing your process list (adding, removing, or renaming apps), run `pboss save` again — resurrection restores whatever was last saved.
