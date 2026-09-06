---
title: Installation
description: Install pboss with the one-line installer (sudo on Linux/macOS, Administrator on Windows) or Bun, or build the standalone binary from source. Requirements and updates.
section: getting-started
order: 2
---

## Requirements

- **Runtime:** Bun version 1.1.30 or higher (only needed for the Bun global install and building from source — the one-line installer delivers a compiled standalone binary that needs nothing else).
- **Platforms:** Linux, macOS, and Windows.
- **Privileges:** root (`sudo`) for the one-line installer and `pboss startup` on Linux/macOS; Administrator for the one-line installer and `pboss startup` on Windows. Both pboss and its installers check for the required privileges themselves and tell you exactly how to re-run them if you forget.

Install Bun if you haven't already. A **system-wide install** is recommended — `pboss startup` needs sudo on Linux, and sudo's PATH does not include per-user directories like `~/.bun/bin`:

**Linux / macOS (system-wide, recommended):**

```bash
curl -fsSL https://bun.sh/install | sudo BUN_INSTALL=/usr/local bash
```

Note that the sudo sits on the **bash** side of the pipe — `sudo curl … | bash` would still run the installer as your normal user, because sudo would only apply to curl. The system-wide install puts `bun` in `/usr/local/bin`, which every shell — including sudo — can find.

**Windows (PowerShell):**

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

On Windows, elevated shells keep your user PATH, so a user-level Bun install works fine — just open the shell as Administrator whenever a command needs elevation.

## Installation methods

### One-line universal install

Install and compile the native standalone `pboss` executable directly on your device. The installer installs system-wide (`/usr/local/bin` on Linux/macOS, `%ProgramFiles%\pboss` on Windows) and therefore requires elevated privileges — pipe it through `sudo` on Linux/macOS, and run from an elevated shell on Windows:

**Linux / macOS:**

```bash
curl -fsSL https://procboss.com/install.sh | sudo bash
```

**Windows (PowerShell, run as Administrator):**

```powershell
powershell -c "irm https://procboss.com/install.ps1 | iex"
```

**Windows (Command Prompt, run as Administrator):**

```cmd
curl -fsSL https://procboss.com/install.cmd | cmd
```

If the installer is started without the required privileges, it exits immediately with the exact command to re-run it correctly — nothing is installed half-way.

Bun is only used as the build toolchain during installation. The finished executable embeds the Bun runtime, so your system does **not** need Bun afterwards.

### Bun global install

If you already use Bun, run pboss straight from source. Install it **system-wide** so `sudo` can find it (`pboss startup` needs root on Linux, and plain `sudo pboss` cannot see per-user directories like `~/.bun/bin`):

```bash
sudo BUN_INSTALL=/usr/local bun add -g pboss
```

This expects the system-wide Bun from the Requirements section above. Update later with `sudo BUN_INSTALL=/usr/local bun update -g pboss`.

A user-local install (`bun add -g pboss` without sudo) also works — whenever a command needs root, keep your PATH visible to sudo:

```bash
sudo env PATH="$PATH" pboss startup
```

On Windows, elevated shells keep your user PATH, so a regular `bun add -g pboss` is fine — just open the shell as Administrator for `pboss startup`.

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

If the command is not found after a global install, make sure the install directory is on your `PATH` (Bun globals land in `~/.bun/bin`, or `/usr/local/bin` with the system-wide `BUN_INSTALL=/usr/local` flow; the one-line installer places the binary in `/usr/local/bin` on Linux/macOS and `%ProgramFiles%\pboss` on Windows, both of which the installer adds to the system PATH).

## Updating

The update path depends on how you installed:

| Method | Update command |
|---|---|
| One-line installer | re-run the same `curl -fsSL https://procboss.com/install.sh \| sudo bash` command |
| Bun global (system-wide) | `sudo BUN_INSTALL=/usr/local bun update -g pboss` |
| Bun global (user-local) | `bun update -g pboss` |
| From source | `git pull && bun install && bun run build:bin` |

The daemon is started on demand, so after an update simply run any `pboss` command — no separate daemon restart step is needed.
