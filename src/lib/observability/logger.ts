import util from "node:util";
import { context, SpanStatusCode, trace, type Attributes } from "@opentelemetry/api";
import { recordLog, recordOperation } from "./metrics";
import { currentTraceContext } from "./requestContext";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

type ConsoleMethod = "debug" | "log" | "info" | "warn" | "error";

type OriginalConsole = Partial<Record<ConsoleMethod, (...args: unknown[]) => void>>;

declare global {
    // eslint-disable-next-line no-var
    var __coachlinkConsolePatched: boolean | undefined;
    // eslint-disable-next-line no-var
    var __coachlinkOriginalConsole: OriginalConsole | undefined;
}

function originalConsole(): OriginalConsole {
    if (!globalThis.__coachlinkOriginalConsole) {
        globalThis.__coachlinkOriginalConsole = {
            debug: console.debug.bind(console),
            log: console.log.bind(console),
            info: console.info.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
        };
    }
    return globalThis.__coachlinkOriginalConsole;
}

function severityForMethod(method: ConsoleMethod): LogLevel {
    if (method === "error") return "error";
    if (method === "warn") return "warn";
    if (method === "debug") return "debug";
    return "info";
}

function messageFromArgs(args: unknown[]): string {
    return args
        .map((arg) => {
            if (arg instanceof Error) return arg.message;
            if (typeof arg === "string") return arg;
            return util.inspect(arg, { depth: 4, breakLength: 120 });
        })
        .join(" ")
        .slice(0, 2000);
}

function normalizeAttrValue(value: unknown): string | number | boolean | string[] | number[] | boolean[] {
    if (typeof value === "string") return value.slice(0, 2000);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    if (Array.isArray(value)) {
        const simple = value.filter((item) =>
            typeof item === "string" ||
            (typeof item === "number" && Number.isFinite(item)) ||
            typeof item === "boolean",
        );
        if (simple.length === value.length) {
            return simple as string[] | number[] | boolean[];
        }
    }
    if (value instanceof Error) return value.message.slice(0, 2000);
    try {
        return JSON.stringify(value).slice(0, 2000);
    } catch {
        return String(value).slice(0, 2000);
    }
}

function attrsFromFields(fields?: LogFields): Attributes {
    if (!fields) return {};
    const out: Attributes = {};
    for (const [key, value] of Object.entries(fields)) {
        if (!key || value == null) continue;
        out[key] = normalizeAttrValue(value);
    }
    return out;
}

function addLogEvent(level: LogLevel, message: string, fields?: LogFields, error?: unknown) {
    const span = trace.getSpan(context.active());
    if (!span?.spanContext().traceId || !span.isRecording()) return;

    const attrs: Attributes = {
        "log.severity": level,
        "log.message": message,
        ...attrsFromFields(fields),
    };
    if (error instanceof Error) {
        attrs["exception.message"] = error.message;
        attrs["exception.type"] = error.name;
        if (error.stack) attrs["exception.stacktrace"] = error.stack.slice(0, 4000);
        span.recordException(error);
    }
    span.addEvent(message || "日志", attrs);
    if (level === "error") {
        span.setStatus({ code: SpanStatusCode.ERROR, message: message || "error" });
    }
}

function writeStructuredLog(level: LogLevel, message: string, fields?: LogFields, error?: unknown) {
    recordLog(level);
    addLogEvent(level, message, fields, error);

    const traceContext = currentTraceContext();
    const record: LogFields = {
        time: new Date().toISOString(),
        level,
        message,
        ...fields,
    };
    if (traceContext?.traceId) record.trace_id = traceContext.traceId;
    if (traceContext?.requestId) record.request_id = traceContext.requestId;
    if (traceContext?.hostName) record.host_name = traceContext.hostName;
    if (error instanceof Error) {
        record.error = error.message;
        record.error_name = error.name;
        if (error.stack) record.error_stack = error.stack;
    }

    const writer = originalConsole()[level === "debug" ? "debug" : level === "info" ? "info" : level] ||
        originalConsole().log;
    writer?.(JSON.stringify(record));
}

export function logDebug(message: string, fields?: LogFields) {
    writeStructuredLog("debug", message, fields);
}

export function logInfo(message: string, fields?: LogFields) {
    writeStructuredLog("info", message, fields);
}

export function logWarn(message: string, fields?: LogFields) {
    writeStructuredLog("warn", message, fields);
}

export function logError(message: string, error?: unknown, fields?: LogFields) {
    writeStructuredLog("error", message, fields, error);
}

export async function withOperation<T>(
    name: string,
    fields: LogFields,
    fn: () => Promise<T>,
): Promise<T> {
    const start = Date.now();
    logInfo(`${name}开始`, fields);
    try {
        const result = await fn();
        const durationMs = Date.now() - start;
        recordOperation(name, "success", durationMs);
        logInfo(`${name}完成`, { ...fields, duration_ms: durationMs });
        return result;
    } catch (error) {
        const durationMs = Date.now() - start;
        recordOperation(name, "error", durationMs);
        logError(`${name}失败`, error, { ...fields, duration_ms: durationMs });
        throw error;
    }
}

export function installConsoleLogCorrelation() {
    if (globalThis.__coachlinkConsolePatched) return;
    const originals = originalConsole();
    globalThis.__coachlinkConsolePatched = true;

    (["debug", "log", "info", "warn", "error"] as ConsoleMethod[]).forEach((method) => {
        const level = severityForMethod(method);
        console[method] = (...args: unknown[]) => {
            const message = messageFromArgs(args);
            const error = args.find((arg) => arg instanceof Error);
            writeStructuredLog(level, message, { console_method: method }, error);
        };
    });

    originals.info?.(JSON.stringify({
        time: new Date().toISOString(),
        level: "info",
        message: "CoachLink 结构化日志与 trace 事件关联已启用",
    }));
}
