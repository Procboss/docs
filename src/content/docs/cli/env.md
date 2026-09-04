---
title: Environment variables
description: pboss env set/get/delete for per-process environment variables, .env file loading, and --env flags.
section: cli
order: 7
---

Three ways to get environment variables into your processes — pick per case, they combine freely.

## Inline with --env

For one-off or secret values, pass them on the command line (repeatable):

```bash
pboss start server.ts --name api --env NODE_ENV=production --env API_KEY=xxx
```

The same field exists in [ecosystem files](/cli/ecosystem) as `env: { ... }`.

## Stored with pboss env

pboss can store environment variables per process and inject them on start — values live in the daemon's state, not in your shell history or repo.

### pboss env set

```bash
pboss env set my-api DATABASE_URL postgres://localhost/mydb
```

### pboss env get

List all stored environment variables for a process:

```bash
pboss env get my-api
```

### pboss env delete

Remove one variable — or all of them:

```bash
pboss env delete my-api DATABASE_URL
pboss env delete my-api
```

## Loading .env files

Load environment variables from `.env`-style files at start:

```bash
pboss start server.ts --env-file .env.production
```

This is the natural fit for twelve-factor deployments: keep `.env.production` out of git, load it at start, and combine with stored vars when needed.

## Precedence and tips

- Flags given to the child process after `--` and `--env` values both reach the process; explicit `--env` entries are applied to its environment.
- Virtualenv-style per-language setups don't need env vars — see [`--interpreter`](/runtimes#custom-interpreters) for pointing at a venv binary directly.
- For Node.js runtime flags, use `--node-args` instead of env vars: `--node-args "--max-old-space-size=4096"`.
