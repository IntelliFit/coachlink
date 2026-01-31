import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import type {
    MergeStudentActionsDto,
    MergeStudentActionsResponseDto,
} from "./entity";
import { replaceActionRefs } from "@/lib/actionRefs";

export async function POST(req: Request) {
    const {
        keepActionId,
        mergeActionIds,
        applyToInstances = true,
        deleteMerged = false,
    } = await req.json() as MergeStudentActionsDto;

    const session = await getServerSession();
    const userId = session?.user?.id || null;
    if (!userId) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "Unauthorized",
            data: null,
        }, { status: 401 });
    }

    const keep = typeof keepActionId === "string" ? keepActionId.trim() : "";
    const merges = Array.isArray(mergeActionIds)
        ? Array.from(new Set(mergeActionIds.filter((x) => typeof x === "string").map((x) => x.trim()).filter(Boolean)))
        : [];

    if (!keep || merges.length === 0) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "缺少必要参数",
            data: null,
        }, { status: 400 });
    }
    if (merges.includes(keep)) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "mergeActionIds 不能包含 keepActionId",
            data: null,
        }, { status: 400 });
    }

    // Validate ownership: all ids must exist in student_actions of this user
    const allIds = [keep, ...merges];
    const { data: ownedActions, error: ownedError } = await supabase
        .from("student_actions")
        .select("id")
        .eq("user_id", userId)
        .in("id", allIds);

    if (ownedError) {
        console.error("[student merge-actions] fetch actions error:", ownedError);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "Failed to validate actions",
            data: null,
        }, { status: 500 });
    }

    const ownedSet = new Set((ownedActions || []).map((a: any) => a.id));
    const missing = allIds.filter((id) => !ownedSet.has(id));
    if (missing.length > 0) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: `动作不存在或无权访问: ${missing.join(", ")}`,
            data: null,
        }, { status: 404 });
    }

    const replaceMap = new Map<string, string>();
    for (const id of merges) replaceMap.set(id, keep);

    let replacedCount = 0;
    let updatedInstances = 0;
    let deletedActions = 0;

    if (applyToInstances) {
        const { data: instances, error } = await supabase
            .from("coach_plan_instances")
            .select("id,training_days,student_id")
            .eq("student_id", userId);

        if (error) {
            console.error("[student merge-actions] instances error:", error);
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "Failed to fetch instances",
                data: null,
            }, { status: 500 });
        }

        for (const inst of instances || []) {
            const { trainingDays, replaced } = replaceActionRefs((inst as any).training_days, replaceMap);
            if (replaced <= 0) continue;
            replacedCount += replaced;

            const { error: updErr } = await supabase
                .from("coach_plan_instances")
                .update({ training_days: trainingDays, updated_at: new Date().toISOString() })
                .eq("id", (inst as any).id)
                .eq("student_id", userId);

            if (updErr) {
                console.error("[student merge-actions] update instance error:", updErr);
                return NextResponse.json<ApiData<null>>({
                    success: false,
                    message: "Failed to update instances",
                    data: null,
                }, { status: 500 });
            }
            updatedInstances += 1;
        }
    }

    if (deleteMerged) {
        const { error: delErr } = await supabase
            .from("student_actions")
            .delete()
            .eq("user_id", userId)
            .in("id", merges);

        if (delErr) {
            console.error("[student merge-actions] delete merged actions error:", delErr);
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "引用已修补，但删除重复动作失败（可手动删除）",
                data: null,
            }, { status: 500 });
        }
        deletedActions = merges.length;
    }

    return NextResponse.json<ApiData<MergeStudentActionsResponseDto>>({
        success: true,
        message: "合并成功",
        data: { replacedCount, updatedInstances, deletedActions },
    });
}

