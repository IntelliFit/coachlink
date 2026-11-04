/**
 * 训练日结构锁的合并规则：已经练过的天不能被调整草稿改掉。
 * 计划助理的调整草稿和训练反馈草稿在生成、应用时都用这里的规则。
 */
import { normalizeIntensityConfig } from "@/lib/rmCaculator";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

const db = () => serviceRoleSupabase as any;

/** 有这些执行状态的训练日不能再改（与训练日结构锁一致）。 */
export const LOCKED_EXECUTION_STATUSES = ["completed", "in_progress", "abandoned"];

export function dayIndexOf(day: any, index: number): number {
    return Number(day?.dayIndex ?? day?.day_index ?? index + 1);
}

function intensityKey(params: any): string {
    if (params?.fixedLoadOverride === true) return `fixed:${Number(params?.load)}`;
    const relative = normalizeIntensityConfig(params)?.relativeIntensity;
    return relative ? `${relative.type}:${Number(relative.value)}` : "";
}

/** 训练日「处方」的比较键：动作顺序、组数、次数、强度、休息、时长、备注；不含按 1RM 算出的重量。 */
export function dayPrescriptionKey(day: any): string {
    const sets = Array.isArray(day?.actionSets) ? day.actionSets : [];
    return JSON.stringify({
        type: day?.type === "rest" ? "rest" : "training",
        note: String(day?.note || "").trim(),
        sets: sets.map((set: any) => {
            const p = set?.params || {};
            return [
                String(set?.actionId || set?.action_id || ""),
                p["组数"] ?? null,
                p["次数"] ?? null,
                intensityKey(p),
                p["休息时间"] ?? null,
                p["持续时间"] ?? null,
            ];
        }),
    });
}

/**
 * 合并 AI 修改后的天：
 * - 锁定的天（已有执行记录、起始日之前）保留原样；
 * - 处方没变的天也保留原对象，避免计划脚本往返丢掉逐组处方、单位等字段。
 * 天数不一致时返回 null，调用方不该应用这样的结果。
 */
export function mergeKeepingLockedDays(params: {
    originalDays: any[];
    revisedDays: any[];
    lockedDayIndexes: Iterable<number>;
    startExecutionDay?: number | null;
    /** 草稿生成时每天的处方键；草稿没改的天保留当前计划（教练之后的修改不会被冲掉） */
    baseDayKeys?: string[] | null;
}): any[] | null {
    const { originalDays, revisedDays } = params;
    if (!Array.isArray(originalDays) || !Array.isArray(revisedDays)) return null;
    if (originalDays.length !== revisedDays.length) return null;

    const locked = new Set(Array.from(params.lockedDayIndexes).map(Number));
    const startDay = Math.max(1, Number(params.startExecutionDay || 1));
    return revisedDays.map((day, index) => {
        const original = originalDays[index];
        const dayIndex = dayIndexOf(original, index);
        if (dayIndex < startDay || locked.has(dayIndex)) return original;
        const revisedKey = dayPrescriptionKey(day);
        if (dayPrescriptionKey(original) === revisedKey) return original;
        if (params.baseDayKeys && params.baseDayKeys[index] === revisedKey) return original;
        return { ...day, dayIndex };
    });
}

export function hasTrainingDayChanges(originalDays: any[], mergedDays: any[]): boolean {
    return JSON.stringify(originalDays) !== JSON.stringify(mergedDays);
}

export async function loadLockedDayIndexes(planInstanceId: string): Promise<number[]> {
    const { data, error } = await db()
        .from("plan_instance_executions")
        .select("day_index, status")
        .eq("instance_id", planInstanceId)
        .in("status", LOCKED_EXECUTION_STATUSES);
    if (error) throw new Error(`读取训练记录失败: ${error.message}`);
    return (data || []).map((row: any) => Number(row?.day_index || 0)).filter((n: number) => n > 0);
}
