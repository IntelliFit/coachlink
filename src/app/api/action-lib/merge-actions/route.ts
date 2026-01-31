import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import type { MergeActionsDto, MergeActionsResponseDto } from "./entity";
import { replaceActionRefs } from "@/lib/actionRefs";

export async function POST(req: Request) {
    const {
        keepActionId,
        mergeActionIds,
        applyToTemplates = true,
        applyToInstances = true,
        deleteMerged = false,
    } = await req.json() as MergeActionsDto;

    const session = await getServerSession();
    const userId = session?.user?.id || null;
    if (!userId) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "Unauthorized",
            data: null,
        }, { status: 401 });
    }
    if (!session.user.is_coach) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "Forbidden",
            data: null,
        }, { status: 403 });
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

    // Validate ownership: all ids must exist in coach_actions of this user
    const allIds = [keep, ...merges];
    const { data: ownedActions, error: ownedError } = await supabase
        .from("coach_actions")
        .select("id")
        .eq("coach_id", userId)
        .in("id", allIds);

    if (ownedError) {
        console.error("[merge-actions] fetch actions error:", ownedError);
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
    let updatedTemplates = 0;
    let updatedInstances = 0;
    let deletedActions = 0;

    // Update templates
    if (applyToTemplates) {
        const { data: templates, error: templatesError } = await supabase
            .from("coach_plan_templates")
            .select("id,training_days")
            .eq("coach_id", userId);

        if (templatesError) {
            console.error("[merge-actions] templates error:", templatesError);
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "Failed to fetch templates",
                data: null,
            }, { status: 500 });
        }

        for (const t of templates || []) {
            const { trainingDays, replaced } = replaceActionRefs((t as any).training_days, replaceMap);
            if (replaced <= 0) continue;
            replacedCount += replaced;

            const { error: updErr } = await supabase
                .from("coach_plan_templates")
                .update({ training_days: trainingDays, updated_at: new Date().toISOString() })
                .eq("id", (t as any).id)
                .eq("coach_id", userId);

            if (updErr) {
                console.error("[merge-actions] update template error:", updErr);
                return NextResponse.json<ApiData<null>>({
                    success: false,
                    message: "Failed to update templates",
                    data: null,
                }, { status: 500 });
            }
            updatedTemplates += 1;
        }
    }

    // Update instances
    if (applyToInstances) {
        const { data: coachRow } = await supabase
            .from("coaches")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

        if (coachRow?.id) {
            const { data: instances, error: instancesError } = await supabase
                .from("coach_plan_instances")
                .select("id,training_days")
                .eq("coach_id", coachRow.id);

            if (instancesError) {
                console.error("[merge-actions] instances error:", instancesError);
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
                    .eq("id", (inst as any).id);

                if (updErr) {
                    console.error("[merge-actions] update instance error:", updErr);
                    return NextResponse.json<ApiData<null>>({
                        success: false,
                        message: "Failed to update instances",
                        data: null,
                    }, { status: 500 });
                }
                updatedInstances += 1;
            }
        }
    }

    // Delete merged actions only after successful updates
    if (deleteMerged) {
        const { error: delErr } = await supabase
            .from("coach_actions")
            .delete()
            .eq("coach_id", userId)
            .in("id", merges);

        if (delErr) {
            console.error("[merge-actions] delete merged actions error:", delErr);
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "引用已修补，但删除重复动作失败（可手动删除）",
                data: null,
            }, { status: 500 });
        }
        deletedActions = merges.length;
    }

    return NextResponse.json<ApiData<MergeActionsResponseDto>>({
        success: true,
        message: "合并成功",
        data: {
            replacedCount,
            updatedTemplates,
            updatedInstances,
            deletedActions,
        },
    });
}

