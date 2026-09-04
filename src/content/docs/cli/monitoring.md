---
title: Monitoring & metrics
description: pboss monit, metrics snapshots, metrics history, and Prometheus exposition output.
section: cli
order: 4
---

## pboss monit

Open an interactive terminal monitor showing real-time CPU, memory, and event loop data for all processes.

```bash
pboss monit
```

## pboss metrics

Dump a current metrics snapshot as JSON.

```bash
pboss metrics
```

```json
{
  "timestamp": 1707650400000,
  "processes": [
    {
      "id": 0,
      "name": "my-api-0",
      "pid": 4521,
      "cpu": 0.3,
      "memory": 44150784,
      "handles": 24,
      "status": "online",
      "restarts": 0,
      "uptime": 8100000
    }
  ],
  "system": {
    "totalMemory": 17179869184,
    "freeMemory": 8589934592,
    "cpuCount": 8,
    "loadAvg": [1.23, 1.45, 1.67],
    "platform": "linux"
  }
}
```

## pboss metrics --history

Retrieve historical metrics. pboss retains up to **1 hour of per-second snapshots** in memory:

```bash
pboss metrics --history 600
```

The argument is the number of seconds of history to return (`600` = last 10 minutes).

## pboss prometheus

Output current metrics in Prometheus exposition format.

```bash
pboss prometheus
```

```text
# HELP pboss_process_cpu CPU usage percentage
# TYPE pboss_process_cpu gauge
pboss_process_cpu{name="my-api-0",id="0"} 0.3
# HELP pboss_process_memory_bytes Memory usage in bytes
# TYPE pboss_process_memory_bytes gauge
pboss_process_memory_bytes{name="my-api-0",id="0"} 44150784
# HELP pboss_process_restarts_total Total restart count
# TYPE pboss_process_restarts_total counter
pboss_process_restarts_total{name="my-api-0",id="0"} 0
# HELP pboss_process_uptime_seconds Process uptime in seconds
# TYPE pboss_process_uptime_seconds gauge
pboss_process_uptime_seconds{name="my-api-0",id="0"} 8100
# HELP pboss_process_status Process status (1=online)
# TYPE pboss_process_status gauge
pboss_process_status{name="my-api-0",id="0",status="online"} 1
# HELP pboss_system_memory_total_bytes Total system memory
# TYPE pboss_system_memory_total_bytes gauge
pboss_system_memory_total_bytes 17179869184
# HELP pboss_system_memory_free_bytes Free system memory
# TYPE pboss_system_memory_free_bytes gauge
pboss_system_memory_free_bytes 8589934592
# HELP pboss_system_load_average System load average
# TYPE pboss_system_load_average gauge
pboss_system_load_average{period="1m"} 1.23
pboss_system_load_average{period="5m"} 1.45
pboss_system_load_average{period="15m"} 1.67
```

For continuous scraping, the dashboard also serves this format at `http://localhost:9616/metrics` — see [Prometheus & Grafana](/guide/prometheus).
