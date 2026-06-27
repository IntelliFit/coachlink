import { trace } from "@opentelemetry/api";

export const TRACE_ID_HEADER = "x-trace-id";
export const REQUEST_ID_HEADER = "x-request-id";
export const HOST_NAME_HEADER = "x-host-name";

export interface RequestTraceContext {
    traceId: string;
    requestId: string;
    hostName: string;
    method?: string;
    path?: string;
}

const contexts = new Map<string, RequestTraceContext>();
const hostName =
    process.env.HOSTNAME ||
    process.env.COMPUTERNAME ||
    "unknown";

function normalizeHeaderValue(value: unknown): string {
    if (Array.isArray(value)) return String(value[0] || "").trim();
    return typeof value === "string" ? value.trim() : "";
}

export function newRequestId(): string {
    const randomUUID = globalThis.crypto?.randomUUID;
    if (typeof randomUUID === "function") return randomUUID.call(globalThis.crypto);
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function registerRequestTraceContext(
    traceId: string,
    value: Partial<RequestTraceContext>,
): RequestTraceContext | null {
    if (!traceId) return null;
    const requestId =
        value.requestId?.trim() ||
        newRequestId();
    const context: RequestTraceContext = {
        traceId,
        requestId,
        hostName: value.hostName?.trim() || hostName,
        method: value.method,
        path: value.path,
    };
    contexts.set(traceId, context);
    return context;
}

export function deleteRequestTraceContext(traceId: string) {
    if (traceId) contexts.delete(traceId);
}

export function requestIdFromHeaders(headers: NodeJS.Dict<string | string[] | undefined>): string {
    return normalizeHeaderValue(headers["x-client-request-id"]) ||
        normalizeHeaderValue(headers["x-request-id"]) ||
        newRequestId();
}

export function clientTraceIdFromHeaders(headers: NodeJS.Dict<string | string[] | undefined>): string {
    return normalizeHeaderValue(headers["x-client-trace-id"]) ||
        normalizeHeaderValue(headers["x-trace-id"]);
}

export function currentTraceContext(): RequestTraceContext | null {
    const spanContext = trace.getActiveSpan()?.spanContext();
    if (!spanContext?.traceId) return null;
    const traceId = spanContext.traceId;
    return contexts.get(traceId) || {
        traceId,
        requestId: newRequestId(),
        hostName,
    };
}

export function activeTraceHeaders(): Record<string, string> {
    const context = currentTraceContext();
    if (!context?.traceId) return {};
    return {
        [TRACE_ID_HEADER]: context.traceId,
        [REQUEST_ID_HEADER]: context.requestId,
        [HOST_NAME_HEADER]: context.hostName,
    };
}

export function appendActiveTraceHeaders(headers: Headers) {
    const values = activeTraceHeaders();
    for (const [key, value] of Object.entries(values)) {
        if (value && !headers.has(key)) {
            headers.set(key, value);
        }
    }
}
