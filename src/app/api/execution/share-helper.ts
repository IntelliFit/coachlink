import supabase from "@/lib/supabaseClient";
import { differenceInMinutes, endOfMonth, format, startOfMonth } from "date-fns";
import type { ShareInfoResponseDto } from "./entity";

const SHARE_SELECT_FIELDS = `
    id,
    instance_id,
    student_id,
    day_index,
    status,
    action_executions,
    total_sets,
    completed_sets,
    session_notes,
    started_at,
    completed_at,
    coach_plan_instances:instance_id (name)
`;

type ShareInfoResult = {
    status: number;
    body: ShareInfoResponseDto;
};

function normalizeActions(raw: any): any[] {
    if (Array.isArray(raw)) {
        return raw;
    }

    if (typeof raw === "string") {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn("Failed to parse action_executions JSON:", error);
            return [];
        }
    }

    return [];
}

function summarizeActions(actions: any[]) {
    let totalVolume = 0;
    const prRecords: Array<{ exerciseName: string; weight: number; reps: number }> = [];
    const simplifiedActions: Array<{
        actionName: string;
        setsCount: number;
        volume: number;
    }> = [];

    actions.forEach((action: any) => {
        const sets = Array.isArray(action?.sets) ? action.sets : [];
        let actionSetsCount = 0;
        let actionVolume = 0;

        sets.forEach((set: any) => {
            if (set?.status === "completed" || set?.completed_at) {
                actionSetsCount += 1;

                const weight = Number(set?.actual_weight) || 0;
                const reps = Number(set?.actual_reps) || 0;
                const volume = weight * reps;
                actionVolume += volume;
                totalVolume += volume;

                if (set?.is_pr) {
                    prRecords.push({
                        exerciseName: action?.action_name || action?.name || "未命名动作",
                        weight,
                        reps,
                    });
                }
            }
        });

        simplifiedActions.push({
            actionName: action?.action_name || action?.name || "未命名动作",
            setsCount: actionSetsCount,
            volume: actionVolume,
        });
    });

    return { totalVolume, prRecords, simplifiedActions };
}

export async function getProfile(studentId: string) {
    const { data } = await supabase
        .from("user_profiles")
        .select("nickname, avatar_url")
        .eq("user_id", studentId)
        .maybeSingle();

    return data;
}

async function getMonthlyTrainingDays(studentId: string, startDate: Date) {
    const monthStart = startOfMonth(startDate).toISOString();
    const monthEnd = endOfMonth(startDate).toISOString();

    const { data, error } = await supabase
        .from("plan_instance_executions")
        .select("started_at")
        .eq("student_id", studentId)
        .eq("status", "completed")
        .gte("started_at", monthStart)
        .lte("started_at", monthEnd);

    if (error) {
        console.error("加载当月训练天数失败:", error);
        return [] as string[];
    }

    return Array.from(
        new Set((data || []).map((ex) => format(new Date(ex.started_at), "yyyy-MM-dd"))),
    );
}

export async function buildShareInfo(
    executionId: string,
    userId: string,
): Promise<ShareInfoResult> {
    const { data: execution, error } = await supabase
        .from("plan_instance_executions")
        .select(SHARE_SELECT_FIELDS)
        .eq("id", executionId)
        .single();

    if (error || !execution) {
        return {
            status: 404,
            body: { success: false, message: "记录不存在" },
        };
    }

    if (execution.student_id !== userId) {
        return {
            status: 403,
            body: { success: false, message: "无权限" },
        };
    }

    const profile = await getProfile(execution.student_id);
    const actions = normalizeActions(execution.action_executions);
    const { totalVolume, prRecords } = summarizeActions(actions);

    const startDate = execution.started_at
        ? new Date(execution.started_at)
        : new Date();
    const completedDate = execution.completed_at
        ? new Date(execution.completed_at)
        : null;
    const durationMinutes = completedDate
        ? differenceInMinutes(completedDate, startDate)
        : 0;

    const monthlyTrainingDays = await getMonthlyTrainingDays(
        execution.student_id,
        startDate,
    );

    const planName = execution.coach_plan_instances?.name || "未知计划";

    return {
        status: 200,
        body: {
            success: true,
            data: {
                executionId: execution.id,
                shareToken: execution.share_token || execution.id,
                dayIndex: execution.day_index || execution.dayIndex || 0,
                planName,
                completedAt: execution.completed_at,
                totalVolume,
                totalSets:
                    execution.total_sets ?? execution.completed_sets ?? actions.length,
                durationMinutes,
                prRecords,
                monthlyTrainingDays,
                user: {
                    nickname: profile?.nickname || "健身达人",
                    avatarUrl: profile?.avatar_url || "",
                },
            },
        },
    };
}

export async function fetchExecutionByToken(token: string) {
    // 优先尝试 share_token（如不存在或未填则回退到 id）
    const byShareToken = await supabase
        .from("plan_instance_executions")
        .select(SHARE_SELECT_FIELDS)
        .eq("share_token", token)
        .single();

    if (byShareToken.data && !byShareToken.error) {
        return byShareToken;
    }

    // 如果 share_token 列不存在或未命中，则回退使用 id 查询
    const fallback = await supabase
        .from("plan_instance_executions")
        .select(SHARE_SELECT_FIELDS)
        .eq("id", token)
        .single();

    return fallback;
}

export function getActionSummaries(rawActions: any[]) {
    const actions = normalizeActions(rawActions);
    return summarizeActions(actions);
}

