---
title: Quickstart
description: Start your first processes with pboss, watch them in the live list, open the dashboard, and make them survive reboots.
section: getting-started
order: 3
---

Five minutes from zero to supervised processes. Every command below is copy-pasteable — see the [CLI reference](/cli/processes) for the full flag list.

## Start a process

```bash
pboss start app.ts
```

pboss spawns a daemon (if one isn't running yet), starts your script under supervision, and returns. If the process crashes, pboss restarts it automatically.

Start with a name and options:

```bash
pboss start app.ts --name my-api --instances 4 --port 3000
```

## List processes

```bash
pboss list
```

```text
┌────┬──────────┬──────────┬──────┬───────┬──────────┬──────────┬──────────┐
│ ID │ Name     │ Status   │ PID  │ CPU   │ Memory   │ Restarts │ Uptime   │
├────┼──────────┼──────────┼──────┼───────┼──────────┼──────────┼──────────┤
│ 0  │ my-api-0 │ online   │ 4521 │ 0.3%  │ 42.1 MB  │ 0        │ 5m 23s  │
│ 1  │ my-api-1 │ online   │ 4522 │ 0.2%  │ 39.8 MB  │ 0        │ 5m 23s  │
│ 2  │ my-api-2 │ online   │ 4523 │ 0.4%  │ 41.3 MB  │ 0        │ 5m 23s  │
│ 3  │ my-api-3 │ online   │ 4524 │ 0.1%  │ 40.5 MB  │ 0        │ 5m 23s  │
└────┴──────────┴──────────┴──────┴───────┴──────────┴──────────┴──────────┘
```

Want it live-updating? `pboss list --live` refreshes the table in place (press `q` to quit).

## Tail the logs

```bash
pboss logs my-api
```

stdout and stderr are captured to `~/.pboss/logs/<name>-<id>-{out,error}.log` automatically — see [Logs](/cli/logs).

## Open the dashboard

```bash
pboss dashboard
```

```text
⚡ Dashboard running at http://localhost:9615
📊 Prometheus metrics at http://localhost:9616/metrics
```

A self-contained web dashboard with live charts, process controls, and a log viewer — no external dependencies. See [Dashboard](/cli/dashboard).

## Survive a reboot

Nothing to do — it is the default. The installer already set up the boot service, and pboss saves your process list automatically after every change. On boot, the daemon starts and resurrects your apps. The first `pboss start` tells you where persistence stands in one line, so the default is never a silent surprise.

```bash
pboss start my-api.ts   # saved automatically, resurrected at every boot
pboss startup status    # read-only: service installed? daemon up? what a
                        # reboot would restore
```

If the boot service could not be installed automatically (user-level install without sudo), one command fixes it:

```bash
sudo env PATH="$PATH" pboss startup install
```

Details in [Startup scripts](/cli/startup).

## Where to go next

- **Not running Bun?** pboss manages Go, Python, Node.js, Java, and more — see [Languages & runtimes](/runtimes).
- **Multiple services, one repo?** Declare them in an [ecosystem file](/cli/ecosystem).
- **Running more instances?** Read [Cluster mode](/cli/cluster).
- **Deploying to containers?** Use [foreground mode](/guide/docker).
- **Want fleet-wide visibility?** Link the machine with [ProcBoss Cloud](/cloud).
