import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { Database } from "@/types/database.types";
import type {
    AdminCanonicalActionItem,
    CanonicalActionMediaStatus,
    ListAdminCanonicalActionsResponseDto,
    UpdateAdminCanonicalActionDto,
    UpdateAdminCanonicalActionResponseDto,
} from "./entity";

type CanonicalActionRow = Database["public"]["Tables"]["canonical_actions"]["Row"];
const AUDIT_STATUSES = new Set(["unreviewed", "rejected", "approved"]);

function normalizeAuditStatus(value: unknown): CanonicalActionRow["reference_image_audit_status"] {
    return typeof value === "string" && AUDIT_STATUSES.has(value) ? value : "unreviewed";
}

function requireAdmin(session: Awaited<ReturnType<typeof getServerSession>>) {
    if (!session?.user?.id) return { ok: false as const, status: 401, message: "未登录" };
    if (!(session.user as { is_admin?: boolean })?.is_admin) {
        return { ok: false as const, status: 403, message: "无权限" };
    }
    return { ok: true as const };
}

function hasMedia(value: string | null | undefined) {
    return Boolean(value && value.trim());
}

function toItem(row: CanonicalActionRow): AdminCanonicalActionItem {
    const referenceImageUrl = row.reference_image_url ?? null;
    const referenceAnimationUrl = row.reference_animation_url ?? null;
    return {
        id: row.id,
        name: row.name,
        aliases: row.aliases ?? [],
        category: row.category ?? null,
        reference_image_url: referenceImageUrl,
        reference_image_audit_status: normalizeAuditStatus(row.reference_image_audit_status),
        reference_gif_url: row.reference_gif_url ?? null,
        reference_animation_url: referenceAnimationUrl,
        reference_animation_audit_status: normalizeAuditStatus(row.reference_animation_audit_status),
        created_at: row.created_at ?? "",
        has_reference_image: hasMedia(referenceImageUrl),
        has_reference_animation: hasMedia(referenceAnimationUrl),
    };
}

function matchesMediaStatus(item: AdminCanonicalActionItem, status: CanonicalActionMediaStatus) {
    if (status === "all") return true;
    if (status === "missing_image") return !item.has_reference_image;
    if (status === "missing_animation") return !item.has_reference_animation;
    if (status === "missing_any") return !item.has_reference_image || !item.has_reference_animation;
    if (status === "complete") return item.has_reference_image && item.has_reference_animation;
    return true;
}

export async function GET(req: Request) {
    const session = await getServerSession();
    const auth = requireAdmin(session);
    if (!auth.ok) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: auth.message, data: null },
            { status: auth.status },
        );
    }

    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
    const search = (url.searchParams.get("search") || "").trim();
    const category = (url.searchParams.get("category") || "").trim();
    const mediaStatus = ((url.searchParams.get("mediaStatus") || "all") as CanonicalActionMediaStatus);

    let query = serviceRoleSupabase
        .from("canonical_actions")
        .select("*")
        .order("name", { ascending: true });

    if (category) query = query.eq("category", category);
    if (search) {
        const escaped = search.replace(/[%_]/g, "\\$&");
        query = query.or(`id.ilike.%${escaped}%,name.ilike.%${escaped}%`);
    }

    const { data, error } = await query;
    if (error) {
        console.error("[admin/canonical-actions] list error:", error);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: error.message, data: null },
            { status: 500 },
        );
    }

    const allItems = ((data || []) as CanonicalActionRow[]).map(toItem);
    const filtered = allItems.filter((item) => matchesMediaStatus(item, mediaStatus));
    const from = (page - 1) * limit;
    const actions = filtered.slice(from, from + limit);
    const categories = Array.from(new Set(allItems.map((item) => item.category).filter((x): x is string => Boolean(x)))).sort();
    const summarySource = allItems;

    return NextResponse.json<ApiData<ListAdminCanonicalActionsResponseDto>>({
        success: true,
        message: "ok",
        data: {
            actions,
            total: filtered.length,
            page,
            limit,
            categories,
            summary: {
                total: summarySource.length,
                withImage: summarySource.filter((item) => item.has_reference_image).length,
                withAnimation: summarySource.filter((item) => item.has_reference_animation).length,
                missingImage: summarySource.filter((item) => !item.has_reference_image).length,
                missingAnimation: summarySource.filter((item) => !item.has_reference_animation).length,
            },
        },
    });
}

export async function PATCH(req: Request) {
    const session = await getServerSession();
    const auth = requireAdmin(session);
    if (!auth.ok) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: auth.message, data: null },
            { status: auth.status },
        );
    }

    const body = (await req.json().catch(() => ({}))) as UpdateAdminCanonicalActionDto;
    const id = (body.id || "").trim();
    if (!id) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "缺少标准动作 ID", data: null },
            { status: 400 },
        );
    }

    const { data: existingRow, error: existingError } = await serviceRoleSupabase
        .from("canonical_actions")
        .select("*")
        .eq("id", id)
        .single();

    if (existingError || !existingRow) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: existingError?.message || "标准动作不存在", data: null },
            { status: existingError?.code === "PGRST116" ? 404 : 500 },
        );
    }

    const patch: Partial<Pick<CanonicalActionRow,
        | "reference_image_url"
        | "reference_image_audit_status"
        | "reference_animation_url"
        | "reference_animation_audit_status"
    >> = {};

    let imageUrlExplicitlyChanged = false;
    let animationUrlExplicitlyChanged = false;

    if ("reference_image_url" in body) {
        patch.reference_image_url = typeof body.reference_image_url === "string"
            ? body.reference_image_url.trim() || null
            : body.reference_image_url ?? null;
        imageUrlExplicitlyChanged = (patch.reference_image_url ?? null) !== (existingRow.reference_image_url ?? null);
    }
    if ("reference_image_audit_status" in body) {
        patch.reference_image_audit_status = normalizeAuditStatus(body.reference_image_audit_status);
    }
    if ("reference_animation_url" in body) {
        patch.reference_animation_url = typeof body.reference_animation_url === "string"
            ? body.reference_animation_url.trim() || null
            : body.reference_animation_url ?? null;
        animationUrlExplicitlyChanged = (patch.reference_animation_url ?? null) !== (existingRow.reference_animation_url ?? null);
    }
    if ("reference_animation_audit_status" in body) {
        patch.reference_animation_audit_status = normalizeAuditStatus(body.reference_animation_audit_status);
    }

    if (imageUrlExplicitlyChanged && !("reference_image_audit_status" in body)) {
        patch.reference_image_audit_status = "unreviewed";
    }
    if (animationUrlExplicitlyChanged && !("reference_animation_audit_status" in body)) {
        patch.reference_animation_audit_status = "unreviewed";
    }
    if (Object.keys(patch).length === 0) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "没有可保存的字段", data: null },
            { status: 400 },
        );
    }

    const { data, error } = await serviceRoleSupabase
        .from("canonical_actions")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();

    if (error || !data) {
        console.error("[admin/canonical-actions] update error:", error);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: error?.message || "标准动作不存在", data: null },
            { status: error?.code === "PGRST116" ? 404 : 500 },
        );
    }

    return NextResponse.json<ApiData<UpdateAdminCanonicalActionResponseDto>>({
        success: true,
        message: "保存成功",
        data: { action: toItem(data as CanonicalActionRow) },
    });
}
