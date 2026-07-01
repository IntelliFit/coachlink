export interface OTelConfig {
    enabled: boolean;
    tracesEnabled: boolean;
    metricsEnabled: boolean;
    collectorEndpoint: string;
    insecure: boolean;
    metricExportIntervalSeconds: number;
    serviceName: string;
    environment: string;
}

function readBool(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (raw == null || raw === "") return fallback;
    return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

function readNumber(name: string, fallback: number): number {
    const raw = process.env[name];
    if (raw == null || raw === "") return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function readString(names: string[], fallback = ""): string {
    for (const name of names) {
        const value = process.env[name]?.trim();
        if (value) return value;
    }
    return fallback;
}

function defaultServiceName(environment: string): string {
    const normalized = environment.trim().toLowerCase();
    if (normalized === "development" || normalized === "dev" || normalized === "local" || normalized === "test") {
        return "coachlink-backend-dev";
    }
    return "coachlink-backend-main";
}

function readServiceName(environment: string): string {
    const appName = readString(["APP_NAME"], "");
    if (appName) return appName;

    const otelServiceName = readString(["OTEL_SERVICE_NAME"], "");
    if (otelServiceName && otelServiceName !== "coachlink-web") return otelServiceName;

    return defaultServiceName(environment);
}

export function readOTelConfig(): OTelConfig {
    const enabled = readBool("OTEL_ENABLED", false);
    const environment = readString(
        ["TRACE_ENV", "NEXT_PUBLIC_APP_ENV", "APP_ENV", "NODE_ENV"],
        "unknown",
    );
    return {
        enabled,
        tracesEnabled: readBool("OTEL_TRACES_ENABLED", true),
        metricsEnabled: readBool("OTEL_METRICS_ENABLED", true),
        collectorEndpoint: readString(
            ["OTEL_COLLECTOR_ENDPOINT", "OTEL_EXPORTER_OTLP_ENDPOINT"],
            "localhost:4317",
        ),
        insecure: readBool("OTEL_INSECURE", true),
        metricExportIntervalSeconds: readNumber("OTEL_METRIC_EXPORT_INTERVAL_SECONDS", 15),
        serviceName: readServiceName(environment),
        environment,
    };
}

export function otelEnvExample(): string {
    return [
        "OTEL_ENABLED=true",
        "OTEL_TRACES_ENABLED=true",
        "OTEL_METRICS_ENABLED=true",
        "OTEL_COLLECTOR_ENDPOINT=otel-collector.observability.svc.cluster.local:4317",
        "OTEL_INSECURE=true",
        "OTEL_METRIC_EXPORT_INTERVAL_SECONDS=5",
        "APP_NAME=coachlink-backend-main",
    ].join("\n");
}
