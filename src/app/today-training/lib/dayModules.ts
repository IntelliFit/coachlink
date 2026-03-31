'use client';

import { formatKgValueForGym } from '@/lib/weightQuantize';
import {
    addBeijingDays,
    diffBeijingCalendarDays,
    formatBeijingDate,
    getBeijingDayStart,
    toBeijingDateKey,
} from '@/lib/beijingTime';

export type ExecutionStatus = 'none' | 'in_progress' | 'completed';
export type LightweightType = 'DIET' | 'CARDIO' | 'HABIT';
export type DayItemType = 'STRENGTH' | LightweightType;

export interface NormalizedDayTask {
    index: number;
    executionIndex: number;
    actionId: string;
    title: string;
    itemType: DayItemType;
    params: any;
    customData: any;
    noteText: string;
    detailText: string;
    demoVideoUrl?: string | null;
    suggestedTime?: string | null;
    executionItem?: any;
    setCount: number;
    completedSetCount: number;
    isCompleted: boolean;
    isStudentExtra?: boolean;
}

export interface DayModuleModel {
    normalizedTasks: NormalizedDayTask[];
    strengthTasks: NormalizedDayTask[];
    lightweightTasks: NormalizedDayTask[];
    lightweightGroups: Array<{ slot: string; items: NormalizedDayTask[] }>;
    moduleCount: number;
    completedModuleCount: number;
    remainingModuleCount: number;
    dayCompleted: boolean;
    strengthCompleted: boolean;
    trainingCompleted: boolean;
    trainingInProgress: boolean;
    strengthCompletedSetCount: number;
    strengthTotalSetCount: number;
    lightweightCompletedCount: number;
}

export interface PlanDayScheduleInfo {
    dayIndex: number;
    baselineDate: Date;
    displayDate: Date;
    totalDelayDays: number;
    delayAddedDays: number;
}

export interface PostponedDateMarker {
    date: Date;
    key: string;
    targetDayIndex: number;
    offset: number;
}

export interface PlanScheduleModel {
    scheduleByDayIndex: Map<number, PlanDayScheduleInfo>;
    postponedDates: PostponedDateMarker[];
    postponedByDateKey: Map<string, PostponedDateMarker>;
}

export const slotOrder = ['早晨', '中午', '下午', '晚上', '任意时间'] as const;

export const parsePositiveIntOrNull = (value: any) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n);
};

export const getTimeSlotLabel = (time?: string | null) => {
    if (!time) return '任意时间';
    const match = String(time).match(/(\d{1,2})/);
    const hour = match ? Number(match[1]) : NaN;
    if (!Number.isFinite(hour)) return '任意时间';
    if (hour < 11) return '早晨';
    if (hour < 14) return '中午';
    if (hour < 18) return '下午';
    return '晚上';
};

export const getTaskItemType = (
    actionSet: any,
    action: any,
    executionItem?: any,
): DayItemType => {
    const rawType = String(
        executionItem?.item_type ||
        executionItem?.type ||
        actionSet?.itemType ||
        action?.type ||
        'STRENGTH',
    ).toUpperCase();

    if (rawType === 'DIET' || rawType === 'CARDIO' || rawType === 'HABIT') {
        return rawType;
    }
    return 'STRENGTH';
};

