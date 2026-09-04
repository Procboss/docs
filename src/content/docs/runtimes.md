---
title: Languages & runtimes
description: pboss runs any application — TypeScript, JavaScript, Python, Go, Rust, Ruby, PHP, Java JARs, shell scripts, Windows scripts, and compiled binaries — with auto-detected interpreters.
section: getting-started
order: 4
---

pboss runs and supervises any application, programming language, runtime, or compiled binary. Interpreters are auto-detected from the file extension; override them any time with `--interpreter`.

## Runtime matrix

| Runtime / Language | File extension | Auto-detected runner | Example |
|---|---|---|---|
| **TypeScript / JSX** | `.ts`, `.tsx`, `.jsx`, `.mjs`, `.cjs` | `bun run <file>` | `pboss start server.ts` |
| **JavaScript (Bun)** | `.js` | `bun run <file>` | `pboss start app.js` |
| **JavaScript (Node.js)** | `.js` | `node <file>` (via `--interpreter`) | `pboss start app.js --interpreter node` |
| **Python** | `.py` | `python3 <file>` (or `python`) | `pboss start worker.py` |
| **Go** | `.go` | `go run <file>` | `pboss start main.go` |
| **Compiled binaries (Go / Rust / C / C++)** | *(no ext)*, `.bin`, `.exe` | Direct binary execution | `pboss start ./my-go-server` |
| **Ruby** | `.rb` | `ruby <file>` | `pboss start app.rb` |
| **PHP** | `.php` | `php <file>` | `pboss start server.php` |
| **Java** | `.jar` | `java -jar <file>` | `pboss start app.jar` |
| **Shell / Bash** | `.sh`, `.bash` | `sh <file>` / `bash <file>` | `pboss start job.sh` |
| **Windows scripts** | `.bat`, `.cmd`, `.ps1` | `cmd.exe` / `powershell.exe` | `pboss start script.bat` |
| **Custom interpreter** | *any* | Custom runtime via `--interpreter` | `pboss start app.ts --interpreter "deno run -A"` |

## Running native binaries (Go, Rust, C/C++)

Compiled executables are executed directly with zero interpreter wrapper:

```bash
# Start a compiled Go or Rust binary
pboss start ./dist/my-go-api --name api --instances 4

# Run with explicit direct binary mode
pboss start ./my-binary --interpreter none
```

Everything else works identically: `--instances`, `--max-memory-restart`, health checks, log rotation, and the dashboard all apply to native binaries the same way they apply to scripts.

## Running Python services

```bash
# Auto-detects python3 on Linux/macOS or python on Windows
pboss start worker.py --name py-worker

# Custom virtualenv Python interpreter
pboss start worker.py --interpreter ./venv/bin/python
```

Pointing `--interpreter` at a virtualenv's Python is the recommended way to run venv-based services — the process runs with the venv's packages without any activation step.

## Running Node.js applications

```bash
# Run with the Node.js interpreter
pboss start server.js --interpreter node --name node-api

# Pass Node.js / V8 flags
pboss start server.js --interpreter node --node-args "--max-old-space-size=4096"
```

`.js` files default to Bun for maximum performance; `--interpreter node` opts a specific process into Node.js semantics when needed. PM2-style apps port over directly.

## Custom interpreters

Any executable can serve as the interpreter, with arguments:

```bash
pboss start app.ts --interpreter "deno run -A"
```

The `--interpreter-args` flag separates interpreter arguments from your script's arguments if you prefer them split:

```bash
pboss start script.py --interpreter python3 --interpreter-args "-u"
```

## Recipes

```bash
# TypeScript / Bun server
pboss start server.ts --name bun-api

# Node.js server
pboss start server.js --interpreter node --name node-api

# Go — source in dev, binary in prod
pboss start main.go --name go-dev
pboss start ./dist/my-go-server --name go-prod --instances 4

# Python worker
pboss start worker.py --name py-worker

# Java JAR service
pboss start app.jar --name java-service
```

Whatever you start, the rest of pboss applies: restart policies, [cluster mode](/cli/cluster) (where the app supports multiple instances), [log management](/cli/logs), [health checks](/guide/config#health-check-options), and the [dashboard](/cli/dashboard).
