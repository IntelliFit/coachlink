import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "../../auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";
import type { GetWithExecutionsDto, GetWithExecutionsResponseDto } from "./entity";

/**
 * GET /api/plan-lib/get-with-executions
 *
 * Fetches the user's current plan instance with all execution data
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<GetWithExecutionsResponseDto>>(
                { success: false, message: "未登录", data: null },
                { status: 401 },
            );
        }

        const userId = session.user.id;
        const {
            subscriptionId
        } = req.json() as GetWithExecutionsDto;

        // 1. Get user's active subscription if not provided
        let activeSub: any = null;
        if (subscriptionId) {
            const { data: sub } = await supabase
                .from("coach_subscriptions")
                .select("id, coach_id, status")
                .eq("id", subscriptionId)
                .eq("student_id", userId)
                .single();
            activeSub = sub;
        } else {
            const { data: subs } = await supabase
                .from("coach_subscriptions")
                .select("id, coach_id, status")
                .eq("student_id", userId)
                .eq("status", "active")
                .order("created_at", { ascending: false })
                .limit(1);
            activeSub = subs?.[0];
        }

        if (!activeSub) {
            return NextResponse.json<ApiData<GetWithExecutionsResponseDto>>(
                { success: false, message: "未找到有效订阅", data: null },
                { status: 404 },
            );
        }

        // 2. Get plan instance for this subscription
        const { data: instance } = await supabase
            .from("coach_plan_instances")
            .select("*")
            .eq("coach_subscription_id", activeSub.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (!instance) {
            return NextResponse.json<ApiData<GetWithExecutionsResponseDto>>(
                { success: false, message: "未找到训练计划", data: null },
                { status: 404 },
            );
        }

        // 3. Get all executions for this instance
        const { data: executions } = await supabase
            .from("plan_instance_executions")
            .select("*")
            .eq("instance_id", instance.id)
            .order("started_at", { ascending: false });

        // Build executions map by dayIndex (most recent execution for each day)
        const executionsMap: Record<number, any> = {};
        if (executions) {
            for (const exec of executions) {
                // Keep only most recent execution per day
                if (!executionsMap[exec.dayIndex]) {
                    executionsMap[exec.dayIndex] = exec;
                }
            }
        }

        // 4. Get videos for all executions
        const executionIds = executions?.map((e) => e.id) || [];
        let videosMap: Record<string, any[]> = {};

        if (executionIds.length > 0) {
            const { data: videos } = await supabase
                .from("execution_set_videos")
                .select("*")
                .in("execution_id", executionIds);

            if (videos) {
                for (const video of videos) {
                    const key =
                        `${video.execution_id}:${video.action_id}:${video.set_number}`;
                    if (!videosMap[key]) {
                        videosMap[key] = [];
                    }
                    videosMap[key].push(video);
                }
            }
        }

        // 5. Enrich execution action_executions with video_url from videos table
        for (const dayIndex of Object.keys(executionsMap)) {
            const exec = executionsMap[parseInt(dayIndex)];
            if (
                exec.action_executions && Array.isArray(exec.action_executions)
            ) {
                for (const actionExec of exec.action_executions) {
                    if (actionExec.sets && Array.isArray(actionExec.sets)) {
                        for (const set of actionExec.sets) {
                            const key =
                                `${exec.id}:${actionExec.action_id}:${set.set_number}`;
                            const videoRecords = videosMap[key];
                            if (videoRecords && videoRecords.length > 0) {
                                set.video_url = videoRecords[0].video_url;
                                set.has_video = true;
                            }
                        }
                    }
                }
            }
        }

        // 6. Get action details from coach_actions
        const trainingDays = (instance.training_days as any[]) || [];
        const actionIds = new Set<string>();
        for (const day of trainingDays) {
            if (day.actionSets && Array.isArray(day.actionSets)) {
                for (const actionSet of day.actionSets) {
                    if (actionSet.action_id) {
                        actionIds.add(actionSet.action_id);
                    }
                }
            }
        }

        let actionsMap: Record<string, any> = {};
        if (actionIds.size > 0) {
            const { data: actions } = await supabase
                .from("coach_actions")
                .select("id, name, detail, url, target_body_part")
                .in("id", Array.from(actionIds));

            if (actions) {
                for (const action of actions) {
                    actionsMap[action.id] = action;
                }
            }
        }

        return NextResponse.json<ApiData<GetWithExecutionsResponseDto>>({
            success: true,
            message: "获取训练计划执行数据成功",
            data: {
                instance,
                training_days: trainingDays,
                executions: executionsMap,
                actions: actionsMap,
            },
        });
    } catch (error) {
        console.error("获取训练计划执行数据失败:", error);
        return NextResponse.json<ApiData<GetWithExecutionsResponseDto>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}