export const buildStrengthMeta = (task: NormalizedDayTask) => {
    const params = task.params || {};
    const sets = task.setCount || 1;
    const reps = parsePositiveIntOrNull(params['次数']);
    const durationSeconds = parsePositiveIntOrNull(params['持续时间']);
    const secondPart = durationSeconds !== null
        ? `${durationSeconds}秒`
        : (reps !== null ? `${reps}次` : '自选');

    const load = params.load;
    const intensity = params['强度'];
    const intensityConfig = params.intensityConfig;
    const relativeIntensity = intensityConfig?.relativeIntensity;

    let loadText: string | null = null;
    if (load !== null && load !== undefined) {
        const numericLoad = Number(load);
        if (Number.isFinite(numericLoad)) {
            if (numericLoad < 0) {
                loadText = `辅助${formatKgValueForGym(Math.abs(numericLoad))}kg`;
            } else if (numericLoad > 0) {
                loadText = `${formatKgValueForGym(numericLoad)}kg`;
            }
        }
    }

    if (!loadText && relativeIntensity?.value && relativeIntensity.value > 0) {
        const suffix = relativeIntensity.type === 'percentage' ? '%' : 'RM';
        loadText = `${relativeIntensity.value}${suffix}`;
    }

    if (!loadText && intensity && intensity > 0) {
        loadText = `${intensity}RM`;
    }

    const restSeconds = params['休息时间'] ?? params.rest_seconds;
    return {
        summary: `${sets}组 × ${secondPart}`,
        loadText,
        restText: restSeconds ? `休息${(Number(restSeconds) / 60).toFixed(1)}分钟` : null,
    };
};

export const buildLightweightSummary = (task: NormalizedDayTask) => {
    const { itemType, customData, detailText, suggestedTime } = task;
    switch (itemType) {
        case 'DIET':
            return {
                accent: 'text-emerald-700 bg-emerald-50 border-emerald-100/60',
                icon: '🥗',
                summary: customData.content || detailText || '按建议饮食执行',
                extra: suggestedTime ? `建议时间 ${suggestedTime}` : '轻量记录，完成即可打卡',
                actionLabel: task.isCompleted ? '查看记录' : '记录饮食',
            };
        case 'CARDIO':
            return {
                accent: 'text-sky-700 bg-sky-50 border-sky-100/60',
                icon: '🏃',
                summary: [
                    customData.duration ? `${(Number(customData.duration) / 60).toFixed(0)}分钟` : null,
                    customData.distance ? `${(Number(customData.distance) / 1000).toFixed(1)}km` : null,
                    customData.pace ? `配速 ${customData.pace}` : null,
                    !customData.duration && !customData.distance ? (detailText || '完成有氧任务') : null,
                ].filter(Boolean).join(' · '),
                extra: suggestedTime ? `建议时间 ${suggestedTime}` : '完成后记录距离或时长',
                actionLabel: task.isCompleted ? '查看记录' : '记录有氧',
            };
        case 'HABIT':
        default:
            return {
                accent: 'text-violet-700 bg-violet-50 border-violet-100/60',
                icon: '✅',
                summary: customData.habit_name || detailText || '完成习惯打卡',
                extra: customData.target_duration
                    ? `目标 ${customData.target_duration} 分钟`
                    : (suggestedTime ? `建议时间 ${suggestedTime}` : '完成即可打卡'),
                actionLabel: task.isCompleted ? '查看记录' : '立即打卡',
            };
    }
};

