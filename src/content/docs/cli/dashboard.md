---
title: Dashboard
description: Launch and stop the built-in pboss web dashboard with live charts, process controls, and a log viewer.
section: cli
order: 5
---

The pboss dashboard is a self-contained web application served directly by the daemon. It requires no external dependencies — the HTML, CSS, JavaScript, and WebSocket server are all built in.

## pboss dashboard

Launch the built-in web dashboard.

```bash
pboss dashboard
```

```bash
pboss dashboard --port 8080 --metrics-port 8081
```

Output:

```text
⚡ Dashboard running at http://localhost:9615
📊 Prometheus metrics at http://localhost:9616/metrics
```

## pboss dashboard stop

Stop the web dashboard.

```bash
pboss dashboard stop
```

Stopping the dashboard does not affect managed processes — only the web UI and metrics endpoints go away.

## Dashboard features

- **Process overview** — four summary cards: online/errored counts, total CPU, aggregate memory.
- **System information** — platform, CPU count, load average, and memory usage with a visual progress bar.
- **CPU & memory chart** — a real-time canvas-rendered chart of aggregate CPU % and memory over the last 60 data points, updating every 2 seconds.
- **Process table** — every managed process with ID, name, color-coded status, PID, CPU, memory, restarts, uptime, and action buttons (restart, stop, view logs).
- **Log viewer** — a tabbed panel streaming stdout/stderr of the selected process, with syntax-highlighted timestamps and errors, auto-scrolled to the latest entry.
- **Live updates** — all data streams over WebSocket with a visual pulse indicator confirming the connection; automatic reconnect within 2 seconds if it drops.

## API access

The dashboard port also exposes a REST API and a WebSocket API — process control from scripts and CI is covered in [Dashboard API](/guide/dashboard-api). Prometheus scrapers can hit the metrics port directly; see [Prometheus & Grafana](/guide/prometheus).
