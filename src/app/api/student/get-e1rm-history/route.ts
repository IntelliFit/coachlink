import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import {
    calculateE1RM,
    E1RMCalculationParams,
    requiresBodyWeightFallback,
} from "@/lib/e1rmCalculator";

// Request DTO
export interface GetE1RMHistoryDto {
    actionId?: string;
    actionName?: string; // Optional fallback
    startDate?: string;
    endDate?: string;
    limit?: number;
}

// Response DTO
export interface E1RMHistoryPoint {
    date: string;
    e1rm: number;
    isPR: boolean; // Computed dynamically
    source: "initial" | "execution" | "manual_pr";
    weight?: number;
    reps?: number;
}

export interface GetE1RMHistoryResponseDto {
    history: E1RMHistoryPoint[];
    currentPR?: number;
}

/**
 * POST /api/student/get-e1rm-history
 *
 * Aggregates e1RM history from 3 sources:
 * 1. Initial 1RM (Onboarding Questionnaire)
 * 2. Daily Training Executions (plan_instance_executions -> JSONB)
 * 3. Manual PR Records (personal_records_history)
 *
 * It reconstructs the full progression curve and dynamically identifying PR points (stars).
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "未登录", data: null },
                { status: 401 },
            );
        }

        const userId = session.user.id;
        const body: GetE1RMHistoryDto = await request.json();
        const { actionId, startDate, endDate } = body;

        if (!actionId) {
            return NextResponse.json<ApiData<null>>(
                {
                    success: false,
                    message: "Action ID is required",
                    data: null,
                },
                { status: 400 },
            );
        }

        // 1. Fetch Action Details (Name & BodyWeight Prop)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: actionData } = await (supabase as any)
            .from("coach_actions")
            .select('name, "includesBodyWeight"')
            .eq("id", actionId)
            .single();

        let actionName = actionData?.name || body.actionName;
        // If we still don't have a name, we can't find it in JSON or Questionnaire
        if (!actionName) {
            // Try to fetch from old personal_records_history to see if we can find a name for this ID?
            // Or just return empty
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "Unknown Action", data: null },
                { status: 404 },
            );
        }

        // Resolve includesBodyWeight
        let includeBodyWeight = false;
        if (actionData?.includesBodyWeight !== undefined) {
            includeBodyWeight = actionData.includesBodyWeight;
        } else {
            includeBodyWeight = requiresBodyWeightFallback(actionName);
        }

        const allPoints: E1RMHistoryPoint[] = [];

        // ------------------------------------------------------------------
        // Source 1: Initial 1RM from Onboarding Questionnaire
        // ------------------------------------------------------------------
        const { data: questionnaire } = await supabase
            .from("onboarding_questionnaires")
            .select("answers, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (
            questionnaire && questionnaire.answers &&
            Array.isArray(questionnaire.answers)
        ) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const answers = questionnaire.answers as any[];
            const rmQuestions = answers.filter((q: any) =>
                q.type === "rm" && q.userInputs
            );

            for (const q of rmQuestions) {
                if (q.userInputs && q.userInputs[actionName]) {
                    const weight = Number(q.userInputs[actionName]);
                    if (weight > 0) {
                        allPoints.push({
                            date:
                                new Date(questionnaire.created_at).toISOString()
                                    .split("T")[0],
                            e1rm: weight,
                            isPR: false, // will calculate later
                            source: "initial",
                            weight: weight,
                            reps: 1,
                        });
                    }
                }
            }
        }

        // ------------------------------------------------------------------
        // Source 2: Daily Executions from plan_instance_executions
        // ------------------------------------------------------------------
        // We need to scan executions to find sets for this action
        // Optimization: Filter by date range if possible, but JSONB filtering is hard.
        // We fetch basic fields and process in-memory.
        // Limit to reasonable number of recent executions? Or page?
        // For a single user, fetching 100-200 recent executions is fine.
        let execQuery = supabase
            .from("plan_instance_executions")
            .select("id, action_executions, updated_at, created_at")
            .eq("student_id", userId)
            .order("created_at", { ascending: true }); // Process chronologically

        if (startDate) execQuery = execQuery.gte("created_at", startDate);

        const { data: executions } = await execQuery;

        if (executions) {
            // Get user profile once for calc fallback
            let userWeight = 0;
            if (includeBodyWeight) {
                const { data: profile } = await supabase
                    .from("user_profiles")
                    .select("weight")
                    .eq("user_id", userId)
                    .single();
                userWeight = profile?.weight || 0;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            executions.forEach((exec: any) => {
                if (
                    !exec.action_executions ||
                    !Array.isArray(exec.action_executions)
                ) return;

                // Find matching action(s) in this session
                // Match by ID preferred, falling back to Name
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const actionExecs = exec.action_executions.filter((ae: any) =>
                    ae.action_id === actionId ||
                    ae.action_name === actionName || ae.name === actionName
                );

                if (actionExecs.length === 0) return;

                // For each execution of this action, find the best set
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                actionExecs.forEach((ae: any) => {
                    if (!ae.sets || !Array.isArray(ae.sets)) return;

                    let bestSetForSession = { e1rm: 0, weight: 0, reps: 0 };
                    let sessionDate = exec.updated_at
                        ? exec.updated_at.split("T")[0]
                        : "";

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ae.sets.forEach((set: any) => {
                        if (set.status !== "completed" && !set.actual_weight) {
                            return; // Only count completed sets
                        }

                        const w = Number(set.actual_weight);
                        const r = Number(set.actual_reps);

                        if (w > 0 && r > 0) {
                            // Determine date: prefer set completed_at, then exec updated_at, then exec created_at
                            if (set.completed_at) {
                                sessionDate = set.completed_at.split("T")[0];
                            } else if (!sessionDate) {
                                sessionDate = exec.created_at.split("T")[0];
                            }

                            // Use stored e1rm or calculate it
                            let currentE1RM = Number(set.e1rm);
                            if (!currentE1RM || isNaN(currentE1RM)) {
                                // Calculate on the fly
                                const calc = calculateE1RM({
                                    weight: w,
                                    reps: r,
                                    bodyWeight: userWeight,
                                    includeBodyWeight,
                                });
                                currentE1RM = calc.e1rm;
                            }

                            if (currentE1RM > bestSetForSession.e1rm) {
                                bestSetForSession = {
                                    e1rm: currentE1RM,
                                    weight: w,
                                    reps: r,
                                };
                            }
                        }
                    });

                    if (bestSetForSession.e1rm > 0 && sessionDate) {
                        allPoints.push({
                            date: sessionDate,
                            e1rm: bestSetForSession.e1rm,
                            isPR: false, // calculate later
                            source: "execution",
                            weight: bestSetForSession.weight,
                            reps: bestSetForSession.reps,
                        });
                    }
                });
            });
        }

        // ------------------------------------------------------------------
        // Source 3: Manual PRs from History (for fallback/imported data)
        // ------------------------------------------------------------------
        // We fetch these to ensure we don't miss any manually entered records
        const { data: manualRecords } = await supabase
            .from("personal_records_history")
            .select("date_achieved, e1rm, weight, reps, is_auto_calculated")
            .eq("user_id", userId)
            //.eq("action_id", actionId) // Some old records might miss action_id
            .or(`action_id.eq.${actionId},exercise_name.eq.${actionName}`);

        if (manualRecords) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            manualRecords.forEach((rec: any) => {
                // If it's auto-calculated, we likely picked it up in Source 2 (Executions).
                // But to be safe, we can add it, and deduplication will handle it.
                // However, user specifically said history table is for "PRs only".
                // So these points are valid PRs.
                if (rec.e1rm > 0) {
                    allPoints.push({
                        date: rec.date_achieved,
                        e1rm: rec.e1rm,
                        isPR: false, // calculate later
                        source: "manual_pr",
                        weight: rec.weight,
                        reps: rec.reps,
                    });
                }
            });
        }

        // ------------------------------------------------------------------
        // Merge & Sort & Compute PRs
        // ------------------------------------------------------------------

        // 1. Deduplicate by Date: take the MAX e1rm for that date
        const dateMap = new Map<string, E1RMHistoryPoint>();

        allPoints.forEach((p) => {
            const existing = dateMap.get(p.date);
            if (!existing || p.e1rm > existing.e1rm) {
                dateMap.set(p.date, p);
            }
        });

        const sortedPoints = Array.from(dateMap.values())
            .sort((a, b) =>
                new Date(a.date).getTime() - new Date(b.date).getTime()
            );

        // 2. Compute PR flags dynamically
        // Identify peaks in the curve
        let runningMax = 0;
        let globalMax = 0;

        sortedPoints.forEach((p) => {
            // A point is a PR if it strictly exceeds the previous max
            // Exception: The very first point (Initial) is typically considering the baseline "PR"
            if (p.e1rm > runningMax) {
                p.isPR = true;
                runningMax = p.e1rm;
            } else {
                p.isPR = false;
            }
            if (p.e1rm > globalMax) globalMax = p.e1rm;
        });

        // Filter date range if needed (after computing PRs to maintain runningMax correctness)
        const filteredPoints = sortedPoints.filter((p) => {
            if (startDate && p.date < startDate) return false;
            if (endDate && p.date > endDate) return false;
            return true;
        });

        return NextResponse.json<ApiData<GetE1RMHistoryResponseDto>>({
            success: true,
            message: "获取成功",
            data: {
                history: filteredPoints,
                currentPR: globalMax > 0 ? globalMax : undefined,
            },
        });
    } catch (error: any) {
        console.error("获取e1RM历史失败:", error);
        return NextResponse.json<ApiData<null>>(
            {
                success: false,
                message: error.message || "服务器错误",
                data: null,
            },
            { status: 500 },
        );
    }
}
