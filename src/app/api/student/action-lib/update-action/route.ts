import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    UpdateStudentActionDto,
    UpdateStudentActionResponseDto,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getApiUserId } from "@/lib/getApiUserId";
import type { StudentActionRow } from "@/types/student";
import { isOneRMEligibleAction } from "@/lib/oneRmEligibility";

export async function POST(req: Request) {
    const { id, ...updateData } = await req.json() as UpdateStudentActionDto;

    // 检查用户登录
    const userId = await getApiUserId(req);

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    if (!id) {
        return NextResponse.json({
            success: false,
            message: "缺少动作ID",
        }, { status: 400 });
    }

    // 更新动作（确保只能更新自己的动作）
    console.log("[API] update-action data:", updateData);
    const nextType = updateData.type;
    const sanitizedUpdateData: Record<string, unknown> = { ...updateData };
    // 当明确传入 type 时，按类型纠正/清理不相关字段，避免脏数据残留
    if (nextType && nextType !== "STRENGTH") {
        sanitizedUpdateData.positions = null;
        sanitizedUpdateData.attrs = null;
        sanitizedUpdateData.enableAutoWeightCompute = false;
        sanitizedUpdateData.includesBodyWeight = false;
        sanitizedUpdateData.reference_1rm = null;
        sanitizedUpdateData.canonical_action_id = null;
        sanitizedUpdateData.suggested_time = nextType === "DIET" ? ((updateData as any).suggested_time || null) : null;
    } else if (nextType && nextType === "STRENGTH") {
        // 力量训练不使用 suggested_time
        sanitizedUpdateData.suggested_time = null;
        // includesBodyWeight 只有在启用自动计算时才有意义
        if (!(updateData.enableAutoWeightCompute || false)) {
            sanitizedUpdateData.includesBodyWeight = false;
        }
    }

    // 1RM 仅对资格动作生效，非资格动作统一置空避免脏数据残留。
    // 当请求未显式携带 type/attrs/enableAutoWeightCompute 时，需要读取旧值参与判定。
    const needsOneRMSanitization = (
        "reference_1rm" in updateData ||
        "type" in updateData ||
        "attrs" in updateData ||
        "enableAutoWeightCompute" in updateData
    );
    if (needsOneRMSanitization) {
        const { data: existingAction } = await supabase
            .from("student_actions")
            .select("type, attrs, \"enableAutoWeightCompute\"")
            .eq("id", id)
            .eq("user_id", userId)
            .maybeSingle();

        const candidateType = (sanitizedUpdateData.type as string | undefined) ??
            (existingAction?.type as string | undefined) ??
            "STRENGTH";
        const candidateAttrs = (sanitizedUpdateData.attrs as string[] | null | undefined) ??
            ((existingAction?.attrs as string[] | null | undefined) ?? null);
        const candidateAuto = (sanitizedUpdateData.enableAutoWeightCompute as boolean | undefined) ??
            ((existingAction as any)?.enableAutoWeightCompute as boolean | undefined) ??
            false;

        const eligible = isOneRMEligibleAction({
            type: candidateType,
            attrs: candidateAttrs || undefined,
            enableAutoWeightCompute: candidateAuto,
        });

        if (!eligible) {
            sanitizedUpdateData.reference_1rm = null;
        } else if ("reference_1rm" in sanitizedUpdateData) {
            const v = sanitizedUpdateData.reference_1rm;
            if (!(typeof v === "number" && Number.isFinite(v))) {
                sanitizedUpdateData.reference_1rm = null;
            }
        }
    }

    const { data: action, error } = await supabase
        .from("student_actions")
        .update({
            ...sanitizedUpdateData,
            updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

    if (error) {
        console.error("Error updating student action:", error);
        return NextResponse.json({
            success: false,
            message: "更新动作失败",
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<UpdateStudentActionResponseDto>>({
        success: true,
        message: "更新动作成功",
        data: {
            action: action as unknown as StudentActionRow,
        },
    });
}
