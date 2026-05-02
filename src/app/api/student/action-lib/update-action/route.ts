import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    UpdateStudentActionDto,
    UpdateStudentActionResponseDto,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { StudentActionRow } from "@/types/student";
import { isOneRMEligibleAction } from "@/lib/oneRmEligibility";

function extractVideoStoragePath(url?: string | null) {
    if (!url) return null;
    const storageUrl = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL || "";
    if (!storageUrl || !url.includes(storageUrl)) return null;
    const parts = url.split("/videos/");
    if (parts.length !== 2) return null;
    return parts[1].split("?")[0] || null;
}

export async function POST(req: Request) {
    const { id, ...updateData } = await req.json() as UpdateStudentActionDto;

    const session = await getServerSession();
    const userId = session?.user?.id || null;

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

    const { data: existingAction } = await supabase
        .from("student_actions")
        .select("type, attrs, \"enableAutoWeightCompute\", url")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();

    if (!existingAction) {
        return NextResponse.json({
            success: false,
            message: "动作不存在或无权访问",
        }, { status: 404 });
    }

    const nextType = updateData.type;
    const sanitizedUpdateData: Record<string, unknown> = { ...updateData };

    if (nextType && nextType !== "STRENGTH") {
        sanitizedUpdateData.positions = null;
        sanitizedUpdateData.attrs = null;
        sanitizedUpdateData.enableAutoWeightCompute = false;
        sanitizedUpdateData.includesBodyWeight = false;
        sanitizedUpdateData.reference_1rm = null;
        sanitizedUpdateData.canonical_action_id = null;
        sanitizedUpdateData.suggested_time = nextType === "DIET"
            ? ((updateData as any).suggested_time || null)
            : null;
    } else if (nextType === "STRENGTH") {
        sanitizedUpdateData.suggested_time = null;
        if (!(updateData.enableAutoWeightCompute || false)) {
            sanitizedUpdateData.includesBodyWeight = false;
        }
    }

    const needsOneRMSanitization = (
        "reference_1rm" in updateData ||
        "type" in updateData ||
        "attrs" in updateData ||
        "enableAutoWeightCompute" in updateData
    );

    if (needsOneRMSanitization) {
        const candidateType = (sanitizedUpdateData.type as string | undefined)
            ?? (existingAction?.type as string | undefined)
            ?? "STRENGTH";
        const candidateAttrs = (sanitizedUpdateData.attrs as string[] | null | undefined)
            ?? ((existingAction?.attrs as string[] | null | undefined) ?? null);
        const candidateAuto = (sanitizedUpdateData.enableAutoWeightCompute as boolean | undefined)
            ?? ((existingAction as any)?.enableAutoWeightCompute as boolean | undefined)
            ?? false;

        const eligible = isOneRMEligibleAction({
            type: candidateType,
            attrs: candidateAttrs || undefined,
            enableAutoWeightCompute: candidateAuto,
        });

        if (!eligible) {
            sanitizedUpdateData.reference_1rm = null;
        } else if ("reference_1rm" in sanitizedUpdateData) {
            const value = sanitizedUpdateData.reference_1rm;
            if (!(typeof value === "number" && Number.isFinite(value))) {
                sanitizedUpdateData.reference_1rm = null;
            }
        }
    }

    const previousUrl = typeof (existingAction as any)?.url === "string"
        ? String((existingAction as any).url)
        : "";
    const nextUrlValue = Object.prototype.hasOwnProperty.call(sanitizedUpdateData, "url")
        ? sanitizedUpdateData.url
        : previousUrl;
    const nextUrl = typeof nextUrlValue === "string" ? nextUrlValue : "";
    const previousStoragePath = extractVideoStoragePath(previousUrl);

    if (previousStoragePath && previousUrl !== nextUrl) {
        const { error: storageError } = await supabase.storage
            .from("videos")
            .remove([previousStoragePath]);
        if (storageError) {
            console.error("Error removing previous student action demo video:", storageError);
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
