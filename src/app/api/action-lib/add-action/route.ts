import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import type { AddActionDto, AddActionResponseDto } from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import {
    buildCanonicalLookup,
    resolveCanonicalActionId,
} from "@/lib/canonicalActionResolver";
import { normalizeActionNameForMatch } from "@/lib/planImportText";

export async function POST(req: Request) {
    const addData = await req.json() as AddActionDto;

    // Check if user is logged in and has coach role
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    // 基础字段验证
    if (!addData.name || !addData.name.trim()) {
        return NextResponse.json({
            success: false,
            message: "缺少必要参数（name 为必填项）",
        }, { status: 400 });
    }

    // 对于力量训练类型，positions 是必需的
    const itemType = (addData as any).type;
    // 只有明确是 STRENGTH 或未指定类型时才验证 positions
    const needsPositions = !itemType || itemType === "STRENGTH";
    const fallbackPositions = needsPositions && !addData.positions?.length
        ? ["其他"]
        : addData.positions;

    if (!session.user.is_coach) {
        return NextResponse.json({
            success: false,
            message: "Forbidden",
        }, { status: 403 });
    }

    const { data: canonicalActions, error: canonicalError } = await supabase
        .from("canonical_actions")
        .select("id,name,aliases");
    if (canonicalError) {
        return NextResponse.json({
            success: false,
            message: "获取 canonical 动作库失败",
            data: null,
        }, { status: 500 });
    }

    const canonicalLookup = buildCanonicalLookup((canonicalActions as any[]) || []);
    const canonicalResolved = resolveCanonicalActionId(canonicalLookup, {
        actionName: addData.name,
        providedCanonicalId: (addData as any).canonical_action_id,
        requireCanonical: true,
    });
    let canonicalActionId = canonicalResolved.canonicalActionId;
    if (canonicalResolved.reason === "not_found") {
        const generatedCanonicalId = `custom_${crypto.randomUUID()}`;
        const { error: createCanonicalError } = await supabase
            .from("canonical_actions")
            .insert({
                id: generatedCanonicalId,
                name: addData.name.trim(),
                aliases: [],
                category: null,
                created_at: new Date().toISOString(),
            } as any);
        if (createCanonicalError) {
            return NextResponse.json({
                success: false,
                message: `创建 canonical 动作失败: ${createCanonicalError.message}`,
                data: null,
            }, { status: 500 });
        }
        canonicalActionId = generatedCanonicalId;
    }
    if (canonicalResolved.reason && canonicalResolved.reason !== "not_found") {
        return NextResponse.json({
            success: false,
            message: canonicalResolved.errorMessage,
            data: null,
        }, { status: 400 });
    }

    const normalizedName = normalizeActionNameForMatch(addData.name);
    const { data: existingAction, error: existingError } = await supabase
        .from("coach_actions")
        .select("id,name,canonical_action_id")
        .eq("coach_id", userId);
    if (existingError) {
        return NextResponse.json({
            success: false,
            message: "校验动作重复失败",
            data: null,
        }, { status: 500 });
    }
    const hasDuplicate = (existingAction || []).some((row: any) => {
        const sameCanonical = Boolean(canonicalActionId) &&
            row.canonical_action_id === canonicalActionId;
        const sameName = normalizeActionNameForMatch(row.name || "") === normalizedName;
        return sameCanonical || sameName;
    });
    if (hasDuplicate) {
        return NextResponse.json({
            success: false,
            message: "动作已存在（canonical 或名称重复）",
            data: null,
        }, { status: 409 });
    }

    // Insert new action
    const { data: action, error } = await supabase
        .from("coach_actions")
        .insert({
            coach_id: userId,
            ...addData,
            canonical_action_id: canonicalActionId,
            name: addData.name.trim(),
            detail: addData.detail?.trim() || null,
            positions: fallbackPositions ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
        console.error("Error adding action:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to add action",
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<AddActionResponseDto>>({
        success: true,
        message: "添加动作成功",
        data: {
            action,
        },
    });
}
