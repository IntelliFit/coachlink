import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { Current1RMRecord, GetCurrent1RMDto, GetCurrent1RMResponseDto } from "./entity";

/**
 * 核心业务函数：获取并聚合用户的 1RM 记录
 */
export async function getCurrent1RMRecords(
    currentUserId: string,
    params: {
        actionIds?: string[];
        actionNames?: string[];
        targetUserId?: string;
    }
) {
    const { actionIds, actionNames, targetUserId } = params;
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

    // 2. 并行获取 PR 历史和问卷数据
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

    const [prResult, questionnaireResult] = await Promise.all([
        prQuery,
        supabase
            .from("coach_subscriptions")
            .select("subscribe_data, updated_at")
            .eq("student_id", queryUserId)
            .eq("status", "active")
            .maybeSingle()
    ]);

    if (prResult.error) throw prResult.error;

    // 3. 解析问卷中的 RM 数据
    const questionnaireRMMap: Record<string, number> = {};
    const subscribeData = questionnaireResult.data?.subscribe_data as any[];
    const rmItem = subscribeData?.find(item => item.type === "rm");
    const questionnaireUpdatedAtIso =
        (questionnaireResult.data as any)?.updated_at as string | undefined;
    const questionnaireUpdatedAtMs = questionnaireUpdatedAtIso
        ? new Date(questionnaireUpdatedAtIso).getTime()
        : 0;

    if (rmItem?.userInputs) {
        Object.entries(rmItem.userInputs).forEach(([id, val]) => {
            if (typeof val === "number" && val > 0) questionnaireRMMap[id] = val;
        });
    }

    // 4. 数据聚合 (聚合 PR 历史与问卷)
    // Strategy:
    // - Prefer latest "AUTO_STATE" snapshots (notes === "AUTO_STATE") when available.
    // - Otherwise fallback to latest record (by date_achieved desc).
    // - If no record exists for an action, initialize from questionnaire RM (if present).
    const stateMap = new Map<string, Current1RMRecord>();
    const latestMap = new Map<string, Current1RMRecord>();

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

        // Prefer latest AUTO_STATE (query is ordered desc, first hit is latest)
        if (record.notes === "AUTO_STATE") {
            if (!stateMap.has(key)) stateMap.set(key, item);
        } else {
            if (!latestMap.has(key)) latestMap.set(key, item);
        }
    });

    // Merge: state overrides latest for the same key
    const recordsMap = new Map<string, Current1RMRecord>();
    for (const [k, v] of latestMap.entries()) recordsMap.set(k, v);
    for (const [k, v] of stateMap.entries()) recordsMap.set(k, v);

    // 合并问卷数据
    // 规则（更符合直觉）：
    // - 如果该动作没有任何历史记录：用问卷值初始化
    // - 如果问卷更新时间晚于当前记录的 lastUpdated：用问卷值覆盖当前值（实现“更新问卷立即生效”）
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
            return;
        }

        const existingUpdatedMs = existing.lastUpdated
            ? new Date(existing.lastUpdated).getTime()
            : 0;
        if (questionnaireUpdatedAtMs && questionnaireUpdatedAtMs > existingUpdatedMs) {
            recordsMap.set(id, {
                ...existing,
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