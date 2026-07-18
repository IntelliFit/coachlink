import { normalizeActionNameForMatch, sanitizeActionName } from "@/lib/planImportText";
import type { ItemType } from "@/types";

type ActionLite = {
    id: string;
    name: string;
    type?: ItemType | string | null;
};

type DeterministicEditResult = {
    matched: boolean;
    applied: boolean;
    terminal?: boolean;
    actionPlan?: string;
    updatedTrainingDays: any[];
    reason?: string;
};

type ParsedReplaceLastOccurrenceInstruction = {
    weekStart: number;
    weekEnd: number;
    dayOfWeek: number;
    occurrenceFromEnd: number;
    sourceActionName: string;
    replacementActionName: string;
    sets?: number;
    reps?: number;
    rm?: number;
};

type ParsedDeleteNthOccurrenceInstruction = {
    weekStart: number;
    weekEnd: number;
    dayOfWeeks: number[];
    occurrenceCountEquals: number;
    deleteOccurrenceIndex: number;
    actionName: string;
};

type ParsedMoveWeeklyScheduleInstruction = {
    weekStart: number;
    weekEnd: number;
    sourceDays: number[];
    targetDays: number[];
};

function getWeekDayMeta(dayIndex: number) {
    const week = Math.ceil(dayIndex / 7);
    const dayOfWeek = ((dayIndex - 1) % 7) + 1;
    return { week, dayOfWeek };
}

function normalizeItemType(type?: string | null): ItemType {
    return ((type || "STRENGTH").toUpperCase() as ItemType) || "STRENGTH";
}

function extractActionNameFromSet(set: any, actionMap: Map<string, ActionLite>): string {
    const action = actionMap.get(String(set?.actionId || ""));
    return String(
        action?.name ||
        set?.params?.action_name ||
        set?.setName ||
        "",
    );
}

function matchesActionMention(actionName: string, mention: string): boolean {
    const actionKey = normalizeActionNameForMatch(actionName);
    const mentionKey = normalizeActionNameForMatch(mention);
    if (!actionKey || !mentionKey) return false;
    return actionKey === mentionKey || actionKey.includes(mentionKey) || mentionKey.includes(actionKey);
}

function findBestActionByMention(mention: string, actions: ActionLite[]): ActionLite | null {
    const mentionKey = normalizeActionNameForMatch(mention);
    if (!mentionKey) return null;

    const exact = actions.find((action) => normalizeActionNameForMatch(action.name) === mentionKey);
    if (exact) return exact;

    const partials = actions.filter((action) => {
        const actionKey = normalizeActionNameForMatch(action.name);
        return actionKey.includes(mentionKey) || mentionKey.includes(actionKey);
    });
    if (partials.length === 0) return null;
    return partials.sort((a, b) => b.name.length - a.name.length)[0];
}

const chineseScheduleDayMap: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    日: 7,
    天: 7,
};

function normalizeScheduleDays(days: number[]): number[] {
    return Array.from(new Set(days)).filter((day) => day >= 1 && day <= 7);
}

function extractScheduleDaySequence(segment: string, preferLast: boolean): number[] {
    const text = String(segment || "").replace(/[０-９]/g, (char) =>
        String(char.charCodeAt(0) - 0xFF10),
    );
    const dDays = normalizeScheduleDays(
        Array.from(text.matchAll(/\bD([1-7])\b/gi)).map((match) => Number(match[1])),
    );
    if (dDays.length >= 2) return dDays;

    const compactMatches = Array.from(text.matchAll(/(?:^|[^\d])([1-7]{2,7})(?!\d)/g));
    if (compactMatches.length > 0) {
        const match = preferLast ? compactMatches[compactMatches.length - 1] : compactMatches[0];
        const compactDays = normalizeScheduleDays(match[1].split("").map(Number));
        if (compactDays.length >= 2) return compactDays;
    }

    const numberedDays = normalizeScheduleDays(
        Array.from(text.matchAll(/第\s*([一二三四五六日天])\s*天/g))
            .map((match) => chineseScheduleDayMap[match[1]]),
    );
    if (numberedDays.length >= 2) return numberedDays;

    const weekdayDays = normalizeScheduleDays(
        Array.from(text.matchAll(/周([一二三四五六日天])/g))
            .map((match) => chineseScheduleDayMap[match[1]]),
    );
    if (weekdayDays.length >= 2) return weekdayDays;

    const compactChinese = Array.from(text.matchAll(/([一二三四五六日天]{2,7})/g));
    if (compactChinese.length > 0) {
        const match = preferLast ? compactChinese[compactChinese.length - 1] : compactChinese[0];
        const days = normalizeScheduleDays(
            match[1].split("").map((char) => chineseScheduleDayMap[char]),
        );
        if (days.length >= 2) return days;
    }

    return [];
}

