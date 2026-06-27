import type { NextRequest } from "next/server";

export const MAX_TEXT_LENGTH = 2048;
export const MAX_ID_LENGTH = 128;
export const TRACE_ENV =
    process.env.TRACE_ENV ||
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.APP_ENV ||
    process.env.NODE_ENV ||
    "unknown";
export const ALLOW_DEV_TRACE = process.env.TRACE_ALLOW_DEV === "1";
export const API_TRACE_ENABLED = process.env.TRACE_ENABLE_API_TRACE === "1";

export function hasServiceRoleKey(): boolean {
    return Boolean(
        process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
            process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

/** 标准 UUID 格式：8-4-4-4-12 十六进制 */
const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 若 value 为合法 UUID 则返回，否则返回 null（用于写入要求 uuid 的列，避免 openid 等短 id 导致 22P02） */
export function asUuidOrNull(value: unknown): string | null {
    if (typeof value !== "string" || value.length === 0) return null;
    return UUID_REGEX.test(value) ? value : null;
}

export function safeText(value: unknown, maxLength: number): string | null {
    if (typeof value !== "string" || value.length === 0) return null;
    return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export function shouldSkipTrace(req: NextRequest): boolean {
    const pathname = req.nextUrl.pathname;
    if (
        pathname === "/api/healthy" ||
        pathname === "/api/health" ||
        pathname === "/api/system/version" ||
        pathname === "/api/public/version"
    ) {
        return true;
    }

    const hostname = req.headers.get("host") || "";
    const isLocal =
        hostname.includes("localhost") ||
        hostname.includes("127.0.0.1") ||
        hostname.includes("::1");
    return !ALLOW_DEV_TRACE && (TRACE_ENV !== "production" || isLocal);
}
