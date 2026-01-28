import fs from "node:fs/promises";
import * as fsSync from "node:fs";
import path from "node:path";

export const SMART_IMPORT_TRACE_HEADER = "x-smart-import-trace-id";

type WriteMode = "overwrite" | "skipIfExists";

export function isSmartImportTraceEnabled(): boolean {
    // Server-side gate. Default OFF.
    return process.env.SMART_IMPORT_TRACE === "1";
}

export function getSmartImportTraceIdFromHeaders(
    headers: Headers,
): string | null {
    const raw = headers.get(SMART_IMPORT_TRACE_HEADER);
    const trimmed = raw?.trim() || "";
    if (!trimmed) return null;
    return sanitizeTraceId(trimmed);
}

export function sanitizeTraceId(input: string): string | null {
    // Prevent path traversal; allow common uuid-ish and timestamp-ish ids.
    const s = (input || "").trim();
    if (!s) return null;
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(s)) return null;
    return s;
}

export function getTraceDirAbsolute(traceId: string): string {
    // Repo-relative, works in local/self-hosted only.
    // NOTE: In serverless environments, filesystem may be read-only.
    const root = getRepoRoot();
    return path.join(
        root,
        "docs",
        "智能导入计划",
        "cases-generated",
        traceId,
    );
}

let cachedRepoRoot: string | null = null;
function getRepoRoot(): string {
    if (cachedRepoRoot) return cachedRepoRoot;
    let dir = process.cwd();
    for (let i = 0; i < 20; i++) {
        if (fsSync.existsSync(path.join(dir, "package.json"))) {
            cachedRepoRoot = dir;
            return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    cachedRepoRoot = process.cwd();
    return cachedRepoRoot;
}

async function ensureDir(dir: string) {
    await fs.mkdir(dir, { recursive: true });
}

async function writeFileSafe(
    filePath: string,
    content: string,
    mode: WriteMode = "overwrite",
) {
    if (mode === "skipIfExists") {
        try {
            await fs.access(filePath);
            return;
        } catch {
            // continue
        }
    }
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, "utf8");
}

export async function writeTraceText(
    traceId: string,
    relativeName: string,
    text: string,
    mode: WriteMode = "overwrite",
) {
    const dir = getTraceDirAbsolute(traceId);
    const p = path.join(dir, relativeName);
    await writeFileSafe(p, text ?? "", mode);
}

export async function writeTraceJson(
    traceId: string,
    relativeName: string,
    data: unknown,
    mode: WriteMode = "overwrite",
) {
    const json = JSON.stringify(data ?? null, null, 2);
    await writeTraceText(traceId, relativeName, json + "\n", mode);
}

export async function writeTraceMetaOnce(
    traceId: string,
    meta: Record<string, unknown>,
) {
    await writeTraceJson(traceId, "meta.json", meta, "skipIfExists");
}

export async function tryTrace<T>(
    enabled: boolean,
    traceId: string | null,
    fn: (traceId: string) => Promise<T>,
): Promise<void> {
    if (!enabled) return;
    if (!traceId) return;
    try {
        await fn(traceId);
    } catch (err) {
        // Never break import flow due to tracing.
        console.warn("[smart-import-trace] write failed:", err);
    }
}

