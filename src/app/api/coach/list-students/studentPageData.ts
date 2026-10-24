import supabase from "@/lib/supabaseClient";
import { chunkIds, readAllRowsByKeyset } from "@/lib/supabaseKeysetPages";
import {
    CARRYOVER_INSTANCE_STATUS_LIST,
    groupSubscriptionCarryoverHistory,
    SubscriptionCarryoverHistory,
} from "@/lib/subscriptionCarryover";
import { summarizePlanCompletion } from "@/lib/planInstanceCompletion";

// 排除已归档实例，优先展示当前进行中计划；没有进行中时再回退到已完成
export const PLAN_INSTANCE_STATUSES = ["active", "paused", "completed"] as const;

const INSTANCE_COLUMNS =
    "id, coach_id, coach_subscription_id, student_id, name, description, status, rest_days_count, training_days_count, start_execution_day, entitlement_consumption_policy, created_at, training_days";
// 已完成执行记录随实例一起嵌入返回，省掉“实例 → 执行记录”的第二次往返。
// coach_plan_instances 与 plan_instance_executions 之间有两条外键，必须显式指定。
const EMBEDDED_EXECUTIONS =
    "executions:plan_instance_executions!plan_instance_executions_instance_id_fkey(id, instance_id, day_index, status, started_at, completed_at, created_at)";

function uniqueIds(ids: readonly string[]): string[] {
    return Array.from(new Set(ids.map((id) => String(id || "").trim()).filter(Boolean)));
}

export type PageSubscriptionRef = {
    subscriptionId: string;
    studentId: string;
    /** 只有购买了周数的订阅才需要读取历史计划（与 selectCarryoverSubscriptionIds 一致） */
    loadCarryover: boolean;
};

export type PlanInstanceMeta = {
    instance_id: string;
    created_at: string | null;
    status: string | null;
    training_days: any[];
    start_execution_day: number;
    executions: Array<{ day_index: number; status: string | null }>;
};

export type StudentPlanData = {
    plan: any;
    progress: { total: number; completed: number };
    instanceMeta?: PlanInstanceMeta;
};

/**
 * PostgREST `or` filter for one page chunk: the student's current-plan
 * candidates under this coach, plus every carryover instance of the page's
 * subscriptions. Exactly the union of the two previously separate queries, so
 * training_days shared by both sets is downloaded once.
 */
export function buildPageInstanceFilter(params: {
    coachId: string;
    studentIds: readonly string[];
    subscriptionIds: readonly string[];
}): string | null {
    const branches: string[] = [];
    if (params.studentIds.length > 0) {
        branches.push(
            `and(coach_id.eq.${params.coachId},student_id.in.(${params.studentIds.join(",")}),status.in.(${PLAN_INSTANCE_STATUSES.join(",")}))`,
        );
    }
    if (params.subscriptionIds.length > 0) {
        branches.push(
            `and(coach_subscription_id.in.(${params.subscriptionIds.join(",")}),status.in.(${CARRYOVER_INSTANCE_STATUS_LIST.join(",")}))`,
        );
    }
    return branches.length > 0 ? branches.join(",") : null;
}

/** 选取优先级：active/paused > completed（按 created_at desc） */
export function pickLatestPlanInstanceByStudent(
    instances: readonly any[],
    coachId: string,
    studentIds: readonly string[],
): Map<string, any> {
    const studentSet = new Set(studentIds);
    const candidates = instances
        .filter((inst) =>
            inst?.coach_id === coachId &&
            studentSet.has(inst?.student_id) &&
            (PLAN_INSTANCE_STATUSES as readonly string[]).includes(inst?.status)
        )
        .sort((left, right) =>
            String(right?.created_at || "").localeCompare(String(left?.created_at || ""))
        );

    const latestActiveByStudent = new Map<string, any>();
    const latestCompletedByStudent = new Map<string, any>();
    for (const inst of candidates) {
        if (inst.status === "active" || inst.status === "paused") {
            if (!latestActiveByStudent.has(inst.student_id)) {
                latestActiveByStudent.set(inst.student_id, inst);
            }
            continue;
        }
        if (!latestCompletedByStudent.has(inst.student_id)) {
            latestCompletedByStudent.set(inst.student_id, inst);
        }
    }

    const latest = new Map<string, any>();
    for (const studentId of studentIds) {
        const inst = latestActiveByStudent.get(studentId) || latestCompletedByStudent.get(studentId);
        if (inst) latest.set(studentId, inst);
    }
    return latest;
}