export function isWeeklyScheduleMoveInstruction(instruction: string): boolean {
    const text = String(instruction || "").replace(/\s+/g, "");
    if (!text) return false;

    const mentionsWeeklySchedule = /(?:训练日|训练安排|训练频率|周内安排|休息日|训练周|每(?:个|一)?(?:训练)?周)/.test(text);
    const movesSchedule = /(?:换成|改成|调整为|移到|挪到|安排到|变成|重新排(?:成)?|错开)/.test(text);
    return mentionsWeeklySchedule && movesSchedule;
}

function parseMoveWeeklyScheduleInstruction(
    instruction: string,
    trainingDays: any[],
): ParsedMoveWeeklyScheduleInstruction | null {
    const text = String(instruction || "").replace(/\s+/g, " ").trim();
    if (!isWeeklyScheduleMoveInstruction(text)) return null;

    const moveVerb = text.match(/(换成|改成|调整为|移到|挪到|安排到|变成|重新排成)/);
    const moveVerbIndex = moveVerb?.index ?? -1;
    if (!moveVerb || moveVerbIndex < 0) return null;

    const sourceDays = extractScheduleDaySequence(text.slice(0, moveVerbIndex), true);
    const targetDays = extractScheduleDaySequence(
        text.slice(moveVerbIndex + moveVerb[0].length),
        false,
    );
    if (sourceDays.length < 2 || sourceDays.length !== targetDays.length) return null;

    const weekRangeMatch = text.match(/第\s*(\d+)\s*周\s*(?:到|至|~|～|-|—)\s*第?\s*(\d+)\s*周/);
    const singleWeekMatch = text.match(/第\s*(\d+)\s*周/);
    const maxWeek = (trainingDays || []).reduce(
        (maximum, day) => Math.max(maximum, Math.ceil(Number(day?.dayIndex || 0) / 7)),
        0,
    );
    const weekStart = weekRangeMatch ? Number(weekRangeMatch[1]) : Number(singleWeekMatch?.[1] || 1);
    const weekEnd = weekRangeMatch ? Number(weekRangeMatch[2]) : Number(singleWeekMatch?.[1] || maxWeek);
    if (!weekStart || !weekEnd || weekStart > weekEnd) return null;

    return { weekStart, weekEnd, sourceDays, targetDays };
}

function parseReplacementActionName(segment: string, actions: ActionLite[]): string {
    const trimmed = String(segment || "").trim();
    if (!trimmed) return "";

    const actionHit = findBestActionByMention(trimmed, actions);
    if (actionHit) return actionHit.name;

    const withoutTail = trimmed
        .split(/[，。,；;\n]/)[0]
        .replace(/\s+\d.*$/, "")
        .trim();

    return sanitizeActionName(withoutTail);
}

function parseReplaceLastOccurrenceInstruction(
    instruction: string,
    actions: ActionLite[],
): ParsedReplaceLastOccurrenceInstruction | null {
    const text = String(instruction || "").replace(/\s+/g, " ").trim();
    if (!text) return null;

    const weekRangeMatch = text.match(/第\s*(\d+)\s*周\s*(?:到|至|~|～|-|—)\s*第?\s*(\d+)\s*周/);
    const singleWeekMatch = text.match(/第\s*(\d+)\s*周/);
    const dayMatch = text.match(/第\s*(\d+)\s*天/);
    const replaceVerbMatch = text.match(/(换成|改成|替换成|替换为)/);
    const occurrenceMatch = text.match(/最后\s*(?:(\d+)\s*次|一次)/);

    if (!dayMatch || !replaceVerbMatch || !occurrenceMatch) return null;

    const weekStart = weekRangeMatch ? Number(weekRangeMatch[1]) : Number(singleWeekMatch?.[1] || 0);
    const weekEnd = weekRangeMatch ? Number(weekRangeMatch[2]) : weekStart;
    const dayOfWeek = Number(dayMatch[1]);
    const occurrenceFromEnd = Number(occurrenceMatch[1] || 1);

    if (!weekStart || !weekEnd || !dayOfWeek || occurrenceFromEnd <= 0) return null;

    const replaceVerbIndex = replaceVerbMatch.index ?? -1;
    if (replaceVerbIndex < 0) return null;

    const beforeReplace = text.slice(0, replaceVerbIndex).trim();
    const afterReplace = text.slice(replaceVerbIndex + replaceVerbMatch[0].length).trim();

    const sourceSegment = beforeReplace
        .slice((occurrenceMatch.index ?? 0) + occurrenceMatch[0].length)
        .replace(/^[的\s]+/, "")
        .replace(/全部/g, "")
        .trim();
    const sourceActionName = sanitizeActionName(sourceSegment);
    const replacementActionName = parseReplacementActionName(afterReplace, actions);

    if (!sourceActionName || !replacementActionName) return null;

    let sets: number | undefined;
    let reps: number | undefined;
    const setRepMatch = afterReplace.match(/(\d+)\s*组\s*(\d+)\s*(?:次|个)/i)
        || afterReplace.match(/(\d+)\s*[x×*]\s*(\d+)/i);
    if (setRepMatch) {
        sets = Number(setRepMatch[1]);
        reps = Number(setRepMatch[2]);
    }

    const rmMatch = afterReplace.match(/(\d+(?:\.\d+)?)\s*rm\b/i);
    const rm = rmMatch ? Number(rmMatch[1]) : undefined;

    return {
        weekStart,
        weekEnd,
        dayOfWeek,
        occurrenceFromEnd,
        sourceActionName,
        replacementActionName,
        sets,
        reps,
        rm,
    };
}

