---
title: Installation
description: Install pboss with the one-line installer (sudo on Linux/macOS, Administrator on Windows) or Bun, or build the standalone binary from source. Requirements and updates.
section: getting-started
order: 2
---

## Requirements

- **Runtime:** Bun version 1.1.30 or higher (only needed for the Bun global install and building from source — the one-line installer delivers a compiled standalone binary that needs nothing else).
- **Platforms:** Linux, macOS, and Windows.
- **Privileges:** root (`sudo`) for the one-line installer on Linux/macOS; Administrator for the one-line installer on Windows. Both installers check for the required privileges themselves and tell you exactly how to re-run them if you forget.

Install Bun if you haven't already:

**Linux / macOS:**

```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows (PowerShell):**

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

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

If you already use Bun, you can run pboss straight from source:

```bash
bun add -g pboss
```

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

If the command is not found after a global install, make sure the install directory is on your `PATH` (Bun globals land in `~/.bun/bin`; the one-line installer places the binary in `/usr/local/bin` on Linux/macOS and `%ProgramFiles%\pboss` on Windows, both of which the installer adds to the system PATH).

## Updating

The update path depends on how you installed:

| Method | Update command |
|---|---|
| One-line installer | re-run the same `curl -fsSL https://procboss.com/install.sh \| sudo bash` command |
| Bun global | `bun update -g pboss` |
| From source | `git pull && bun install && bun run build:bin` |

The daemon is started on demand, so after an update simply run any `pboss` command — no separate daemon restart step is needed.
