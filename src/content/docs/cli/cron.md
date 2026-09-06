---
title: Cron Jobs
description: Schedule standalone commands with friendly syntax — everyday@9:11, every-second, every-sunday, today@23:10, on-date — or raw cron expressions. Persisted across reboots.
section: cli
order: 9
---

Standalone cron jobs run any shell command on a schedule — **without a managed process**. Unlike `--cron` restart schedules (which recycle a running app), cron jobs are first-class citizens of the daemon: they are persisted in `~/.pboss/cron.json`, survive daemon restarts and reboots, and log every run to `~/.pboss/logs/cron/<name>.log`.

## pboss cron run

Schedule a command using human-friendly syntax:

```bash
pboss cron run everyday@9:11 "bun /srv/backup.ts"
```

```bash
pboss cron run every-sunday@10:10 "sh /srv/cleanup.sh" --name cleanup
```

```bash
pboss cron run on-date@24-10-2026-23:10 "node migrate.js"
```

## The schedule grammar

Times use the 24-hour clock; dates are **day-month-year** (`24-10-2026` = October 24, 2026).

| Schedule | Meaning |
|---|---|
| `everyday` | every day at 00:00 |
| `everyday@10` | every day at 10:00 |
| `everyday@9:11` | every day at 09:11 |
| `everyday@24:30` | every day at 00:30 (`24:xx` = the next day) |
| `everysecond` | every second |
| `every-15-seconds` | every 15 seconds (1–59) |
| `everyhour` / `everyhour@30` | every hour at :00 / :30 |
| `everyminute` | every minute |
| `everyweek` / `everyweek@10:10` | every Sunday |
| `every-sunday` / `everyMonday@10:10` / `onSunday@23:10` | weekly on a weekday (full or 3-letter names) |
| `everymonth` / `everymonth@10:10` | every 1st |
| `every-15th` / `every-15@10:10` | every 15th of the month |
| `every-6-hours` / `every-6-hours@30` | every 6 hours |
| `every-30-minutes` | every 30 minutes |
| `every-2-days` / `every-2-days@8` | every 2nd day |
| `today@23:10` | once, today (must be in the future) |
| `tomorrow@8:00` | once, tomorrow |
| `on-date@24-10-2026` | once, 24 Oct 2026 at 00:00 |
| `on-date@24-10-2026-23:10` | once, 24 Oct 2026 at 23:10 |
| `"*/5 * * * *"` | raw 5-field cron expression (escape hatch) |
| `"*/10 * * * * *"` | raw 6-field cron — first field is seconds |

Notes:

- Hour **24** is accepted and means "the following day": `24:30` is `00:30` the next day.
- Dates are calendar-validated (leap years included) — `on-date@31-02-2026` is rejected with a clear error.
- Keywords tolerate hyphens, underscores and camelCase: `on-date@`, `onDate@` and `on_date@` are the same word; so are `every-second` and `everySecond`.
- Next-run times are computed by the mature [cron-parser](https://www.npmjs.com/package/cron-parser) library, which also validates raw cron expressions — 6-field ones get a seconds field.
- Jobs missed while the machine or daemon was down are **skipped** (like classic cron), not back-filled; recurring jobs reschedule to their next future occurrence.
- If a time has already passed for `today@…` or `on-date@…`, pboss rejects it with a suggestion instead of scheduling a job that never fires.

Options for `cron run`:

- `--name, -n <name>` — job name (default: derived from the command)
- `--cwd <path>` — working directory for the command (default: current directory)

## pboss cron list

List all scheduled jobs with their next run, run counts, and last exit status:

```bash
pboss cron list
```

```text
┌────┬─────────┬─────────────┬──────────────────┬───────────────────────────┬──────┬──────┬──────────┐
│ id │ name    │ schedule    │ command          │ next run                  │ runs │ last │ status   │
├────┼─────────┼─────────────┼──────────────────┼───────────────────────────┼──────┼──────┼──────────┤
│  1 │ backup  │ everyday@9  │ bun backup.ts    │ 2026-09-07 09:00 Mon      │   14 │ ✓    │ ● online │
│  2 │ cleanup │ every-sunday│ sh cleanup.sh    │ 2026-09-13 00:00 Sun      │    3 │ ✓    │ ● online │
│  3 │ migrate │ on-date@24-10-2026-23:10 │ node migrate.js │ 2026-10-24 23:10 │  0 │ -    │ ● done   │
└────┴─────────┴─────────────┴──────────────────┴───────────────────────────┴──────┴──────┴──────────┘
```

One-shot jobs stay in the list with a `done` status after firing so you can inspect their exit code; remove them when you no longer need the record.

## pboss cron next

Preview upcoming runs without waiting for them:

```bash
pboss cron next backup --count 5
```

## pboss cron trigger

Run a job immediately, without waiting for its schedule (the schedule itself is unaffected):

```bash
pboss cron trigger backup
```

## pboss cron remove

Remove a job by id or name:

```bash
pboss cron remove backup
pboss cron remove 3
```

## Cron jobs in ecosystem files

Declare cron jobs alongside your apps in `pboss.config.ts` / `ecosystem.config.{ts,json}`. Starting the file registers the jobs; re-running it updates changed schedules in place (jobs are matched by name):

```ts
export default {
  crons: [
    {
      name: "backup",
      schedule: "everyday@2:00",
      command: "bun /srv/backup.ts",
    },
    {
      name: "report",
      schedule: "every-15th@10:10",
      command: "sh /srv/report.sh",
    },
    {
      // paused until you enable it later
      name: "maintenance",
      schedule: "every-sunday@5:00",
      command: "sh /srv/maintenance.sh",
      enabled: false,
    },
  ],
  apps: [
    /* … */
  ],
};
```

| Field | Type | Description |
|---|---|---|
| `name` | string? | Job name — defaults to a slug of the command. Used to match/update jobs on re-start. |
| `schedule` | string | Friendly schedule or raw cron expression (same grammar as `pboss cron run`). |
| `command` | string | Shell command to run. |
| `cwd` | string? | Working directory — defaults to the ecosystem file's directory. |
| `enabled` | boolean? | Set `false` to keep the job defined but paused (default `true`). |

## Programmatic API

```ts
import { pboss } from "pboss";

const job = await pboss.cronAdd("everyday@9:11", "bun backup.ts", { name: "backup" });

for (const j of await pboss.cronJobs()) {
  console.log(`${j.name} — ${j.description} (runs: ${j.runCount})`);
}

await pboss.cronTrigger("backup");   // run now
await pboss.cronRemove("backup");    // remove
```

## How execution works

Jobs run through the system shell (`/bin/sh -c` on Unix, `cmd /c` on Windows), so pipes, redirects, and compound commands work:

```bash
pboss cron run everyday@3 "bun report.ts | mail -s 'daily report' ops@example.com"
```

Every run appends a header (job name, schedule, working directory), the command's combined output, and a footer with the exit code and duration to `~/.pboss/logs/cron/<name>.log`. The daemon's scheduler sleeps until the earliest next run with a periodic watchdog rescan, so firing is precise to the second and robust against clock adjustments.