function applyMoveWeeklyScheduleInstruction(
    parsed: ParsedMoveWeeklyScheduleInstruction,
    trainingDays: any[],
): DeterministicEditResult {
    const originalDays = JSON.parse(JSON.stringify(trainingDays || []));
    const originalByIndex = new Map<number, any>(
        originalDays.map((day: any) => [Number(day?.dayIndex || 0), day]),
    );
    const sourceDaySet = new Set(parsed.sourceDays);

    // 先完整校验再写入，避免某一周存在额外训练日时覆盖用户数据。
    for (let week = parsed.weekStart; week <= parsed.weekEnd; week += 1) {
        const weekDays = new Map<number, any>();
        for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek += 1) {
            weekDays.set(dayOfWeek, originalByIndex.get((week - 1) * 7 + dayOfWeek));
        }
        if (parsed.sourceDays.some((day) => weekDays.get(day)?.type !== "training")) {
            return {
                matched: true,
                applied: false,
                terminal: true,
                updatedTrainingDays: trainingDays,
                reason: `第 ${week} 周并非全部在 D${parsed.sourceDays.join("/D")} 训练，已停止确定性搬移以避免覆盖。`,
            };
        }
        const conflictingTarget = parsed.targetDays.find(
            (day) => !sourceDaySet.has(day) && weekDays.get(day)?.type === "training",
        );
        if (conflictingTarget) {
            return {
                matched: true,
                applied: false,
                terminal: true,
                updatedTrainingDays: trainingDays,
                reason: `第 ${week} 周目标 D${conflictingTarget} 已有训练内容，已停止确定性搬移以避免覆盖。`,
            };
        }
    }

    const replacements = new Map<number, any>();
    for (let week = parsed.weekStart; week <= parsed.weekEnd; week += 1) {
        const weekBase = (week - 1) * 7;

        for (const sourceDay of parsed.sourceDays) {
            const sourceIndex = weekBase + sourceDay;
            const original = originalByIndex.get(sourceIndex);
            replacements.set(sourceIndex, {
                ...original,
                dayIndex: sourceIndex,
                type: "rest",
                note: "",
                actionSets: [],
                actionSetsCount: 0,
            });
        }

        parsed.sourceDays.forEach((sourceDay, position) => {
            const targetDay = parsed.targetDays[position];
            const sourceIndex = weekBase + sourceDay;
            const targetIndex = weekBase + targetDay;
            const source = originalByIndex.get(sourceIndex);
            const target = originalByIndex.get(targetIndex);
            replacements.set(targetIndex, {
                ...target,
                type: source.type,
                note: source.note || "",
                actionSets: JSON.parse(JSON.stringify(source.actionSets || [])),
                actionSetsCount: source.actionSetsCount ?? source.actionSets?.length ?? 0,
                dayIndex: targetIndex,
            });
        });
    }

    const nextTrainingDays = originalDays.map((day: any) =>
        replacements.get(Number(day?.dayIndex || 0)) || day,
    );
    return {
        matched: true,
        applied: true,
        terminal: true,
        actionPlan: `已将第 ${parsed.weekStart}-${parsed.weekEnd} 周的训练日从 D${parsed.sourceDays.join("/D")} 搬移到 D${parsed.targetDays.join("/D")}，训练内容按顺序完整保留。`,
        updatedTrainingDays: nextTrainingDays,
    };
}

