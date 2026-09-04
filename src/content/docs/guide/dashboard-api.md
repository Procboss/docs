---
title: Dashboard API
description: The pboss REST and WebSocket API — control processes from scripts and CI over the dashboard port.
section: guides
order: 3
---

The [dashboard](/cli/dashboard) exposes a REST API on the same port (default 9615) and a WebSocket API at `/ws`. Everything the dashboard UI does, you can do from scripts, CI, or your own tooling.

## REST API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Dashboard HTML |
| `GET` | `/api/processes` | List all processes as JSON |
| `GET` | `/api/metrics` | Current metrics snapshot |
| `GET` | `/api/metrics/history?seconds=300` | Historical metrics |
| `GET` | `/api/prometheus` or `/metrics` | Prometheus text format |
| `POST` | `/api/restart` | Restart process |
| `POST` | `/api/stop` | Stop process |
| `POST` | `/api/reload` | Graceful reload |
| `POST` | `/api/delete` | Delete process |
| `POST` | `/api/scale` | Scale process |
| `POST` | `/api/flush` | Flush logs |

POST endpoints accept a JSON body with a `target` field for process identification, plus additional fields where applicable (e.g. `count` for scaling).

Examples:

```bash
curl http://localhost:9615/api/processes
```

```bash
curl -X POST http://localhost:9615/api/restart \
  -H "Content-Type: application/json" \
  -d '{"target": "my-api"}'
```

```bash
curl -X POST http://localhost:9615/api/scale \
  -H "Content-Type: application/json" \
  -d '{"target": "my-api", "count": 8}'
```

```bash
curl http://localhost:9615/metrics
```

## WebSocket API

Connect to `ws://localhost:9615/ws` for real-time bidirectional communication.

**Client → server messages:**

```json
{ "type": "getState", "data": {} }
```

```json
{ "type": "getLogs", "data": { "target": 0, "lines": 50 } }
```

```json
{ "type": "restart", "data": { "target": "my-api" } }
```

```json
{ "type": "stop", "data": { "target": 0 } }
```

```json
{ "type": "reload", "data": { "target": "all" } }
```

```json
{ "type": "scale", "data": { "target": "my-api", "count": 4 } }
```

**Server → client messages:**

```json
{
  "type": "state",
  "data": {
    "processes": [],
    "metrics": {
      "timestamp": 1707650400000,
      "processes": [],
      "system": {}
    }
  }
}
```

```json
{
  "type": "logs",
  "data": [
    { "name": "my-api-0", "id": 0, "out": "...", "err": "..." }
  ]
}
```

## Security note

The dashboard and its API bind to localhost by default and have **no authentication** — anyone who can reach the port can control your processes. Keep it that way: bind locally, and front remote access with an SSH tunnel (`ssh -L 9615:localhost:9615`) or a reverse proxy that adds auth. Never expose the dashboard port directly to the internet.
