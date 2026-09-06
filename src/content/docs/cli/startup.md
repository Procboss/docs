---
title: Startup scripts
description: pboss startup, save, and resurrect — generate systemd, launchd, or Task Scheduler services so your processes survive reboots.
section: cli
order: 10
---

pboss can generate and install OS-level services so the daemon starts at boot — and, combined with `save`, automatically resurrects your process list after the reboot.

## pboss startup

Generate and display a startup script for your operating system:

- **Linux:** a `systemd` service unit file (`/etc/systemd/system/pboss.service`).
- **macOS:** a `launchd` plist (`~/Library/LaunchAgents/com.pboss.daemon.plist`).
- **Windows:** a Windows Task Scheduler command (`schtasks`) and PowerShell task configuration.

```bash
pboss startup
```

The generated script detects how pboss was installed and adapts the daemon command accordingly. On a **compiled standalone install** (one-line installer, `build:bin`) the service re-executes the pboss binary itself — `ExecStart=/usr/local/bin/pboss __daemon` — because the Bun runtime is embedded in the binary and is not required on the system. On a **script install** (`bun add -g pboss`, npm) the service runs the source on the system Bun runtime — `ExecStart=/usr/local/bin/bun run …/daemon.ts`. The generated file's header comment states which mode was detected.

On Windows you can also specify the platform explicitly:

```powershell
pboss startup win32
```

## pboss startup install

Automatically install the startup script so the pboss daemon starts at boot / logon:

```bash
# Linux (sudo) / macOS
pboss startup install

# Windows (Command Prompt / PowerShell as Administrator)
pboss startup install
```

On Windows, this registers a Scheduled Task (`PBOSS_Daemon`) configured to start automatically on user logon with highest privileges.

## pboss startup uninstall

Remove the startup service / scheduled task:

```bash
pboss startup uninstall
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
pboss startup install
```

On reboot, systemd, launchd, or Task Scheduler starts the pboss daemon, and the daemon automatically runs resurrect to restore your processes.

> **Tip:** After changing your process list (adding, removing, or renaming apps), run `pboss save` again — resurrection restores whatever was last saved.
