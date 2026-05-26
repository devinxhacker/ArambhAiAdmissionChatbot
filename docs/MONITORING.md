# Monitoring

Local stack ships with Prometheus + Grafana out of the box.

## Components

| Endpoint | What |
|---|---|
| `backend:8000/metrics` | HTTP rate, latency, errors, in-flight |
| `ai-services:8100/metrics` | Same metrics for AI service |
| `prometheus:9090` | Raw queries and targets |
| `grafana:3001` | Dashboards (`Arambh Overview` provisioned) |

## Logs

All Python services emit structured JSON via `structlog`. Tail with:

```bash
docker compose logs -f backend
docker compose logs -f ai-services
docker compose logs -f crawler
```

Recommended log fields (already wired):
- `event` (logger label)
- `error` for exceptions
- `doc_id`, `chunks` for ingestion
- `intent`, `confidence` for query handling (extend in `agents/nodes.py` once wired)

## Key SLOs to monitor

| SLO | Target | How |
|---|---|---|
| `/ask` p95 latency | < 8 s on CPU | Grafana panel `p95 ask latency (s)` |
| Retrieval empty rate | < 5% | new counter `arambh_retrieval_empty_total` |
| Validation unsupported rate | < 10% | new counter `arambh_validation_unsupported_total` |
| Crawl job failure rate | < 5% | Mongo `crawl_jobs.status="failed"` |

## Alerts (suggested)

Wire Alertmanager with rules like:

```yaml
- alert: AskLatencyHigh
  expr: histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{handler=~".*ask.*"}[5m]))) > 12
  for: 10m
```
