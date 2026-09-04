---
title: Prometheus & Grafana
description: Scrape pboss metrics with Prometheus, the full metric catalog, Grafana panel recipes, and alert rules.
section: guides
order: 4
---

pboss runs a dedicated Prometheus metrics server on default port **9616**, separate from the dashboard, following best practices for metrics collection.

Start it (it comes up with the dashboard):

```bash
pboss dashboard --metrics-port 9616
curl http://localhost:9616/metrics
```

## Prometheus configuration

Add the following to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: "pboss"
    scrape_interval: 5s
    static_configs:
      - targets: ["localhost:9616"]
```

## Available metrics

| Metric | Type | Labels | Description |
|---|---|---|---|
| `pboss_process_cpu` | gauge | `name`, `id` | CPU usage percentage |
| `pboss_process_memory_bytes` | gauge | `name`, `id` | Memory usage in bytes |
| `pboss_process_restarts_total` | counter | `name`, `id` | Total restart count |
| `pboss_process_uptime_seconds` | gauge | `name`, `id` | Uptime in seconds |
| `pboss_process_status` | gauge | `name`, `id`, `status` | 1 if online, 0 otherwise |
| `pboss_system_memory_total_bytes` | gauge | — | Total system memory |
| `pboss_system_memory_free_bytes` | gauge | — | Free system memory |
| `pboss_system_load_average` | gauge | `period` | Load average (1m, 5m, 15m) |

## Grafana dashboard

Import a dashboard with the following panels for comprehensive monitoring:

- **Process status overview** — stat panel colored by status (`pboss_process_status`).
- **CPU usage per process** — time series of `pboss_process_cpu` grouped by `name`.
- **Memory usage per process** — time series of `pboss_process_memory_bytes` grouped by `name`.
- **Restart rate** — graph of `rate(pboss_process_restarts_total[5m])` to detect instability.
- **System load** — time series of `pboss_system_load_average` across all periods.
- **Memory pressure** — gauge computing `1 - (pboss_system_memory_free_bytes / pboss_system_memory_total_bytes)`.

## Alert rules example

```yaml
groups:
  - name: pboss
    rules:
      - alert: ProcessDown
        expr: pboss_process_status == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Process {{ $labels.name }} is down"

      - alert: HighRestartRate
        expr: rate(pboss_process_restarts_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Process {{ $labels.name }} is restarting frequently"

      - alert: HighMemoryUsage
        expr: pboss_process_memory_bytes > 1e9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Process {{ $labels.name }} using > 1GB memory"
```

The metric names match `pboss prometheus` output exactly — see [Monitoring & metrics](/cli/monitoring) for the raw exposition format.
