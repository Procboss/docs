---
title: Threshold alerts
description: Resource threshold alerts — the agent-side detector for CPU spikes, memory leaks, restart loops, blocked event loops, handle growth and server-wide pressure, with hysteresis, per-process overrides and pboss alerts.
section: cloud
order: 5
---

The linked agent watches the metrics it already collects every report tick and fires alert events when real conditions develop — not on every blip. Every detector is a small hysteresis state machine: a condition must hold for its **sustained duration** before the alert fires, must stay under the **clear level** for the same duration before a `.recovered` event fires, and while it persists it re-emits a quiet "still elevated" heartbeat at most every 10 minutes. A one-tick spike fires nothing.

Alerts ride the same at-least-once pipeline as crashes — event ids, the agent's outbox, cloud ack, dedup — so an alert that trips during a network outage is still delivered after the reconnect, and a threshold event carries the facts (`metricValue`, `thresholdValue`, `durationSec`) instead of just prose.

## What is detected

| Condition | Default trigger | Clear | Sustained |
|---|---|---|---|
| CPU spike (per process) | ≥ 95% | < 80% | 30s |
| CPU sustained (per process) | ≥ 70% | < 55% | 5 min |
| Memory spike | ≥ 40% growth in 60s AND ≥ 20MB | rate < 10%/60s | — (rate-based) |
| Memory high | ≥ 85% of `maxMemoryRestart` | < 70% | 60s |
| Restart loop | ≥ 5 restarts in a rolling 5 min | self-clearing | — |
| Event-loop latency | ≥ 100ms | < 50ms | 30s |
| Handle/FD growth | ≥ 3× the 10-min-ago value AND ≥ 200 | < 1.5× baseline | 5 min |
| Server CPU | load ÷ cores ≥ 0.85 | < 0.65 | 5 min |
| Server memory | free < 10% | > 20% | 2 min |

The distinctions are the point. A CPU **spike** is a runaway loop or a stuck request; **sustained** CPU is a capacity problem. A memory **spike** (fast growth) is a leak; **high** (near the ceiling) is an early warning before the `maxMemoryRestart` auto-restart fires — turning a silent restart into an actionable alert. Memory-high is **off by default without a limit** (`maxMemoryRestart` or `alertMemHighMB`), because "high" is unknowable per-app without a ceiling. Server-wide events use the `__system__` process name in the dashboard's feed.

The handle-growth baseline **freezes** while a leak is tracked: without that, a leak older than the 10-minute window would quietly become its own baseline and the alert would dissolve exactly when it matters.

## Configuring thresholds

Three surfaces, all merged — ecosystem fields win over the file, the file wins over the defaults:

**Per process, in the config** ([process options](/guide/config)):

```js
module.exports = {
  apps: [{
    name: "api",
    script: "server.ts",
    alertCpuSpikePercent: 90,     // this app gets less headroom
    alertMemHighMB: 512,          // opt into mem.high without a limit
    alertDisabled: true,          // or opt out of ALL threshold alerts
  }],
};
```

**On the machine** — `~/.pboss/alert-thresholds.json` (same directory pattern as the other pboss state):

```json
{
  "system": {
    "cpuPercent": { "trigger": 85, "clear": 65, "sustainedSec": 300 },
    "memFreePercent": { "trigger": 10, "clear": 20, "sustainedSec": 120 }
  },
  "defaults": { "cpuSpikePercent": { "trigger": 95, "clear": 80, "sustainedSec": 30 } },
  "overrides": { "my-api": { "cpuSpikePercent": { "trigger": 90 } } }
}
```

**Live, from the CLI or the dashboard** — `pboss alerts set my-api --cpu-spike 90` applies immediately (no process restart) and persists to the file; the cloud's `config.alerts.set` command writes the same shape remotely. `pboss alerts show` renders the effective thresholds — defaults, overrides and per-process fields merged.

## Testing the pipeline

`pboss alerts test <process> <kind>` fires ONE synthetic alert through the real delivery chain — outbox, cloud ack, your connected channels — without waiting for a real spike. Kinds: `cpu`, `mem`, `restart`, `eventloop`, `handles`, `system-cpu`, `system-mem`. With the cloud link down it queues honestly ("Test alert queued") and delivers on the next reconnect, which is itself a useful check of the outage path.

## When the same alert keeps coming back

The cloud's alerts inbox counts recurrences instead of stacking rows. The same condition — same server, process, kind and normalized title, volatile numbers ignored — folds into one incident while repeats land **within 12 hours** of its first sighting, open or resolved: the parent gains a **×N** counter and floats to the top; a repeat on a resolved parent re-opens it. The window is configurable — `alertOccurrenceWindowMs` in `src/configs/cloud.ts`. Each fold records its own line — time plus reading ("86%", "exit 1") — so the expander unfolds real history; a repeat after the window opens a fresh episode, announced again.

Channels hear the **first** occurrence of an episode, any severity escalation, and any repeat that re-opens a resolved incident — not every repeat; a post-window repeat announces again too. Deploys notify every run (chat screens track them); failures still count up per repo.

Reading IS the gesture. The bell counts **unseen** announcements; opening the inbox page marks them all seen (the dots stay for the visit, so what rung is still visible), the dashboard's alerts feed marks each row as you scroll past it, and Telegram reads count too — any message or reaction marks everything seen, and a periodic read-receipt sweep catches silent reads. A recurrence re-arms its row as unseen: new activity is new news. Dismissing from Telegram closes the cycle until the condition returns — an in-window repeat re-opens the counted row, a later one starts fresh.

The inbox page reads like an email client: a sidebar with the fleet's headline numbers — open critical, open warnings, resolved today (a resolve moves its number between them) — and filter-by-server/process lists that re-scope the feed and the stats, plus a card feed grouped by day — Today, Yesterday, the weekday-dated tail. Cards share one ink frame (severity reads from the icon) and carry their occurrence count and routing; the "show occurrences" expander unfolds per-reading history (time and value, newest first), and a numbered pager walks it — page 1 holds the newest 25; older pages stay put.

What the alert **asks of you** decides what its card offers. Kinds that need someone to fix the thing — a crashed process, a failed deploy, a failed cron — carry a **Resolve** button: your "I handled it" stamp that dims the card and closes the incident (an in-window recurrence re-opens the same incident and rings again). Informational conditions (CPU spikes, memory climbs, low disk, health flaps) never offer the gesture — they self-heal, and reading them is the point. The split is kind-based, not severity-based: a warning-severity cron failure still needs resolving, a critical-severity memory spike doesn't.

## Related

- [Agent API](/cloud/agent-api) — the wire kinds (`cpu.spike`, `mem.high`, …) and their fields.
- [Notifications](/cloud/notifications) — where alerts land (Telegram, Discord, webhooks).
- [Config reference](/guide/config) — the `alert*` process options.