export function tryApplyDeterministicBatchEdit(params: {
    instruction: string;
    trainingDays: any[];
    actions: ActionLite[];
}): DeterministicEditResult {
    const { instruction, trainingDays, actions } = params;
    const parsedScheduleMove = parseMoveWeeklyScheduleInstruction(instruction, trainingDays);
    if (parsedScheduleMove) {
        return applyMoveWeeklyScheduleInstruction(parsedScheduleMove, trainingDays);
    }

    const parsedDelete = parseDeleteNthOccurrenceInstruction(instruction);
    if (parsedDelete) {
        return applyDeleteNthOccurrenceInstruction(parsedDelete, trainingDays, actions);
    }

    const parsed = parseReplaceLastOccurrenceInstruction(instruction, actions);
    if (!parsed) {
        return {
            matched: false,
            applied: false,
            updatedTrainingDays: trainingDays,
        };
    }

    const actionMap = new Map(actions.map((action) => [String(action.id), action]));
    const replacementAction = findBestActionByMention(parsed.replacementActionName, actions);
    const replacementActionId =
        replacementAction?.id ||
        `pending:${normalizeActionNameForMatch(parsed.replacementActionName).slice(0, 48) || "unnamed"}`;
    const replacementItemType = replacementAction
        ? normalizeItemType(replacementAction.type)
        : "STRENGTH";

    const nextTrainingDays = JSON.parse(JSON.stringify(trainingDays || []));
    let affectedDays = 0;
    let affectedSets = 0;

    for (const day of nextTrainingDays) {
        const dayIndex = Number(day?.dayIndex || 0);
        if (!dayIndex || day?.type !== "training" || !Array.isArray(day?.actionSets)) continue;

        const { week, dayOfWeek } = getWeekDayMeta(dayIndex);
        if (week < parsed.weekStart || week > parsed.weekEnd || dayOfWeek !== parsed.dayOfWeek) continue;

        const matchingIndexes = (day.actionSets || [])
            .map((set: any, index: number) => ({
                index,
                actionName: extractActionNameFromSet(set, actionMap),
            }))
            .filter((entry: { index: number; actionName: string }) =>
                matchesActionMention(entry.actionName, parsed.sourceActionName),
            )
            .map((entry: { index: number }) => entry.index);

        if (matchingIndexes.length < parsed.occurrenceFromEnd) continue;

        const targetIndexes = matchingIndexes.slice(-parsed.occurrenceFromEnd);
        for (const targetIndex of targetIndexes) {
            const currentSet = day.actionSets[targetIndex];
            const nextParams = { ...(currentSet?.params || {}) } as Record<string, any>;
            nextParams.action_name = replacementAction?.name || parsed.replacementActionName;
            if (parsed.sets !== undefined) nextParams.sets = parsed.sets;
            if (parsed.reps !== undefined) nextParams.reps = parsed.reps;
            if (parsed.rm !== undefined) {
                const currentIntensityConfig =
                    nextParams.intensityConfig && typeof nextParams.intensityConfig === "object"
                        ? nextParams.intensityConfig
                        : {};
                nextParams.intensityConfig = {
                    ...currentIntensityConfig,
                    relativeIntensity: {
                        type: "rm",
                        value: parsed.rm,
                    },
                };
                nextParams["强度"] = parsed.rm;
            }

            day.actionSets[targetIndex] = {
                ...currentSet,
                actionId: replacementActionId,
                itemType: replacementItemType,
                params: nextParams,
            };
            affectedSets += 1;
        }

        if (targetIndexes.length > 0) {
            affectedDays += 1;
        }
    }

    if (affectedSets === 0) {
        return {
            matched: true,
            applied: false,
            updatedTrainingDays: trainingDays,
            reason: `已识别到“第${parsed.weekStart}周到第${parsed.weekEnd}周第${parsed.dayOfWeek}天里最后${parsed.occurrenceFromEnd}次${parsed.sourceActionName}替换为${parsed.replacementActionName}”的规则，但目标范围内没有命中可替换动作。`,
        };
    }

    const actionPlan = `已按规则将第${parsed.weekStart}周到第${parsed.weekEnd}周第${parsed.dayOfWeek}天中最后${parsed.occurrenceFromEnd}次${parsed.sourceActionName}替换为${parsed.replacementActionName}，共命中 ${affectedDays} 天 / ${affectedSets} 处。`;

    return {
        matched: true,
        applied: true,
        actionPlan,
        updatedTrainingDays: nextTrainingDays,
    };
}

