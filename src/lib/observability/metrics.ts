import {
    metrics,
    type Counter,
    type Histogram,
    type UpDownCounter,
} from "@opentelemetry/api";

interface MetricInstruments {
    apiJsonResponses: Counter;
    apiJsonResponseBytes: Histogram;
    httpRequests: Counter;
    httpRequestDuration: Histogram;
    httpInFlight: UpDownCounter;
    logs: Counter;
    operations: Counter;
    operationDuration: Histogram;
    feedbackSubmissions: Counter;
    feedbackImageUploads: Counter;
    feedbackImageBytes: Histogram;
}

let cachedMeterProvider: unknown;
let cachedInstruments: MetricInstruments | null = null;

function instruments(): MetricInstruments {
    const provider = metrics.getMeterProvider();
    if (cachedInstruments && cachedMeterProvider === provider) return cachedInstruments;

    const meter = provider.getMeter("coachlink/web");
    cachedMeterProvider = provider;
    cachedInstruments = {
        apiJsonResponses: meter.createCounter("coachlink_api_json_responses", {
            description: "Total JSON API responses emitted by the Next.js backend.",
        }),
        apiJsonResponseBytes: meter.createHistogram("coachlink_api_json_response_bytes", {
            description: "Serialized JSON API response size in bytes.",
            unit: "By",
        }),
        httpRequests: meter.createCounter("coachlink_http_requests", {
            description: "Total HTTP requests observed by Node HTTP instrumentation.",
        }),
        httpRequestDuration: meter.createHistogram("coachlink_http_request_duration_seconds", {
            description: "HTTP request duration in seconds.",
            unit: "s",
        }),
        httpInFlight: meter.createUpDownCounter("coachlink_http_in_flight_requests", {
            description: "Currently executing HTTP requests by method and path.",
        }),
        logs: meter.createCounter("coachlink_logs", {
            description: "Total structured server logs emitted by severity.",
        }),
        operations: meter.createCounter("coachlink_operations", {
            description: "Total business operations by name and status.",
        }),
        operationDuration: meter.createHistogram("coachlink_operation_duration_seconds", {
            description: "Business operation duration in seconds.",
            unit: "s",
        }),
        feedbackSubmissions: meter.createCounter("coachlink_feedback_submissions", {
            description: "Total feedback submission attempts.",
        }),
        feedbackImageUploads: meter.createCounter("coachlink_feedback_image_uploads", {
            description: "Total feedback image upload attempts.",
        }),
        feedbackImageBytes: meter.createHistogram("coachlink_feedback_image_upload_bytes", {
            description: "Feedback image upload size in bytes.",
            unit: "By",
        }),
    };
    return cachedInstruments;
}

function label(value: string | number | undefined | null, fallback = "unknown") {
    const normalized = String(value ?? "").trim();
    if (!normalized) return fallback;
    return normalized.length > 160 ? normalized.slice(0, 160) : normalized;
}

export function recordApiJsonResponse(status: number, success: string, bytes: number) {
    const attrs = {
        status: label(status),
        success: label(success),
    };
    const inst = instruments();
    inst.apiJsonResponses.add(1, attrs);
    if (Number.isFinite(bytes) && bytes >= 0) {
        inst.apiJsonResponseBytes.record(bytes, attrs);
    }
}

export function incHttpInFlight(method: string, path: string) {
    instruments().httpInFlight.add(1, {
        method: label(method),
        path: label(path, "unmatched"),
    });
}

export function decHttpInFlight(method: string, path: string) {
    instruments().httpInFlight.add(-1, {
        method: label(method),
        path: label(path, "unmatched"),
    });
}

export function recordHttpRequest(method: string, path: string, status: number, durationMs: number) {
    const attrs = {
        method: label(method),
        path: label(path, "unmatched"),
        status: label(status),
    };
    const inst = instruments();
    inst.httpRequests.add(1, attrs);
    if (Number.isFinite(durationMs) && durationMs >= 0) {
        inst.httpRequestDuration.record(durationMs / 1000, attrs);
    }
}

export function recordLog(level: string) {
    instruments().logs.add(1, { level: label(level) });
}

export function recordOperation(name: string, status: string, durationMs: number) {
    const attrs = {
        operation: label(name),
        status: label(status),
    };
    const inst = instruments();
    inst.operations.add(1, attrs);
    if (Number.isFinite(durationMs) && durationMs >= 0) {
        inst.operationDuration.record(durationMs / 1000, attrs);
    }
}

export function recordFeedbackSubmission(status: string, category: string, imageCount: number, recentRequestCount: number) {
    instruments().feedbackSubmissions.add(1, {
        status: label(status),
        category: label(category),
        image_count: label(imageCount),
        recent_request_count: label(recentRequestCount),
    });
}

export function recordFeedbackImageUpload(status: string, bytes: number) {
    const attrs = { status: label(status) };
    const inst = instruments();
    inst.feedbackImageUploads.add(1, attrs);
    if (Number.isFinite(bytes) && bytes >= 0) {
        inst.feedbackImageBytes.record(bytes, attrs);
    }
}
