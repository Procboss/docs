---
title: Logs
description: pboss log management — tailing, following, flushing, and automatic size-based rotation with optional gzip compression.
section: cli
order: 3
---

pboss captures stdout and stderr of every managed process to files under `~/.pboss/logs/` automatically — you never set up log redirection yourself.

- stdout → `~/.pboss/logs/<name>-<id>-out.log`
- stderr → `~/.pboss/logs/<name>-<id>-error.log`

## pboss logs

Display recent logs for a process.

```bash
pboss logs
```

```bash
pboss logs my-api --lines 100
```

```bash
pboss logs my-api --err
```

Follow mode — streams new lines as they arrive, like `tail -f`:

```bash
pboss logs my-api --follow
pboss logs my-api -f
pboss logs -f
```

With no target, `pboss logs` shows the most recently started process; `pboss logs -f` follows it.

## pboss flush

Clear log files.

```bash
pboss flush my-api
pboss flush
```

With no target, all managed processes are flushed.

## Log rotation

Rotation runs automatically in the background: pboss checks log file sizes once per minute and rotates when the configured threshold is exceeded.

```bash
pboss start server.ts --log-max-size 50M --log-retain 10 --log-compress
```

**Rotation behavior** — when a log file exceeds `--log-max-size`:

1. It is renamed with a numeric suffix.
2. Existing rotated files are shifted up by one number.
3. Files beyond the `--log-retain` count are deleted.
4. If `--log-compress` is enabled, rotated files are gzip-compressed using Bun's native `Bun.gzipSync`.

### Defaults

| Setting | Default |
|---|---|
| `--log-max-size` | `10 MB` |
| `--log-retain` | `5` |
| `--log-compress` | `false` |

## Custom log paths

Redirect per process with `--output` / `--error`, or configure the same in an [ecosystem file](/cli/ecosystem) via `outFile` / `errorFile`:

```bash
pboss start server.ts --output /var/log/my-api/out.log --error /var/log/my-api/err.log
```

`--merge-logs` writes all instances of a cluster into one file instead of one file per instance, and `--log-date-format` prefixes every line with a timestamp:

```bash
pboss start server.ts --merge-logs --log-date-format "YYYY-MM-DD HH:mm:ss"
```

## Container tip

In Docker, pair `--no-daemon` with `--raw` so your logs appear in `docker logs` **and** in files. See [Foreground mode](/guide/docker#docker-logs-and-log-files).
