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

- **Linux:** writes and enables a **per-user systemd unit** (`~/.config/systemd/user/pboss.service`) and drives it with `systemctl --user` — no root, no sudo. After the unit comes up, pboss runs `loginctl enable-linger <user>` (best-effort) so the daemon starts at **boot** rather than at your first login; where linger is refused (older systemd / polkit), the install still succeeds and says the daemon will start at first login instead. The start is submitted with `--no-block` and health is verified with a hard deadline — the unit state plus a ping on the socket the unit's daemon actually binds — so `install` always returns; a failing daemon produces a diagnosis (state, socket probe, recent journal output), never a hang.
- **macOS:** writes and loads a `launchd` LaunchAgent (`~/Library/LaunchAgents/com.pboss.daemon.plist`). No root needed or wanted — sudo is rejected with a re-run hint.
- **Windows:** registers a Scheduled Task (`PBOSS_Daemon`) that starts the daemon at **this user's logon**. No elevation required for per-user registration; only hosts whose policy refuses it ask for an elevated re-run.

```bash
pboss startup install
```

Running it under `sudo` is rejected — root has no user systemd session, and a root daemon would split into `/root/.pboss`. Re-run it as yourself; the service runs as the invoking user and uses the same `~/.pboss` data as your daily `pboss` commands.

The generated file detects how pboss was installed and adapts the daemon command accordingly. On a **compiled standalone install** (one-line installer, `build:bin`) the service re-executes the pboss binary itself — `ExecStart=/home/you/.local/bin/pboss __daemon` — because the Bun runtime is embedded in the binary and is not required on the system. On a **script install** (`bun add -g pboss`, npm) the service runs the source on the system Bun runtime — `ExecStart=/home/you/.bun/bin/bun run …/daemon.ts`. The generated file's header comment states which mode was detected.

The service `PATH` includes the target user's `~/.bun/bin` whenever it exists (even on compiled installs): worker processes inherit the service environment, so anything shelling out to `bun` by name resolves. Independently, the daemon self-heals its `PATH` at startup — daemons started by older service definitions also find Bun after upgrading the binary. See [runtimes](/runtimes) for the full discovery chain.

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

The first `pboss start` on an empty machine also states where persistence stands — one line, only on a TTY (piped output stays clean for scripts): `✓ Persistence on: this process is saved and will come back after reboot` when the boot service is active, or the one command that enables it when it is not. PM2 makes you discover `pm2 startup && pm2 save` after losing processes to a reboot; pboss states its default out loud, once, at the moment it becomes relevant.

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
