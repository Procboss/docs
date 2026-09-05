---
title: Installation
description: Install pboss with the one-line installer (from the repo's scripts), Homebrew, Snap, or Bun; or build the standalone binary from source. Requirements and updates.
section: getting-started
order: 2
---

## Requirements

- **Runtime:** Bun version 1.0 or higher (only needed for the Bun global install and building from source — the one-line installer and Homebrew deliver a compiled standalone binary that needs nothing else).
- **Platforms:** Linux, macOS, and Windows.

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

Installs and compiles the native standalone `pboss` executable directly on your device — no prerequisites:

**Linux / macOS:**

```bash
curl -fsSL https://raw.githubusercontent.com/Procboss/pboss/refs/heads/main/scripts/install.sh | bash
```

**Windows (PowerShell):**

```powershell
powershell -c "irm https://raw.githubusercontent.com/Procboss/pboss/refs/heads/main/scripts/install.ps1 | iex"
```

**Windows (Command Prompt):**

```cmd
curl -fsSL https://raw.githubusercontent.com/Procboss/pboss/refs/heads/main/scripts/install.cmd | cmd
```

### Package managers

**Snap (Linux):**

```bash
sudo snap install pboss --classic
```

**Homebrew (macOS / Linux):**

```bash
brew install procboss/tap/pboss
```

**Bun global install:**

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

If the command is not found after a global install, make sure the install directory is on your `PATH` (Bun globals land in `~/.bun/bin`; the standalone binary usually installs to `~/.local/bin` or `/usr/local/bin`).

## Updating

The update path depends on how you installed:

| Method | Update command |
|---|---|
| One-line installer | re-run the same `curl …/scripts/install.sh \| bash` command |
| Homebrew | `brew upgrade procboss/tap/pboss` |
| Snap | `sudo snap refresh pboss` |
| Bun global | `bun update -g pboss` |
| From source | `git pull && bun install && bun run build:bin` |

The daemon is started on demand, so after an update simply run any `pboss` command — no separate daemon restart step is needed.