export const buildDayModuleModel = (params: {
    day: any;
    actions: Record<string, any>;
    execution?: any;
    executionStatus?: ExecutionStatus;
}): DayModuleModel => {
    const {
        day,
        actions,
        execution,
        executionStatus = 'none',
    } = params;

    const actionSets = (day?.actionSets || []) as any[];
    const executionActions = Array.isArray(execution?.action_executions)
        ? execution.action_executions
        : [];
    const executionBySourceIndex = new Map<number, any>();
    const executionIndexBySourceIndex = new Map<number, number>();

    executionActions.forEach((item: any, index: number) => {
        const sourceIndex = Number.isInteger(item?.source_action_index)
            ? Number(item.source_action_index)
            : index;
        if (!executionBySourceIndex.has(sourceIndex)) {
            executionBySourceIndex.set(sourceIndex, item);
            executionIndexBySourceIndex.set(sourceIndex, index);
        }
    });

    const normalizedTasks: NormalizedDayTask[] = actionSets.map((actionSet: any, index: number) => {
        const actionId = actionSet.action_id || actionSet.actionId || '';
        const action = actions[actionId];
        const executionItem = executionBySourceIndex.get(index) ?? executionActions[index];
        const executionIndex = executionIndexBySourceIndex.get(index) ?? index;
        const itemType = getTaskItemType(actionSet, action, executionItem);
        const paramsData = actionSet.params || {};
        const customData = paramsData.custom_data || {};
        const setCount = typeof executionItem?.total_sets === 'number'
            ? executionItem.total_sets
            : parsePositiveIntOrNull(paramsData['组数'] ?? actionSet.sets) ?? 1;
        const completedSetCount = typeof executionItem?.completed_sets === 'number'
            ? executionItem.completed_sets
            : (executionItem?.sets || []).filter((set: any) => set?.status === 'completed').length;
        const isTaskCompleted = executionItem
            ? (executionItem?.completed_sets === executionItem?.total_sets) ||
            executionItem?.status === 'completed' ||
            executionItem?.completed === true
            : false;

        return {
            index,
            executionIndex,
            actionId,
            title: action?.name || actionSet.set_name || '未命名任务',
            itemType,
            params: paramsData,
            customData,
            noteText: String(paramsData.note || actionSet.note || '').trim(),
            detailText: String(action?.detail || '').trim(),
            demoVideoUrl: action?.url || action?.video_url,
            suggestedTime: paramsData.suggested_time || action?.suggested_time || null,
            executionItem,
            setCount,
            completedSetCount,
            isCompleted: isTaskCompleted,
            isStudentExtra: executionItem?.source === 'student_extra',
        };
    });

    const extraExecutionTasks: NormalizedDayTask[] = executionActions
        .map((executionItem: any, executionIndex: number) => {
            const hasExplicitSourceIndex = Number.isInteger(executionItem?.source_action_index);
            const sourceIndex = hasExplicitSourceIndex
                ? Number(executionItem.source_action_index)
                : executionIndex;
            const isStudentExtra =
                executionItem?.source === 'student_extra' ||
                (!!executionItem?.source_action_id && !executionItem?.source);
            // 仅把“学员自行追加”的任务作为 extra 展示，避免教练覆盖计划后
            // 旧的计划动作因 source_action_index 越界被误识别成额外轻任务。
            const isExtraItem = isStudentExtra;

            if (!isExtraItem) {
                return null;
            }

            const actionId = executionItem?.action_id || executionItem?.source_action_id || '';
            const action = actions[actionId];
            const itemType = getTaskItemType(null, action, executionItem);
            const customData = executionItem?.custom_data || executionItem?.params?.custom_data || {};
            const setCount = typeof executionItem?.total_sets === 'number'
                ? executionItem.total_sets
                : Array.isArray(executionItem?.sets)
                    ? executionItem.sets.length
                    : 1;
            const completedSetCount = typeof executionItem?.completed_sets === 'number'
                ? executionItem.completed_sets
                : Array.isArray(executionItem?.sets)
                    ? executionItem.sets.filter((set: any) => set?.status === 'completed').length
                    : (executionItem?.completed ? 1 : 0);
            const isTaskCompleted = executionItem
                ? (executionItem?.completed_sets === executionItem?.total_sets) ||
                executionItem?.status === 'completed' ||
                executionItem?.completed === true
                : false;

            return {
                index: executionIndex,
                executionIndex,
                actionId,
                title: action?.name || executionItem?.action_name || '未命名任务',
                itemType,
                params: executionItem?.params || {},
                customData,
                noteText: String(executionItem?.notes || '').trim(),
                detailText: String(action?.detail || executionItem?.detail || '').trim(),
                demoVideoUrl: action?.url || action?.video_url || null,
                suggestedTime: executionItem?.suggested_time || action?.suggested_time || null,
                executionItem,
                setCount,
                completedSetCount,
                isCompleted: isTaskCompleted,
                isStudentExtra: executionItem?.source === 'student_extra',
            };
        })
        .filter(Boolean) as NormalizedDayTask[];

    const mergedTasks = [...normalizedTasks, ...extraExecutionTasks];

    const strengthTasks = mergedTasks.filter((task) => task.itemType === 'STRENGTH');
    const lightweightTasks = mergedTasks.filter((task) => task.itemType !== 'STRENGTH');
    const strengthCompleted = strengthTasks.length > 0 && strengthTasks.every((task) => task.isCompleted);
    const trainingCompleted = strengthTasks.length > 0 && (strengthCompleted || executionStatus === 'completed');
    const trainingInProgress = strengthTasks.length > 0 && !trainingCompleted && executionStatus === 'in_progress';
    const strengthCompletedSetCount = strengthTasks.reduce((sum, task) => sum + task.completedSetCount, 0);
    const strengthTotalSetCount = strengthTasks.reduce((sum, task) => sum + task.setCount, 0);
    const lightweightCompletedCount = lightweightTasks.filter((task) => task.isCompleted).length;
    const moduleCount = (strengthTasks.length > 0 ? 1 : 0) + lightweightTasks.length;
    const completedModuleCount = (trainingCompleted ? 1 : 0) + lightweightCompletedCount;
    const remainingModuleCount = Math.max(0, moduleCount - completedModuleCount);
    const dayCompleted = moduleCount > 0 && completedModuleCount >= moduleCount;

    const groups = new Map<string, NormalizedDayTask[]>();
    lightweightTasks.forEach((task) => {
        const slot = getTimeSlotLabel(task.suggestedTime);
        if (!groups.has(slot)) groups.set(slot, []);
        groups.get(slot)?.push(task);
    });

    const lightweightGroups = slotOrder
        .map((slot) => ({ slot, items: groups.get(slot) || [] }))
        .filter((group) => group.items.length > 0);

    return {
        normalizedTasks: mergedTasks,
        strengthTasks,
        lightweightTasks,
        lightweightGroups,
        moduleCount,
        completedModuleCount,
        remainingModuleCount,
        dayCompleted,
        strengthCompleted,
        trainingCompleted,
        trainingInProgress,
        strengthCompletedSetCount,
        strengthTotalSetCount,
        lightweightCompletedCount,
    };
};

