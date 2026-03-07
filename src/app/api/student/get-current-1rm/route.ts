import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { Current1RMRecord, GetCurrent1RMDto, GetCurrent1RMResponseDto } from "./entity";
import { isOneRMEligibleAction } from "@/lib/oneRmEligibility";

/**
 * 核心业务函数：获取并聚合用户的 1RM 记录
 */
export async function getCurrent1RMRecords(
    currentUserId: string,
    params: {
        actionIds?: string[];
        actionNames?: string[];
        targetUserId?: string;
        preferPR?: boolean;
    }
) {
    const { actionIds, actionNames, targetUserId, preferPR = false } = params;
    let queryUserId = currentUserId;

    // 1. 权限校验：如果是查询他人数据
    if (targetUserId && targetUserId !== currentUserId) {
        // 联合查询：检查当前用户是否为该学员的教练
        const { data: isCoach } = await supabase
            .from("coach_subscriptions")
            .select(`
        id,
        coaches!inner(user_id)
      `)
            .eq("coaches.user_id", currentUserId)
            .eq("student_id", targetUserId)
            .maybeSingle();

        if (isCoach) {
            queryUserId = targetUserId;
        } else {
            console.warn(`Unauthorized access attempt by ${currentUserId} to ${targetUserId}`);
            // 如果没有权限，默认查回自己，或者可以直接抛出错误
        }
    }

    // 2. 并行获取 PR 历史、动作库基线和问卷兜底数据
    const prQuery = supabase
        .from("personal_records_history")
        .select("action_id, exercise_name, e1rm, date_achieved, created_at, is_auto_calculated, notes")
        .eq("user_id", queryUserId)
        .not("e1rm", "is", null)
        // For "current state", we want the latest record, not the max.
        .order("date_achieved", { ascending: false })
        .order("created_at", { ascending: false });

    if (actionIds?.length) prQuery.in("action_id", actionIds);
    if (actionNames?.length) prQuery.in("exercise_name", actionNames);

    let studentActionsQuery = supabase
        .from("student_actions")
        .select('id, name, reference_1rm, type, attrs, "enableAutoWeightCompute", updated_at')
        .eq("user_id", queryUserId)
        .not("reference_1rm", "is", null);
    if (actionIds?.length) {
        studentActionsQuery = studentActionsQuery.in("id", actionIds);
    } else if (actionNames?.length) {
        studentActionsQuery = studentActionsQuery.in("name", actionNames);
    }

    const [prResult, studentActionsResult, questionnaireResult] = await Promise.all([
        prQuery,
        studentActionsQuery,
        supabase
            .from("coach_subscriptions")
            .select("subscribe_data, updated_at")
            .eq("student_id", queryUserId)
            .eq("status", "active")
            .maybeSingle()
    ]);

    if (prResult.error) throw prResult.error;

    // 3. 解析学员动作库中的全局参考1RM（主来源）
    const actionLibraryRMMap: Record<string, { value: number; updatedAt?: string }> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (studentActionsResult.data || []).forEach((action: any) => {
        const rm = Number(action.reference_1rm);
        if (!Number.isFinite(rm) || rm <= 0) return;
        if (!isOneRMEligibleAction({
            type: action.type,
            attrs: action.attrs,
            enableAutoWeightCompute: action.enableAutoWeightCompute,
        })) {
            return;
        }

        const payload = { value: rm, updatedAt: action.updated_at as string | undefined };
        if (action.id) actionLibraryRMMap[action.id] = payload;
        if (action.name) actionLibraryRMMap[action.name] = payload;
    });

    // 4. 解析问卷中的 RM 数据（短期兼容兜底）
    const questionnaireRMMap: Record<string, number> = {};
    const subscribeData = questionnaireResult.data?.subscribe_data as any[];
    const rmItem = subscribeData?.find(item => item.type === "rm");
    const questionnaireUpdatedAtIso =
        (questionnaireResult.data as any)?.updated_at as string | undefined;

    if (rmItem?.userInputs) {
        Object.entries(rmItem.userInputs).forEach(([id, val]) => {
            if (typeof val === "number" && val > 0) questionnaireRMMap[id] = val;
        });
    }

    // 5. 数据聚合 (PR/AUTO_STATE + 动作库基线 + 问卷兜底)
    // Strategy:
    // - preferPR=true: use PR-oriented records (exclude AUTO_STATE, pick strongest historical value).
    // - preferPR=false: prefer latest AUTO_STATE; fallback to latest non-state record.
    // - If no record exists for an action, initialize from questionnaire RM (if present).
    const stateMap = new Map<string, Current1RMRecord>();
    const latestMap = new Map<string, Current1RMRecord>();
    const prMap = new Map<string, Current1RMRecord>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prResult.data || []).forEach((record: any) => {
        const key = record.action_id || record.exercise_name;
        if (!key) return;

        const item: Current1RMRecord = {
            actionId: record.action_id,
            actionName: record.exercise_name,
            current1RM: record.e1rm,
            lastUpdated: record.date_achieved || record.created_at || new Date().toISOString(),
            isAutoCalculated: !!record.is_auto_calculated,
        };

        if (preferPR) {
            // PR mode: ignore AUTO_STATE snapshots and keep the strongest record.
            if (record.notes === "AUTO_STATE") return;
            const existing = prMap.get(key);
            if (
                !existing ||
                Number(item.current1RM) > Number(existing.current1RM) ||
                (
                    Number(item.current1RM) === Number(existing.current1RM) &&
                    new Date(item.lastUpdated).getTime() > new Date(existing.lastUpdated).getTime()
                )
            ) {
                prMap.set(key, item);
            }
            return;
        }

        // State mode: prefer latest AUTO_STATE (query is ordered desc, first hit is latest)
        if (record.notes === "AUTO_STATE") {
            if (!stateMap.has(key)) stateMap.set(key, item);
        } else {
            if (!latestMap.has(key)) latestMap.set(key, item);
        }
    });

    const recordsMap = new Map<string, Current1RMRecord>();
    if (preferPR) {
        for (const [k, v] of prMap.entries()) recordsMap.set(k, v);
    } else {
        // Merge: state overrides latest for the same key
        for (const [k, v] of latestMap.entries()) recordsMap.set(k, v);
        for (const [k, v] of stateMap.entries()) recordsMap.set(k, v);
    }

    // 先合并动作库基线（主来源）：仅在没有历史记录时初始化
    Object.entries(actionLibraryRMMap).forEach(([key, payload]) => {
        const existing = recordsMap.get(key);
        if (!existing) {
            recordsMap.set(key, {
                actionId: key,
                actionName: key,
                current1RM: payload.value,
                lastUpdated: payload.updatedAt || new Date().toISOString(),
                isAutoCalculated: false,
            });
        }
    });

    // 再合并问卷兜底：仅在动作库与历史都缺失时初始化（不再反向覆盖当前值）
    Object.entries(questionnaireRMMap).forEach(([id, rmValue]) => {
        const existing = recordsMap.get(id);
        if (!existing) {
            recordsMap.set(id, {
                actionId: id,
                actionName: id,
                current1RM: rmValue,
                lastUpdated: questionnaireUpdatedAtIso || new Date().toISOString(),
                isAutoCalculated: false,
            });
        }
    });

    return Array.from(recordsMap.values());
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
    }

    const body = await request.json();

    // 调用封装好的函数
    const records = await getCurrent1RMRecords(session.user.id, body);

    return NextResponse.json<ApiData<GetCurrent1RMResponseDto>>({
        success: true,
        message: "获取成功",
        data: { records },
    });
}