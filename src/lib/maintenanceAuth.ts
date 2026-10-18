import { timingSafeEqual } from "node:crypto";

/** The job-specific secret, falling back to the shared CRON_SECRET; empty when neither is set. */
export function getMaintenanceSecret(envName: string) {
    return String(process.env[envName] || "").trim() || String(process.env.CRON_SECRET || "").trim();
}

/** Accepts `x-cron-secret: <secret>` or `Authorization: Bearer <secret>`. */
export function hasValidMaintenanceSecret(request: Request, envName: string) {
    const expected = getMaintenanceSecret(envName);
    if (!expected) return false;
    const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    const provided = request.headers.get("x-cron-secret")?.trim() || bearer || "";
    const providedBytes = Buffer.from(provided);
    const expectedBytes = Buffer.from(expected);
    return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

/**
 * Manual triggers of site-wide maintenance jobs: a valid cron secret, or a
 * signed-in admin. Ordinary signed-in users are refused.
 */
export async function authorizeMaintenanceRequest(request: Request, envName: string) {
    if (hasValidMaintenanceSecret(request, envName)) return { ok: true as const };
    const { getServerSession } = await import("@/app/api/auth/[...nextauth]/auth");
    const session = await getServerSession();
    if (!session?.user?.id) return { ok: false as const, status: 401, message: "用户未登录" };
    if ((session.user as { is_admin?: boolean }).is_admin !== true) {
        return { ok: false as const, status: 403, message: "仅管理员可以手动运行订阅过期检查" };
    }
    return { ok: true as const };
}