export function buildStudentPlanData(
    studentIds: readonly string[],
    latestByStudent: Map<string, any>,
    executions: readonly any[],
): Map<string, StudentPlanData> {
    const completedByInstance = new Map<string, number>();
    const executionsByInstance = new Map<string, Array<{ day_index: number; status: string | null }>>();
    for (const e of executions) {
        if (e?.status !== "completed") continue;
        const iid = e.instance_id as string;
        completedByInstance.set(iid, (completedByInstance.get(iid) || 0) + 1);
        const list = executionsByInstance.get(iid) || [];
        list.push({
            day_index: Number(e.day_index || 0),
            status: String(e.status || ""),
        });
        executionsByInstance.set(iid, list);
    }

    const result = new Map<string, StudentPlanData>();
    for (const studentId of studentIds) {
        const inst = latestByStudent.get(studentId);
        if (!inst) {
            result.set(studentId, { plan: null, progress: { total: 0, completed: 0 } });
            continue;
        }
        const startExecutionDay = Number(inst.start_execution_day || 1);
        const completionSummary = Array.isArray(inst.training_days)
            ? summarizePlanCompletion({
                trainingDays: inst.training_days,
                startExecutionDay,
                executions: executionsByInstance.get(inst.id) || [],
            })
            : null;
        const trainingDayTotal = completionSummary?.overallTotalTrainingDays ??
            Number(inst.training_days_count || 0);
        const completedCount = completionSummary?.overallCompletedTrainingDays ??
            (completedByInstance.get(inst.id) || 0);
        const isLogicallyCompleted = completionSummary?.isLogicallyCompleted ??
            (trainingDayTotal > 0 && completedCount >= trainingDayTotal);
        const derivedStatus = inst.status === "active" && isLogicallyCompleted
            ? "completed"
            : inst.status;

        result.set(studentId, {
            plan: {
                name: inst.name,
                description: inst.description || "",
                status: derivedStatus,
                raw_status: inst.status,
                is_logically_completed: isLogicallyCompleted,
                id: inst.id,
            },
            progress: {
                total: trainingDayTotal,
                completed: completedCount,
            },
            instanceMeta: {
                instance_id: inst.id,
                created_at: inst.created_at || null,
                status: inst.status || null,
                training_days: Array.isArray(inst.training_days) ? inst.training_days : [],
                start_execution_day: startExecutionDay,
                executions: executionsByInstance.get(inst.id) || [],
            },
        });
    }
    return result;
}

function selectCarryoverInstances(instances: readonly any[], subscriptionIds: readonly string[]) {
    const subscriptionSet = new Set(subscriptionIds);
    return instances.filter((inst) =>
        subscriptionSet.has(String(inst?.coach_subscription_id || "")) &&
        CARRYOVER_INSTANCE_STATUS_LIST.includes(inst?.status)
    );
}

/** Split embedded executions off the instance rows (both deduplicated by id). */
export function splitEmbeddedExecutions(rows: readonly any[]) {
    const instancesById = new Map<string, any>();
    const executionsById = new Map<string, any>();
    for (const { executions, ...instance } of rows) {
        instancesById.set(String(instance.id), instance);
        for (const execution of Array.isArray(executions) ? executions : []) {
            executionsById.set(String(execution.id), execution);
        }
    }
    return {
        instances: Array.from(instancesById.values()),
        executions: Array.from(executionsById.values()),
    };
}

async function loadPageInstanceRows(coachId: string, refs: readonly PageSubscriptionRef[]) {
    const rows: any[] = [];
    for (const chunk of chunkIds(refs.map((ref) => ref.subscriptionId))) {
        const chunkSet = new Set(chunk);
        const chunkRefs = refs.filter((ref) => chunkSet.has(ref.subscriptionId));
        const filter = buildPageInstanceFilter({
            coachId,
            studentIds: uniqueIds(chunkRefs.map((ref) => ref.studentId)),
            subscriptionIds: uniqueIds(
                chunkRefs.filter((ref) => ref.loadCarryover).map((ref) => ref.subscriptionId),
            ),
        });
        if (!filter) continue;

        // 顶层实例按 id 分页（max-rows 只限制顶层行）；嵌入的执行记录每个实例
        // 最多是训练天数级别，不会触及上限。
        const { data, error } = await readAllRowsByKeyset<any>((afterId) => {
            let query = supabase
                .from("coach_plan_instances")
                .select(`${INSTANCE_COLUMNS}, ${EMBEDDED_EXECUTIONS}`)
                .or(filter)
                .eq("executions.status", "completed");
            if (afterId) query = query.gt("id", afterId);
            return query.order("id", { ascending: true });
        });
        if (error) {
            throw new Error(`读取学员计划失败: ${(error as any)?.message || error}`);
        }
        rows.push(...(data || []));
    }
    return rows;
}

/**
 * 一页学员的当前计划 + 进度，以及订阅的历史计划（carryover），一次往返：
 * 两类实例合并成一条查询，已完成执行记录嵌入在实例里返回。
 */
export async function loadStudentPageData(params: {
    coachId: string;
    refs: readonly PageSubscriptionRef[];
}): Promise<{
    planDetailByStudentId: Map<string, StudentPlanData>;
    carryoverHistory: SubscriptionCarryoverHistory;
}> {
    const studentIds = uniqueIds(params.refs.map((ref) => ref.studentId));
    const carryoverSubscriptionIds = uniqueIds(
        params.refs.filter((ref) => ref.loadCarryover).map((ref) => ref.subscriptionId),
    );

    const { instances, executions } = splitEmbeddedExecutions(
        await loadPageInstanceRows(params.coachId, params.refs),
    );
    const latestByStudent = pickLatestPlanInstanceByStudent(instances, params.coachId, studentIds);

    return {
        planDetailByStudentId: buildStudentPlanData(studentIds, latestByStudent, executions),
        carryoverHistory: groupSubscriptionCarryoverHistory(
            selectCarryoverInstances(instances, carryoverSubscriptionIds),
            executions,
        ),
    };
}