function parseDeleteNthOccurrenceInstruction(
    instruction: string,
): ParsedDeleteNthOccurrenceInstruction | null {
    const text = String(instruction || "").replace(/\s+/g, " ").trim();
    if (!text) return null;

    const weekRangeMatch = text.match(/第\s*(\d+)\s*周\s*(?:到|至|~|～|-|—)\s*第?\s*(\d+)\s*周/);
    const singleWeekMatch = text.match(/第\s*(\d+)\s*周/);
    const explicitDays = Array.from(text.matchAll(/\bD(\d+)\b/gi)).map((match) => Number(match[1]));
    const countEqualsMatch = text.match(/出现了?\s*(\d+)\s*次/);
    const deleteNthMatch = text.match(/(?:去掉|删除)\s*第\s*(\d+)\s*次/);

    if (!countEqualsMatch || !deleteNthMatch) return null;

    const weekStart = weekRangeMatch ? Number(weekRangeMatch[1]) : Number(singleWeekMatch?.[1] || 0);
    const weekEnd = weekRangeMatch ? Number(weekRangeMatch[2]) : weekStart;
    const dayOfWeeks = Array.from(new Set(explicitDays.filter((day) => Number.isFinite(day) && day >= 1 && day <= 7)));
    const occurrenceCountEquals = Number(countEqualsMatch[1]);
    const deleteOccurrenceIndex = Number(deleteNthMatch[1]);

    if (!weekStart || !weekEnd || dayOfWeeks.length === 0 || !occurrenceCountEquals || !deleteOccurrenceIndex) {
        return null;
    }

    const countIndex = countEqualsMatch.index ?? -1;
    const deleteIndex = deleteNthMatch.index ?? -1;
    if (countIndex < 0 || deleteIndex < 0 || deleteIndex <= countIndex) return null;

    const between = text
        .slice(countIndex + countEqualsMatch[0].length, deleteIndex)
        .replace(/如果/g, "")
        .replace(/了/g, "")
        .trim();
    const actionName = sanitizeActionName(between);
    if (!actionName) return null;

    return {
        weekStart,
        weekEnd,
        dayOfWeeks,
        occurrenceCountEquals,
        deleteOccurrenceIndex,
        actionName,
    };
}

function applyDeleteNthOccurrenceInstruction(
    parsed: ParsedDeleteNthOccurrenceInstruction,
    trainingDays: any[],
    actions: ActionLite[],
): DeterministicEditResult {
    const actionMap = new Map(actions.map((action) => [String(action.id), action]));
    const nextTrainingDays = JSON.parse(JSON.stringify(trainingDays || []));
    let affectedDays = 0;
    let affectedSets = 0;

    for (const day of nextTrainingDays) {
        const dayIndex = Number(day?.dayIndex || 0);
        if (!dayIndex || day?.type !== "training" || !Array.isArray(day?.actionSets)) continue;

        const { week, dayOfWeek } = getWeekDayMeta(dayIndex);
        if (
            week < parsed.weekStart ||
            week > parsed.weekEnd ||
            !parsed.dayOfWeeks.includes(dayOfWeek)
        ) {
            continue;
        }

        const matchingIndexes = (day.actionSets || [])
            .map((set: any, index: number) => ({
                index,
                actionName: extractActionNameFromSet(set, actionMap),
            }))
            .filter((entry: { index: number; actionName: string }) =>
                matchesActionMention(entry.actionName, parsed.actionName),
            )
            .map((entry: { index: number }) => entry.index);

        if (matchingIndexes.length !== parsed.occurrenceCountEquals) continue;
        if (parsed.deleteOccurrenceIndex > matchingIndexes.length) continue;

        const targetIndex = matchingIndexes[parsed.deleteOccurrenceIndex - 1];
        day.actionSets.splice(targetIndex, 1);
        affectedDays += 1;
        affectedSets += 1;
    }

    if (affectedSets === 0) {
        return {
            matched: true,
            applied: false,
            updatedTrainingDays: trainingDays,
            reason: `已识别到“第${parsed.weekStart}周到第${parsed.weekEnd}周的 D${parsed.dayOfWeeks.join("/D")} 中若 ${parsed.actionName} 恰好出现 ${parsed.occurrenceCountEquals} 次，则删除第 ${parsed.deleteOccurrenceIndex} 次”的规则，但目标范围内没有命中可删除动作。`,
        };
    }

    return {
        matched: true,
        applied: true,
        actionPlan: `已按规则删除第${parsed.weekStart}周到第${parsed.weekEnd}周的 D${parsed.dayOfWeeks.join("/D")} 中，恰好出现 ${parsed.occurrenceCountEquals} 次的 ${parsed.actionName} 的第 ${parsed.deleteOccurrenceIndex} 次，共命中 ${affectedDays} 天 / ${affectedSets} 处。`,
        updatedTrainingDays: nextTrainingDays,
    };
}
