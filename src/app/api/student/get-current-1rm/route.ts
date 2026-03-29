import { NextRequest, NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { getAuthUser } from "@/lib/auth";
import type { ApiData } from "@/types/api";
import { Current1RMRecord, GetCurrent1RMDto, GetCurrent1RMResponseDto } from "./entity";
import { isOneRMEligibleAction } from "@/lib/oneRmEligibility";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: string) => UUID_REGEX.test(value);
const isLegacyQuestionnaireIndex = (value: string) => /^\d+$/.test(value);
const normalizeNameKey = (value: string) => String(value || "").trim().toLowerCase();
const isInvalidActionName = (value?: string | null) => {
    const text = String(value || "").trim();
    return !text || isUuid(text) || isLegacyQuestionnaireIndex(text);
};

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
    // 这里必须使用 service-role client：
    // 该函数会被多个服务端路由复用，并且需要在服务端完成显式权限校验后，
    // 读取目标学员的 student_actions / personal_records_history。
    // 若走匿名 client，服务端没有附带 Supabase auth context，会退化为只拿到问卷兜底数据，
    // 造成计划重量整体偏小并回落到旧值。
    const { actionIds, actionNames, targetUserId, preferPR = true } = params;
    const hasActionIdFilter = Array.isArray(actionIds) && actionIds.length > 0;
    const hasActionNameFilter =
        Array.isArray(actionNames) && actionNames.length > 0;
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
    const buildPrQuery = () =>
        supabase
            .from("personal_records_history")
            .select(
                "action_id, exercise_name, e1rm, date_achieved, created_at, is_auto_calculated, notes",
            )
            .eq("user_id", queryUserId)
            .not("e1rm", "is", null)
            // For "current state", we want the latest record, not the max.
            .order("date_achieved", { ascending: false })
            .order("created_at", { ascending: false });

    const buildStudentActionsQuery = () =>
        supabase
            .from("student_actions")
            .select(
                'id, name, canonical_action_id, reference_1rm, type, attrs, "enableAutoWeightCompute", updated_at',
            )
            .eq("user_id", queryUserId)
            .not("reference_1rm", "is", null);

    const fetchPrRows = async () => {
        if (hasActionIdFilter && hasActionNameFilter) {
            const [byIdResult, byNameResult] = await Promise.all([
                buildPrQuery().in("action_id", actionIds!),
                buildPrQuery().in("exercise_name", actionNames!),
            ]);
            if (byIdResult.error) throw byIdResult.error;
            if (byNameResult.error) throw byNameResult.error;

            const seen = new Set<string>();
            const merged: any[] = [];
            for (const row of [
                ...(byIdResult.data || []),
                ...(byNameResult.data || []),
            ]) {
                const key = [
                    row.action_id || "",
                    row.exercise_name || "",
                    row.date_achieved || "",
                    row.created_at || "",
                    row.notes || "",
                ].join("|");
                if (seen.has(key)) continue;
                seen.add(key);
                merged.push(row);
            }
            return merged;
        }

        if (hasActionIdFilter) {
            const result = await buildPrQuery().in("action_id", actionIds!);
            if (result.error) throw result.error;
            return result.data || [];
        }

        if (hasActionNameFilter) {
            const result = await buildPrQuery().in("exercise_name", actionNames!);
            if (result.error) throw result.error;
            return result.data || [];
        }

        const result = await buildPrQuery();
        if (result.error) throw result.error;
        return result.data || [];
    };

    const fetchStudentActionRows = async () => {
        if (hasActionIdFilter && hasActionNameFilter) {
            const [byIdResult, byNameResult] = await Promise.all([
                buildStudentActionsQuery().in("id", actionIds!),
                buildStudentActionsQuery().in("name", actionNames!),
            ]);
            if (byIdResult.error) {
                console.warn("[get-current-1rm] student_actions by id failed:", byIdResult.error);
            }
            if (byNameResult.error) {
                console.warn("[get-current-1rm] student_actions by name failed:", byNameResult.error);
            }
            const mergedMap = new Map<string, any>();
            for (const row of [
                ...(byIdResult.data || []),
                ...(byNameResult.data || []),
            ]) {
                if (row?.id) mergedMap.set(row.id, row);
            }
            return Array.from(mergedMap.values());
        }

        if (hasActionIdFilter) {
            const result = await buildStudentActionsQuery().in("id", actionIds!);
            if (result.error) {
                console.warn("[get-current-1rm] student_actions by id failed:", result.error);
                return [];
            }
            return result.data || [];
        }

        if (hasActionNameFilter) {
            const result = await buildStudentActionsQuery().in("name", actionNames!);
            if (result.error) {
                console.warn("[get-current-1rm] student_actions by name failed:", result.error);
                return [];
            }
            return result.data || [];
        }

        const result = await buildStudentActionsQuery();
        if (result.error) {
            console.warn("[get-current-1rm] student_actions full scan failed:", result.error);
            return [];
        }
        return result.data || [];
    };

    const [prRows, studentActionRows, questionnaireResult] = await Promise.all([
        fetchPrRows(),
        fetchStudentActionRows(),
        supabase
            .from("coach_subscriptions")
            .select("subscribe_data, updated_at")
            .eq("student_id", queryUserId)
            .eq("status", "active")
            .maybeSingle(),
    ]);

    const studentActionNameById = new Map<string, string>();
    const studentActionCanonicalById = new Map<string, string>();
    const coachActionNameById = new Map<string, string>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (studentActionRows || []).forEach((action: any) => {
        const actionId = String(action?.id || "").trim();
        const actionName = String(action?.name || "").trim();
        const canonicalActionId = String(action?.canonical_action_id || "").trim();
        if (actionId && actionName) studentActionNameById.set(actionId, actionName);
        if (actionId && canonicalActionId) studentActionCanonicalById.set(actionId, canonicalActionId);
    });

    const prActionIds = Array.from(
        new Set(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (prRows || []).map((row: any) => String(row?.action_id || "").trim()).filter((id) => isUuid(id)),
        ),
    );
    if (prActionIds.length > 0) {
        const { data: coachActionRows, error: coachActionError } = await supabase
            .from("coach_actions")
            .select("id, name")
            .in("id", prActionIds);
        if (coachActionError) {
            console.warn("[get-current-1rm] resolve coach action names failed:", coachActionError);
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (coachActionRows || []).forEach((action: any) => {
                const actionId = String(action?.id || "").trim();
                const actionName = String(action?.name || "").trim();
                if (actionId && actionName) coachActionNameById.set(actionId, actionName);
            });
        }
    }

    type ActionLibraryPayload = {
        value: number;
        updatedAt?: string;
        canonicalActionId?: string;
        actionId?: string;
        actionName?: string;
    };

    // 3. 学员动作库 reference_1rm（用于历史不足时兜底，同时提供动作名映射）
    const actionLibraryRMMap: Record<string, ActionLibraryPayload> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (studentActionRows || []).forEach((action: any) => {
        const rm = Number(action.reference_1rm);
        if (!Number.isFinite(rm) || rm <= 0) return;
        if (
            !isOneRMEligibleAction({
                type: action.type,
                attrs: action.attrs,
                enableAutoWeightCompute: action.enableAutoWeightCompute,
            })
        ) {
            return;
        }

        const actionId = String(action?.id || "").trim() || undefined;
        const actionName = String(action?.name || "").trim() || undefined;
        const canonicalActionId = String(action?.canonical_action_id || "").trim() || undefined;

        const payload: ActionLibraryPayload = {
            value: rm,
            updatedAt: action.updated_at as string | undefined,
            canonicalActionId,
            actionId,
            actionName,
        };
        if (actionId) actionLibraryRMMap[actionId] = payload;
        if (actionName) actionLibraryRMMap[actionName] = payload;
        if (canonicalActionId) actionLibraryRMMap[canonicalActionId] = payload;
    });

    // 4. 问卷 RM（仅作为最后兜底，不覆盖历史峰值）
    const questionnaireRMMap: Record<string, number> = {};
    const subscribeData = questionnaireResult.data?.subscribe_data as any[];
    const rmItem = subscribeData?.find((item) => item.type === "rm");
    const questionnaireUpdatedAtIso =
        (questionnaireResult.data as any)?.updated_at as string | undefined;

    if (rmItem?.userInputs) {
        Object.entries(rmItem.userInputs).forEach(([id, val]) => {
            if (typeof val === "number" && val > 0) questionnaireRMMap[id] = val;
        });
    }

    // 5. 历史聚合：
    // - preferPR=true：取该动作历史峰值（与“进步曲线最高点”一致）
    // - preferPR=false：取该动作最近一次（兼容旧调用）
    const recordsMap = new Map<string, Current1RMRecord>();
    const latestMap = new Map<string, Current1RMRecord>();
    const peakMap = new Map<string, Current1RMRecord>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prRows || []).forEach((record: any) => {
        const actionIdRaw = String(record?.action_id || "").trim();
        const actionId = isUuid(actionIdRaw) ? actionIdRaw : undefined;
        const rawActionName = String(record?.exercise_name || "").trim();
        const resolvedActionName =
            !isInvalidActionName(rawActionName)
                ? rawActionName
                : (
                    (actionId && studentActionNameById.get(actionId)) ||
                    (actionId && coachActionNameById.get(actionId)) ||
                    rawActionName
                );
        const actionName =
            !isInvalidActionName(resolvedActionName)
                ? resolvedActionName
                : (actionId || "未命名动作");
        const canonicalActionId = actionId ? studentActionCanonicalById.get(actionId) : undefined;
        const current1RM = Number(record?.e1rm);
        if (!Number.isFinite(current1RM) || current1RM <= 0) return;

        const key = actionId || `name:${normalizeNameKey(actionName)}`;
        if (!key) return;

        const item: Current1RMRecord = {
            actionId,
            actionName,
            canonicalActionId,
            current1RM,
            lastUpdated: record.date_achieved || record.created_at || new Date().toISOString(),
            isAutoCalculated: !!record.is_auto_calculated,
        };

        if (!latestMap.has(key)) {
            latestMap.set(key, item);
        }
        const existingPeak = peakMap.get(key);
        if (
            !existingPeak ||
            current1RM > Number(existingPeak.current1RM) ||
            (
                current1RM === Number(existingPeak.current1RM) &&
                new Date(item.lastUpdated).getTime() > new Date(existingPeak.lastUpdated).getTime()
            )
        ) {
            peakMap.set(key, item);
        }
    });

    const primaryMap = preferPR ? peakMap : latestMap;
    for (const [key, record] of primaryMap.entries()) {
        recordsMap.set(key, record);
    }

    // alias -> recordsMap key，便于将动作库 reference_1rm 对齐到历史记录对应动作
    const aliasIndex = new Map<string, string>();
    const bindAliases = (key: string, record: Current1RMRecord) => {
        if (record.actionId) aliasIndex.set(record.actionId, key);
        if (record.canonicalActionId) aliasIndex.set(record.canonicalActionId, key);
        const actionName = String(record.actionName || "").trim();
        if (!isInvalidActionName(actionName)) {
            aliasIndex.set(`name:${normalizeNameKey(actionName)}`, key);
        }
    };

    for (const [key, record] of recordsMap.entries()) {
        bindAliases(key, record);
    }

    // 合并动作库 reference_1rm（网站口径）：
    // - 动作库是当前配置主来源（允许手动上调/下调）
    // - 历史曲线用于同步与兜底
    const libraryRecordMap = new Map<string, Current1RMRecord>();
    Object.values(actionLibraryRMMap).forEach((payload) => {
        const actionName =
            !isInvalidActionName(payload.actionName)
                ? String(payload.actionName)
                : (
                    (payload.actionId && studentActionNameById.get(payload.actionId)) ||
                    (payload.actionId && coachActionNameById.get(payload.actionId)) ||
                    "未命名动作"
                );

        const key =
            payload.actionId ||
            payload.canonicalActionId ||
            (actionName ? `name:${normalizeNameKey(actionName)}` : "");
        if (!key) return;

        const candidate: Current1RMRecord = {
            actionId: payload.actionId,
            actionName,
            canonicalActionId: payload.canonicalActionId,
            current1RM: payload.value,
            lastUpdated: payload.updatedAt || new Date().toISOString(),
            isAutoCalculated: false,
        };
        libraryRecordMap.set(key, candidate);
    });

    for (const libraryRecord of libraryRecordMap.values()) {
        const aliasCandidates = [
            libraryRecord.actionId,
            libraryRecord.canonicalActionId,
            !isInvalidActionName(libraryRecord.actionName)
                ? `name:${normalizeNameKey(libraryRecord.actionName)}`
                : undefined,
        ].filter(Boolean) as string[];

        let targetKey: string | undefined;
        for (const alias of aliasCandidates) {
            const mapped = aliasIndex.get(alias);
            if (mapped) {
                targetKey = mapped;
                break;
            }
        }

        if (targetKey) {
            const existing = recordsMap.get(targetKey)!;
            const patched: Current1RMRecord = {
                ...existing,
                // 网站口径：动作库配置优先（不只升不降）
                current1RM: libraryRecord.current1RM,
                lastUpdated: libraryRecord.lastUpdated,
                isAutoCalculated: false,
            };
            if (!patched.actionId && libraryRecord.actionId) {
                patched.actionId = libraryRecord.actionId;
            }
            if (!patched.canonicalActionId && libraryRecord.canonicalActionId) {
                patched.canonicalActionId = libraryRecord.canonicalActionId;
            }
            if (isInvalidActionName(patched.actionName) && !isInvalidActionName(libraryRecord.actionName)) {
                patched.actionName = libraryRecord.actionName;
            }
            recordsMap.set(targetKey, patched);
            bindAliases(targetKey, patched);
        } else {
            const fallbackKey =
                libraryRecord.actionId ||
                libraryRecord.canonicalActionId ||
                `name:${normalizeNameKey(libraryRecord.actionName || "unknown")}`;
            recordsMap.set(fallbackKey, libraryRecord);
            bindAliases(fallbackKey, libraryRecord);
        }
    }

    // 问卷兜底：仅在前两层都没有数据时补齐
    Object.entries(questionnaireRMMap).forEach(([id, rmValue]) => {
        const normalizedKey = String(id || "").trim();
        if (!normalizedKey || isLegacyQuestionnaireIndex(normalizedKey)) return;

        if (hasActionIdFilter && !actionIds?.includes(normalizedKey)) return;
        if (hasActionNameFilter && !actionNames?.includes(normalizedKey)) return;

        const mapKey = isUuid(normalizedKey) ? normalizedKey : `name:${normalizeNameKey(normalizedKey)}`;
        if (!mapKey) return;

        const existing = recordsMap.get(mapKey);
        if (!existing) {
            const mappedName =
                !isInvalidActionName(normalizedKey)
                    ? normalizedKey
                    : (
                        (isUuid(normalizedKey) && studentActionNameById.get(normalizedKey)) ||
                        (isUuid(normalizedKey) && coachActionNameById.get(normalizedKey)) ||
                        "未命名动作"
                    );
            recordsMap.set(mapKey, {
                actionId: isUuid(normalizedKey) ? normalizedKey : undefined,
                actionName: mappedName,
                current1RM: rmValue,
                lastUpdated: questionnaireUpdatedAtIso || new Date().toISOString(),
                isAutoCalculated: false,
            });
            return;
        }

        if (isInvalidActionName(existing.actionName) && !isInvalidActionName(normalizedKey)) {
            recordsMap.set(mapKey, {
                ...existing,
                actionName: normalizedKey,
            });
        }
    });

    return Array.from(recordsMap.values())
        .map((record) => {
            let actionName = String(record.actionName || "").trim();
            if (isInvalidActionName(actionName)) {
                actionName =
                    (record.actionId && studentActionNameById.get(record.actionId)) ||
                    (record.actionId && coachActionNameById.get(record.actionId)) ||
                    (record.canonicalActionId && coachActionNameById.get(record.canonicalActionId)) ||
                    "未命名动作";
            }
            return {
                ...record,
                actionName,
            };
        })
        .filter((record) => Number(record.current1RM) > 0);
}

export async function POST(request: NextRequest) {
    const authResult = await getAuthUser(request);
    if (!authResult.isAuthenticated || !authResult.userId) {
        return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
    }

    const body = await request.json() as GetCurrent1RMDto;

    // 调用封装好的函数
    const records = await getCurrent1RMRecords(authResult.userId, body || {});

    return NextResponse.json<ApiData<GetCurrent1RMResponseDto>>({
        success: true,
        message: "获取成功",
        data: { records },
    });
}
