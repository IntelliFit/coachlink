import type { IncomingMessage, ServerResponse } from "node:http";
import { credentials } from "@grpc/grpc-js";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { readOTelConfig, type OTelConfig } from "./config";
import { logInfo } from "./logger";
import {
    clientTraceIdFromHeaders,
    deleteRequestTraceContext,
    registerRequestTraceContext,
    requestIdFromHeaders,
} from "./requestContext";
import {
    decHttpInFlight,
    incHttpInFlight,
    recordHttpRequest,
} from "./metrics";

declare global {
    // eslint-disable-next-line no-var
    var __coachlinkOTelSDK: NodeSDK | undefined;
}

const requestStarts = new WeakMap<IncomingMessage, number>();

function isHealthCheckPath(path: string): boolean {
    const cleanPath = (path || "").split("?")[0];
    return cleanPath === "/api/healthy" ||
        cleanPath === "/api/health" ||
        cleanPath === "/api/system/version" ||
        cleanPath === "/api/public/version" ||
        cleanPath === "/api/hello-world";
}

function hostname(): string {
    // Keep the node: URI out of Next's instrumentation webpack layer. The OTel
    // packages themselves are externalized in next.config.ts so standalone
    // tracing can still include their complete runtime dependency trees.
    const nodeRequire = eval("require") as NodeRequire;
    return (nodeRequire("node:os") as typeof import("node:os")).hostname();
}

function exporterOptions(cfg: OTelConfig) {
    return {
        url: cfg.collectorEndpoint,
        credentials: cfg.insecure ? credentials.createInsecure() : undefined,
    };
}

function requestPath(req: IncomingMessage): string {
    return (req.url || "").split("?")[0] || "unknown";
}

function requestMethod(req: IncomingMessage): string {
    return req.method || "UNKNOWN";
}

function statusCode(res: ServerResponse): number {
    return Number(res.statusCode || 0) || 0;
}

function operationName(method: string, path: string): string {
    return `${method} ${path || "unknown"}`;
}

function responseTraceId(span: any): string {
    try {
        return span?.spanContext?.().traceId || "";
    } catch {
        return "";
    }
}

export function initObservability() {
    if (globalThis.__coachlinkOTelSDK) return;

    const cfg = readOTelConfig();
    if (!cfg.enabled) {
        logInfo("OpenTelemetry 未启用", {
            otel_enabled: false,
            service_name: cfg.serviceName,
        });
        return;
    }

    if (process.env.OTEL_DIAG_LOG_LEVEL) {
        diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
    }

    const resource = resourceFromAttributes({
        "service.name": cfg.serviceName,
        "service.namespace": "coachlink",
        "deployment.environment.name": cfg.environment,
        "host.name": hostname(),
        "service.instance.id": hostname(),
    });

    const metricExportIntervalMillis = Math.max(1, cfg.metricExportIntervalSeconds) * 1000;
    const metricExportTimeoutMillis = Math.min(10_000, metricExportIntervalMillis);

    const metricReaders = cfg.metricsEnabled
        ? [
            new PeriodicExportingMetricReader({
                exporter: new OTLPMetricExporter(exporterOptions(cfg)),
                exportIntervalMillis: metricExportIntervalMillis,
                exportTimeoutMillis: metricExportTimeoutMillis,
            }),
        ]
        : [];

    const spanProcessors = cfg.tracesEnabled
        ? [new BatchSpanProcessor(new OTLPTraceExporter(exporterOptions(cfg)))]
        : [];

    const instrumentations = cfg.tracesEnabled
        ? [
            new HttpInstrumentation({
                ignoreIncomingRequestHook: (req) => isHealthCheckPath(req.url || ""),
                requestHook: (span, request) => {
                    if (!("url" in request)) return;
                    const req = request as IncomingMessage;
                    const path = requestPath(req);
                    const method = requestMethod(req);
                    const name = operationName(method, path);
                    span.updateName(name);
                    requestStarts.set(req, Date.now());
                    incHttpInFlight(method, path);

                    const traceId = responseTraceId(span);
                    const requestId = requestIdFromHeaders(req.headers);
                    const clientTraceId = clientTraceIdFromHeaders(req.headers);
                    registerRequestTraceContext(traceId, {
                        requestId,
                        method,
                        path,
                    });

                    span.setAttributes({
                        "http.route": path,
                        "http.method": method,
                        "http.request.method": method,
                        "coachlink.request_id": requestId,
                        "coachlink.client_trace_id": clientTraceId,
                        "coachlink.url.path": path,
                        "coachlink.operation": name,
                    });
                    span.addEvent("收到请求", {
                        "http.method": method,
                        "url.path": path,
                        "request_id": requestId,
                    });
                },
                applyCustomAttributesOnSpan: (span, request, response) => {
                    if (!("url" in request)) return;
                    const req = request as IncomingMessage;
                    const res = response as ServerResponse;
                    const path = requestPath(req);
                    const method = requestMethod(req);
                    const durationMs = Date.now() - (requestStarts.get(req) || Date.now());
                    requestStarts.delete(req);
                    decHttpInFlight(method, path);
                    recordHttpRequest(method, path, statusCode(res), durationMs);

                    span.addEvent("请求完成", {
                        "http.method": method,
                        "url.path": path,
                        "http.status_code": statusCode(res),
                        "http.duration_ms": durationMs,
                    });

                    const traceId = responseTraceId(span);
                    if (traceId) deleteRequestTraceContext(traceId);
                },
            }),
        ]
        : [];

    const sdk = new NodeSDK({
        resource,
        instrumentations,
        metricReaders,
        spanProcessors,
    });
    sdk.start();
    globalThis.__coachlinkOTelSDK = sdk;

    logInfo("OpenTelemetry 已启用", {
        traces_enabled: cfg.tracesEnabled,
        metrics_enabled: cfg.metricsEnabled,
        collector_endpoint: cfg.collectorEndpoint,
        metric_export_interval_seconds: cfg.metricExportIntervalSeconds,
        service_name: cfg.serviceName,
        environment: cfg.environment,
    });
}
