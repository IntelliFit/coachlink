import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    AddStudentActionDto,
    AddStudentActionResponseDto,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ItemType, StudentActionRow } from "@/types/student";
import { isOneRMEligibleAction } from "@/lib/oneRmEligibility";
import {
    buildCanonicalLookup,
    resolveCanonicalActionId,
} from "@/lib/canonicalActionResolver";
import { normalizeActionNameForMatch } from "@/lib/planImportText";

export async function POST(req: Request) {
    const addData = await req.json() as AddStudentActionDto;
    console.log("[API] add-action data:", addData);

    // 检查用户登录
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    // 验证必要参数
    if (!addData.name) {
        return NextResponse.json({
            success: false,
            message: "请输入动作名称",
        }, { status: 400 });
    }

    const type: ItemType = addData.type || "STRENGTH";
    const attrs = type === "STRENGTH"
        ? (addData.attrs || ["组数", "次数", "强度", "休息时间"])
        : null;
    const enableAutoWeightCompute = type === "STRENGTH"
        ? (addData.enableAutoWeightCompute || false)
        : false;
    const includesBodyWeight = type === "STRENGTH" && enableAutoWeightCompute
        ? (addData.includesBodyWeight || false)
        : false;
    const requestedOneRM = typeof addData.reference_1rm === "number" &&
        Number.isFinite(addData.reference_1rm)
        ? addData.reference_1rm
        : null;
    const referenceOneRM = isOneRMEligibleAction({
        type,
        attrs: attrs || undefined,
        enableAutoWeightCompute,
    })
        ? requestedOneRM
        : null;

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

    const normalizedName = normalizeActionNameForMatch(addData.name || "");
    const { data: existingActions, error: existingError } = await supabase
        .from("student_actions")
        .select("id,name,canonical_action_id")
        .eq("user_id", userId);
    if (existingError) {
        return NextResponse.json({
            success: false,
            message: "校验动作重复失败",
            data: null,
        }, { status: 500 });
    }
    const duplicated = (existingActions || []).some((row: any) => {
        const sameCanonical = Boolean(canonicalActionId) &&
            row.canonical_action_id === canonicalActionId;
        const sameName = normalizeActionNameForMatch(row.name || "") === normalizedName;
        return sameCanonical || sameName;
    });
    if (duplicated) {
        return NextResponse.json({
            success: false,
            message: "动作已存在（canonical 或名称重复）",
            data: null,
        }, { status: 409 });
    }

    // 插入新动作
    const { data: action, error } = await supabase
        .from("student_actions")
        .insert({
            user_id: userId,
            name: addData.name,
            detail: addData.detail || null,
            // 非力量类型一般不需要部位/属性标签
            positions: type === "STRENGTH" ? (addData.positions || ["全身"]) : null,
            attrs,
            url: addData.url || null,
            type,
            // Supabase Database 类型中 jsonb 会被推断为 Json，需要做一次断言
            item_schema: (addData.item_schema as unknown as any) || null,
            suggested_time: type === "DIET" ? (addData.suggested_time || null) : null,
            enableAutoWeightCompute,
            includesBodyWeight,
            reference_1rm: referenceOneRM,
            canonical_action_id: canonicalActionId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
        console.error("Error adding student action:", error);
        return NextResponse.json({
            success: false,
            message: `添加动作失败: ${error.message}`,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<AddStudentActionResponseDto>>({
        success: true,
        message: "添加动作成功",
        data: {
            action: action as unknown as StudentActionRow,
        },
    });
}