export const resolvePlanDayDate = (params: {
    dayIndex: number;
    effectiveStartDate?: string | Date | null;
    fallbackAnchorDayIndex?: number;
    fallbackAnchorDate?: Date;
}) => {
    const {
        dayIndex,
        effectiveStartDate,
        fallbackAnchorDayIndex = 1,
        fallbackAnchorDate = new Date(),
    } = params;

    if (effectiveStartDate) {
        return addBeijingDays(effectiveStartDate, dayIndex - 1);
    }

    const anchor = getBeijingDayStart(fallbackAnchorDate);
    return addBeijingDays(anchor, dayIndex - fallbackAnchorDayIndex);
};

const getExecutionAnchorDate = (execution?: any) => {
    if (!execution) return null;
    const status = String(execution?.status || '').toLowerCase();
    const ts = status === 'completed'
        ? execution?.completed_at || execution?.started_at
        : status === 'abandoned'
            ? execution?.completed_at || execution?.updated_at || execution?.started_at
            : status === 'in_progress'
                ? execution?.started_at
                : null;
    return ts ? getBeijingDayStart(ts) : null;
};

export const buildPlanScheduleModel = (params: {
    trainingDays: any[];
    executionsByDayIndex?: Record<number, any>;
    effectiveStartDate?: string | Date | null;
    progressDayIndex?: number;
    fallbackAnchorDayIndex?: number;
    fallbackAnchorDate?: Date;
    today?: Date;
}): PlanScheduleModel => {
    const {
        trainingDays,
        executionsByDayIndex = {},
        effectiveStartDate,
        progressDayIndex,
        fallbackAnchorDayIndex = progressDayIndex || 1,
        fallbackAnchorDate = new Date(),
        today = new Date(),
    } = params;

    const scheduleByDayIndex = new Map<number, PlanDayScheduleInfo>();
    const postponedDates: PostponedDateMarker[] = [];
    const postponedByDateKey = new Map<string, PostponedDateMarker>();
    const todayStart = getBeijingDayStart(today);

    const sortedDays = [...(trainingDays || [])].sort((a, b) => {
        const left = Number(a?.dayIndex ?? a?.day_index ?? 0);
        const right = Number(b?.dayIndex ?? b?.day_index ?? 0);
        return left - right;
    });

    let cumulativeDelayDays = 0;

    sortedDays.forEach((day) => {
        const dayIndex = Number(day?.dayIndex ?? day?.day_index ?? 0);
        if (!Number.isFinite(dayIndex) || dayIndex <= 0) return;

        const baselineDate = resolvePlanDayDate({
            dayIndex,
            effectiveStartDate,
            fallbackAnchorDayIndex,
            fallbackAnchorDate,
        });
        const scheduledDate = addBeijingDays(baselineDate, cumulativeDelayDays);
        const execution = executionsByDayIndex?.[dayIndex];
        const executionStatus = String(execution?.status || '').toLowerCase();
        const executionDate = getExecutionAnchorDate(execution);
        const isCurrentProgressDay = progressDayIndex === dayIndex;
        const isTerminalExecution = executionStatus === 'completed' || executionStatus === 'abandoned';

        let displayDate = scheduledDate;
        let delayAddedDays = 0;

        // The current progress day should keep rolling with the real calendar date
        // until it is actually completed/abandoned, rather than freezing on started_at.
        if (isCurrentProgressDay && !isTerminalExecution) {
            const lateDays = diffBeijingCalendarDays(todayStart, scheduledDate);
            if (lateDays > 0) {
                delayAddedDays = lateDays;
                displayDate = todayStart;
            } else {
                displayDate = todayStart;
            }
        } else if (executionDate) {
            const lateDays = diffBeijingCalendarDays(executionDate, scheduledDate);
            if (lateDays > 0) {
                delayAddedDays = lateDays;
                displayDate = executionDate;
            } else {
                displayDate = executionDate;
            }
        } else if (isCurrentProgressDay) {
            const lateDays = diffBeijingCalendarDays(todayStart, scheduledDate);
            if (lateDays > 0) {
                delayAddedDays = lateDays;
                displayDate = todayStart;
            }
        }

        if (delayAddedDays > 0) {
            for (let offset = 0; offset < delayAddedDays; offset += 1) {
                const postponedDate = addBeijingDays(scheduledDate, offset);
                const key = toBeijingDateKey(postponedDate);
                if (postponedByDateKey.has(key)) continue;
                const marker: PostponedDateMarker = {
                    date: postponedDate,
                    key,
                    targetDayIndex: dayIndex,
                    offset: offset + 1,
                };
                postponedByDateKey.set(key, marker);
                postponedDates.push(marker);
            }
            cumulativeDelayDays += delayAddedDays;
        }

        scheduleByDayIndex.set(dayIndex, {
            dayIndex,
            baselineDate,
            displayDate,
            delayAddedDays,
            totalDelayDays: diffBeijingCalendarDays(displayDate, baselineDate),
        });
    });

    return {
        scheduleByDayIndex,
        postponedDates,
        postponedByDateKey,
    };
};

export const toDateKey = (date: Date) => {
    return toBeijingDateKey(date);
};

export const formatPlanDayLabel = (date: Date | null) => {
    if (!date) return '';
    return formatBeijingDate(date, 'zh-CN', {
        month: 'long',
        day: 'numeric',
        weekday: 'long',
    });
};

export const addDays = (date: Date, offset: number) => {
    return addBeijingDays(date, offset);
};
