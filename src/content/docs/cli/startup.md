---
title: Startup scripts
description: pboss startup install, save, and resurrect — the per-user systemd, launchd, or Task Scheduler service that makes your processes survive reboots, installed automatically at install time. No root required.
section: cli
order: 10
---

pboss sets up an OS-level boot service so the daemon starts at boot — and, because the process list is saved automatically after every change, the daemon resurrects your processes after the reboot. **Processes survive reboots and restarts by default.**

## It is installed automatically

You normally never run these commands:

- The **one-line installer** (`curl -fsSL https://procboss.com/install.sh | bash`) installs the boot service as its final step — the daemon starts immediately and at every boot. Hosts without systemd (containers, minimal VMs) get a note instead of an error.
- A **global npm install** (`npm i -g pboss`) tries the same and prints the one command to run on hosts where it could not.

`pboss startup install` is for the cases the automation could not cover: you removed the service, or you are re-enabling it on a new systemd host.

## pboss startup install

Installs and starts the boot startup service — as your normal user, no root:

- **Linux:** writes and enables a **per-user systemd unit** (`~/.config/systemd/user/pboss.service`) and drives it with `systemctl --user` — no root, no sudo. After bring-up, pboss best-effort runs `loginctl enable-linger <user>` so the daemon starts at **boot** rather than at your first login; where linger is refused (older systemd / polkit), the install still succeeds and says so. The start is `--no-block` with a hard health deadline (unit state + socket ping), so `install` always returns — a failing daemon produces a diagnosis, never a hang.
- **macOS:** writes and loads a `launchd` LaunchAgent (`~/Library/LaunchAgents/com.pboss.daemon.plist`). No root needed or wanted — sudo is rejected with a re-run hint.
- **Windows:** registers a Scheduled Task (`PBOSS_Daemon`) that starts the daemon at **this user's logon**, via PowerShell's `Register-ScheduledTask`. No elevation required; only hosts whose policy refuses it ask for an elevated re-run.

```bash
pboss startup install
```

Running it under `sudo` is rejected — root has no user systemd session, and a root daemon would split into `/root/.pboss`. Re-run it as yourself; the service runs as the invoking user and uses the same `~/.pboss` data as your daily `pboss` commands.

The generated file adapts to how pboss was installed: a **compiled standalone install** (one-line installer, `build:bin`) re-executes the pboss binary itself — `ExecStart=/home/you/.local/bin/pboss __daemon` — (Bun is embedded, not required on the system); a **script install** (`bun add -g pboss`, npm) runs the source on the system Bun — `ExecStart=/home/you/.bun/bin/bun run …/daemon.ts`. The header comment states which mode was detected.

The service `PATH` includes the target user's `~/.bun/bin` whenever it exists (workers that shell out to `bun` by name must resolve it), and the daemon self-heals its `PATH` at startup — daemons started by older service definitions also find Bun after an upgrade. See [runtimes](/runtimes) for the full discovery chain.

Bare `pboss startup` does not install anything — it prints the available options (`install` / `uninstall` / `status` / `generate`).

## pboss startup status

A read-only report of boot persistence — nothing is started, installed, or changed:

```bash
pboss startup status
```

```text
Boot startup service (systemd, per-user)
  Service:    /home/ra/.config/systemd/user/pboss.service
  Installed:  yes
  Enabled:    yes — starts with your session (default.target)
  Active:     active
  Linger:     on — the daemon starts at BOOT, before login
  Daemon:     reachable (pid 1234) at /home/ra/.pboss/daemon.sock

Reboot persistence:
  Dump:       /home/ra/.pboss/dump.json
  On boot:    3 process(es) come back running, 1 stopped
```

When the service is missing, the report says so and prints the exact install command; saved processes are reported as waiting for the service. When there is nothing saved yet, it says so — starts are saved automatically, so the count appears the moment you run `pboss start`. The socket and dump are read from the home the daemon actually uses (an explicit `PBOSS_HOME` wins; otherwise the current user's `~/.pboss`).

The first `pboss start` on an empty machine states where persistence stands — one line, only on a TTY: `✓ Persistence on: this process is saved and will come back after reboot` when the boot service is active, or the one command that enables it when it is not.

## pboss startup uninstall (alias: remove)

Remove the installed startup service — per-user on every platform, no root:

```bash
pboss startup uninstall
```

On Windows, `schtasks /delete` reporting "cannot find" is surfaced honestly ("No PBOSS_Daemon scheduled task found — nothing to remove") instead of a fake success line.

## pboss startup generate

Print the service config for review (or to install by hand) without touching the system:

```bash
pboss startup generate
pboss startup generate win32   # generate for another OS
```

## Saving is automatic

The process list is saved to `~/.pboss/dump.json` **after every change** — start, stop, restart, reload, delete, scale — so the dump always mirrors the live list. A manual `pboss save` still exists (a deliberate re-save), but you never need to remember it: add a process and it is already persisted.

```bash
pboss start app.ts            # saved automatically
pboss delete app              # saved automatically (it won't resurrect)
```

The dump records one extra bit per process — whether it was stopped. That is what a reboot restores:

| Last state before reboot | After reboot |
|---|---|
| running (online, errored, launching) | resurrected **running** |
| stopped (user stop, or clean exit 0) | resurrected **stopped** — listed, ready to `pboss restart` |
| deleted | gone |

`pboss stop` therefore means "keep it configured, but it should not run" — it comes back after a reboot in the stopped state. `pboss delete` means "remove it entirely" — it never comes back. And `pboss kill` (stopping the daemon itself) deliberately does **not** touch the dump: the process list describes what *should* run, so the next boot (or `systemctl --user start pboss`) brings everything back as it was.

## pboss resurrect

Restore previously saved processes (this is what the boot service runs automatically via the unit's `ExecStartPost`):

```bash
pboss resurrect
```

If a saved process is already running (the daemon restarted while its children survived), resurrect keeps the running instance instead of spawning a duplicate.

## What a reboot looks like

1. systemd / launchd / Task Scheduler starts the pboss daemon (`pboss __daemon`).
2. The service definition immediately runs `pboss resurrect` and restores the saved list — running processes running, stopped ones stopped.
3. If the daemon later crashes, systemd's `Restart=on-failure` restarts it and resurrect runs again.

```bash
# the whole setup, once, at install time:
curl -fsSL https://procboss.com/install.sh | bash

# then just use pboss — everything is persisted from here on:
pboss start ecosystem.config.json
```
