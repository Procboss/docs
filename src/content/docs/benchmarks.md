---
title: Benchmarks
description: pboss vs pm2 and pup under identical load — the same app, the same runtime, the same machine, the same load generator; only the process manager differs. Headline numbers from the benchmark repo, with the full reports linked.
section: more
order: 4
---

pboss is measured against pm2 (and, for Deno apps, against
[pup](https://github.com/hexagon/pup)) in a dedicated benchmark repo —
[github.com/Procboss/benchmarks](https://github.com/Procboss/benchmarks) —
with three editions, one per runtime: a **Bun** HTTP server, a **Node**
HTTP server, and a **Deno** HTTP server. The method is the same in all
three: the same app file, the same runtime binary, the same machine, the
same load profile — the only variable is which process manager supervises
it. That isolates the **overhead of managing**, not the runtime's raw HTTP
performance.

Every measured run starts from a verified-clean state (app deleted, daemon
killed, port free) — each number is a cold start of the whole manager
stack, and that cold-start time is itself measured. Manager order
alternates between runs so time-of-run bias cannot favor a column, a
discarded warmup run precedes every measured run, and CPU and memory cover
the **whole process tree** (daemon + managed app), sampled every 0.5s from
`/proc`. Raw autocannon JSON, resource CSVs, and event logs for every
number live under each edition's `results/raw/`.

Both supervision models are covered: **fork** (one managed process) and
**cluster** (N workers sharing one port). Crash-recovery and restart-storm
runs are separate phases that never overlap the HTTP measurements.

## Managing a Node server

Node v24.21.0 · pm2 5.4.3 · pboss v1.8.0 · fork mode, 100 connections:

| Metric | pm2 | pboss | Winner |
| --- | --- | --- | --- |
| Average requests/sec | 57,512 | 57,519 | tie (+0.0%) |
| Average latency (mean) | 1.44 ms | 1.40 ms | pboss (-2.8%) |
| Average memory (tree) | 179.1 MB | 168.3 MB | pboss (-6.0%) |
| Average cold startup | 524.6 ms | 396.6 ms | pboss (-24.4%) |
| Warm startup (median) | 270 ms | 174 ms | pboss (-35.6%) |
| SIGKILL crash recovery (mean) | 134.9 ms | 68.4 ms | pboss (-49.3%) |
| 50-restart storm (median) | 376.0 ms | 181.0 ms | pboss (-51.9%) |

Throughput is a tie because the manager is not in the request path — the
supervision **operational** metrics are where the manager itself lives, and
pboss wins every one of them. The idle daemon sits at 65.2 MB (pm2:
68.7 MB) at 0.0 % CPU on both.

**Cluster mode** — the apples-to-apples one, because for Node apps BOTH
managers cluster natively through `node:cluster`: pboss `--instances 2`
spawns a supervised wrapper primary that forks the workers, pm2 `-i 2`
makes its daemon the primary; the worker count and sharing mechanism are
identical.

| Metric | pm2 | pboss | Winner |
| --- | --- | --- | --- |
| Average requests/sec | 55,954 | 58,539 | pboss (+4.6%) |
| Average latency (mean) | 1.25 ms | 1.18 ms | pboss (-5.6%) |
| Cold startup (median) | 637 ms | 419 ms | pboss (-34.2%) |
| Warm startup (median) | 422 ms | 242 ms | pboss (-42.7%) |
| Worker respawn after SIGKILL (mean) | 151.1 ms | 93.2 ms | pboss (-38.3%) |
| Restart storm, all workers (median) | 498 ms | 300 ms | pboss (-39.8%) |

> **The respawn finding, and the fix.** The first run of this edition
> exposed a real defect: a SIGKILLed cluster worker took a **7.3 s median**
> to be replaced — the old respawn policy treated every quick death as an
> unstable crash and escalated its backoff (300 ms doubling to a 15 s cap).

> pboss v1.8.0 replaced that policy: a worker that **lived** is a healthy
> worker that died, and its replacement is forked immediately in the exit
> handler — backoff exists only for genuine boot-crash loops. The re-run
> measures **93 ms** — 38.3 % faster than pm2's 151 ms for the same event.

pm2 keeps an edge in cluster-mode memory: its tree is ~11 % smaller,
because the pm2 daemon itself is the cluster primary while pboss runs a
supervised wrapper process per app. Health stayed up through 100 % of
worker kills on both sides.

Full report:
[benchmarks/node/results/REPORT.md](https://github.com/Procboss/benchmarks/blob/main/benchmarks/node/results/REPORT.md)
(an HTML rendering and all raw data sit beside it in the repo).

## Managing a Bun server

Bun 1.3.14 · pm2 5.4.3 · pboss v1.8.0 · fork mode, 100 connections:

| Metric | pm2 | pboss | Winner |
| --- | --- | --- | --- |
| Average requests/sec | 73,892 | 72,139 | pm2 (-2.4%) |
| Average memory (tree) | 119.5 MB | 117.9 MB | pboss (-1.3%) |
| Average cold startup | 389.2 ms | 338.2 ms | pboss (-13.1%) |
| Warm startup (median) | 192 ms | 117 ms | pboss (-39.1%) |
| SIGKILL crash recovery (mean) | 67.3 ms | 65.9 ms | pboss (-2.1%) |
| 50-restart storm (median) | 255 ms | 129 ms | pboss (-49.4%) |

pm2 keeps a marginal throughput lead at this load; pboss wins every
operational metric — cold start 13 % faster, warm start 39 % faster, storm
restarts half the time. The idle daemon costs 63.7 MB (pm2: 66.3 MB) at
0.0 % CPU on both.

> **Cluster mode for Bun apps: pm2 not supported.** pm2's cluster mode is
> `node:cluster` inside its Node daemon — it cannot fork Bun workers, so
> `-i N --interpreter bun` silently degrades to N plain fork processes,
> and forcing `exec_mode: "cluster_mode"` runs the workers under Node,
> not Bun.

> The benchmark records pm2 as not supported in this mode and measures
> pboss alone: `--instances 2` workers sharing one port through
> `SO_REUSEPORT` serve 73,204 req/s at the headline level, with a SIGKILLed
> worker replaced in **81.3 ms** and the shared port never going dark; the
> whole cluster restarts in 178 ms.

Full report:
[benchmarks/bun/results/REPORT.md](https://github.com/Procboss/benchmarks/blob/main/benchmarks/bun/results/REPORT.md)
(HTML rendering and raw data beside it in the repo).

## Managing a Deno server — vs pup

Deno 2.9.7 · pup 1.0.4 · pboss v1.8.1 · 100 connections, 2 workers, both
native cluster models (pboss: N `SO_REUSEPORT` workers · pup: built-in
load balancer over N backends):

| Metric | pup | pboss | Winner |
| --- | --- | --- | --- |
| Average requests/sec (cluster) | 12,444 | 69,088 | pboss (+455%) |
| Average latency, mean (cluster) | 7.51 ms | 0.96 ms | pboss (-87%) |
| Average CPU of tree (cluster) | 121.8% | 62.2% | pboss (-49%) |
| Average memory of tree (cluster) | 269.4 MB | 158.2 MB | pboss (-41%) |
| Cold startup, fork (median) | 1,142 ms | 316 ms | pboss (-72%) |
| Warm startup, fork (median) | 285 ms | 159 ms | pboss (-44%) |
| Idle overhead (RSS) | 88.3 MB | 63.3 MB | pboss (-28%) |
| SIGKILL recovery, fork (mean) | 10,958 ms | 67 ms | pboss (-99.4%) |
| Worker respawn, cluster (mean) | 10,921 ms | 87 ms | pboss (-99.2%) |
| Health stayed up through kills | 70% | 100% | pboss |
| Restart storm, fork (median) | 1,015 ms | 106 ms | pboss (-90%) |

Deno fork-mode throughput is a statistical tie — 68,491 vs 67,953 rps, well
inside run-to-run noise — with pboss 16 % lighter in tree memory and every
operational metric (startup, restart, crash recovery, storm) ahead by
44–99 %. pup's crash numbers reflect its default 10-second restart delay,
run out-of-the-box exactly like the pm2 suites; a tuned `restartDelayMs`
narrows the gap, but the default is what most installs run.

Full report:
[benchmarks/deno/results/REPORT.md](https://github.com/Procboss/benchmarks/blob/main/benchmarks/deno/results/REPORT.md)
(HTML rendering and raw data beside it in the repo).

## How to read these numbers

The winner column already accounts for direction — throughput higher is
better, every other metric lower is better, and a level row reads "tie".
Numbers are medians over 5 runs per manager unless the row says mean, and
the per-run lists are printed under every table in the full reports. The
same-machine caveat applies: the load generator shares the CPUs with the
servers, so absolute numbers are specific to that box — compare the two
columns, don't quote them as platform throughput.

Each edition pins its tool versions in the environment header (the
reports carry date, OS, kernel, CPU, memory, runtime, and manager
versions), so a regression re-run on a different machine still compares
like with like within itself.

## Run them yourself

```bash
git clone https://github.com/Procboss/benchmarks
cd benchmarks/node   # or benchmarks/bun, benchmarks/deno
npm install
bash scripts/benchmark.sh
```

`BENCH_PROFILE=smoke` runs a fast pass first, `BENCH_PROFILE=full` adds a
1000-connection stress level, and `BENCH_INSTANCES=4` sets the cluster
worker count (default: CPU cores). The whole suite — HTTP levels, crash
recovery, restart storms, idle overhead — is driven by one script per
edition, and it regenerates the REPORT from the raw data it just measured.
