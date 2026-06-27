# OpenTelemetry Observability

CoachLink Web now has an optional OpenTelemetry runtime path for Node.js API traffic, structured logs, and business metrics. It is disabled by default and is enabled entirely through the selected runtime config source described in `runtime-config.md`.

## Apollo / Local Env Mapping

If the operational source is a YAML object like FoodLink:

```yaml
otel:
  enabled: true
  traces_enabled: true
  metrics_enabled: true
  collector_endpoint: otel-collector.observability.svc.cluster.local:4317
  insecure: true
  metric_export_interval_seconds: 5
```

Store the equivalent values in CoachLink local env or Apollo `.env` style config:

```env
OTEL_ENABLED=true
OTEL_TRACES_ENABLED=true
OTEL_METRICS_ENABLED=true
OTEL_COLLECTOR_ENDPOINT=otel-collector.observability.svc.cluster.local:4317
OTEL_INSECURE=true
OTEL_METRIC_EXPORT_INTERVAL_SECONDS=5
OTEL_SERVICE_NAME=coachlink-web
```

`OTEL_COLLECTOR_ENDPOINT` uses the gRPC OTLP endpoint. For the in-cluster insecure collector above, do not add `http://` or `https://`.

## Runtime Behavior

- Startup is wired through `src/instrumentation.ts`, so it runs only in the Next.js Node runtime.
- `/api/system/version`, `/api/health`, `/api/public/version`, and `/api/hello-world` are excluded from incoming HTTP tracing to keep health checks out of Jaeger.
- JSON API responses add `x-trace-id`, `x-request-id`, and `x-host-name` when an active server span exists.
- Server logs are written as structured JSON and also added to the active span as events, so request-scoped logs are visible inside Jaeger spans.
- WeChat mini-program requests send `X-Client-Trace-Id` and `X-Client-Request-Id`; feedback submissions include recent server trace IDs from normal API requests and screenshot uploads.

## Metrics

The Web service records these OTel metrics:

- `coachlink_http_requests`
- `coachlink_http_request_duration_seconds`
- `coachlink_http_in_flight_requests`
- `coachlink_api_json_responses`
- `coachlink_api_json_response_bytes`
- `coachlink_logs`
- `coachlink_operations`
- `coachlink_operation_duration_seconds`
- `coachlink_feedback_submissions`
- `coachlink_feedback_image_uploads`
- `coachlink_feedback_image_upload_bytes`

