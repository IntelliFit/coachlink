import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { Current1RMRecord, GetCurrent1RMDto, GetCurrent1RMResponseDto } from "./entity";

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "未登录", data: null },
            { status: 401 },
        );
    }

    const currentUserId = session.user.id;

    const {
        actionIds,
        actionNames,
        targetUserId
    } = await request.json() as GetCurrent1RMDto;

    let queryUserId = currentUserId;

    // If targetUserId is provided, verify coach-student relationship
    if (targetUserId && targetUserId !== currentUserId) {
        // First, get the coach record for the current user (coach_subscriptions.coach_id references coaches.id, not users.id)
        const { data: coachRecord } = await supabase
            .from("coaches")
            .select("id")
            .eq("user_id", currentUserId)
            .maybeSingle();

        console.log("[get-current-1rm] 🔐 Coach lookup:", {
            user_id: currentUserId,
            coaches_id: coachRecord?.id,
        });

        if (coachRecord) {
            const { data: subscription, error: subError } = await supabase
                .from("coach_subscriptions")
                .select("id, coach_id, student_id")
                .eq("coach_id", coachRecord.id) // Use coaches.id, not users.id
                .eq("student_id", targetUserId)
                .maybeSingle();

            console.log("[get-current-1rm] 🔐 Subscription check:", {
                subscription,
                error: subError?.message,
                coach_id: coachRecord.id,
                student_id: targetUserId,
            });

            if (subscription) {
                queryUserId = targetUserId;
                console.log(
                    "[get-current-1rm] ✅ Authorized to query student:",
                    targetUserId,
                );
            } else {
                console.warn(
                    `Unauthorized attempt to access PRs of ${targetUserId} by ${currentUserId}`,
                );
            }
        } else {
            console.warn(`User ${currentUserId} is not a coach`);
        }
    }

    // Build query for current PRs (highest e1rm per action)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = supabase
            .from("personal_records_history")
            .select(
                "action_id, exercise_name, e1rm, weight, reps, date_achieved, is_auto_calculated",
            )
            .eq("user_id", queryUserId)
            .not("e1rm", "is", null)
            .order("e1rm", { ascending: false });

    // Filter by action IDs if provided
    if (actionIds && actionIds.length > 0) {
        query = query.in("action_id", actionIds);
    }

    // Filter by action names if provided
    if (actionNames && actionNames.length > 0) {
        query = query.in("exercise_name", actionNames);
    }

    const { data: prData, error: prError } = await query;

    console.log(
        "[get-current-1rm] 📊 Found",
        prData?.length || 0,
        "PR records for user:",
        queryUserId,
    );

    if (prError) {
        console.error("获取PR历史失败:", prError);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "获取失败", data: null },
            { status: 500 },
        );
    }

    // Also fetch questionnaire data from coach_subscriptions
    // This contains the initial 1RM values set by coach/student
    const { data: subscriptions } = await supabase
        .from("coach_subscriptions")
        .select("subscribe_data")
        .eq("student_id", queryUserId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

    // Extract RM data from questionnaire
    const questionnaireRMData: Record<string, number> = {};
    if (subscriptions?.subscribe_data) {
        const subscribeData = subscriptions.subscribe_data as any[];
        const rmItem = subscribeData.find((item: any) =>
            item.type === "rm"
        );
        if (rmItem?.userInputs) {
            // userInputs is { actionId: rmValue, ... }
            for (
                const [actionId, rmValue] of Object.entries(
                    rmItem.userInputs,
                )
            ) {
                if (typeof rmValue === "number" && rmValue > 0) {
                    questionnaireRMData[actionId] = rmValue;
                }
            }
        }
    }

    console.log(
        "[get-current-1rm] 📋 Questionnaire RM data:",
        Object.keys(questionnaireRMData).length,
        "actions",
    );

    // Group by action and keep only the highest e1RM for each
    const recordsByAction = new Map<string, Current1RMRecord>();

    // First, add PR records
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const record of (prData || []) as any[]) {
        const key = record.action_id || record.exercise_name;
        const existing = recordsByAction.get(key);
        const e1rmValue = record.e1rm;

        // Keep the record with the highest e1rm
        if (e1rmValue && (!existing || e1rmValue > existing.current1RM)) {
            recordsByAction.set(key, {
                actionId: record.action_id,
                actionName: record.exercise_name,
                current1RM: e1rmValue,
                lastUpdated: record.date_achieved,
                isAutoCalculated: record.is_auto_calculated || false,
            });
        }
    }

    // Then, merge with questionnaire data (take max)
    for (const [actionId, rmValue] of Object.entries(questionnaireRMData)) {
        const existing = recordsByAction.get(actionId);
        if (!existing) {
            // No PR record, use questionnaire value
            recordsByAction.set(actionId, {
                actionId: actionId,
                actionName: actionId, // Will be resolved by caller if needed
                current1RM: rmValue,
                lastUpdated: new Date().toISOString(),
                isAutoCalculated: false,
            });
        } else if (rmValue > existing.current1RM) {
            // Questionnaire value is higher than PR, use questionnaire
            recordsByAction.set(actionId, {
                ...existing,
                current1RM: rmValue,
                isAutoCalculated: false, // Questionnaire is manual input
            });
        }
        // If PR is higher, keep PR (do nothing)
    }

    const records = Array.from(recordsByAction.values());

    console.log(
        "[get-current-1rm] ✅ Returning",
        records.length,
        "aggregated records:",
        records.map((r) => ({
            action: r.actionName || r.actionId,
            "1RM": r.current1RM,
        })),
    );

    return NextResponse.json<ApiData<GetCurrent1RMResponseDto>>({
        success: true,
        message: "获取成功",
        data: { records },
    });
}
