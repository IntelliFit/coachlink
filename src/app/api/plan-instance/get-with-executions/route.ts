import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";

interface GetWithExecutionsResponse {
    success: boolean;
    message?: string;
    data?: {
        instance: any;
        training_days: any[];
        executions: Record<number, any>; // keyed by day_index
        actions: Record<string, any>;
    };
}

/**
 * GET /api/plan-instance/get-with-executions
 *
 * Fetches the user's current plan instance with all execution data
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json<GetWithExecutionsResponse>(
                { success: false, message: "未登录" },
                { status: 401 },
            );
        }

        const userId = session.user.id;
        const { searchParams } = new URL(request.url);
        const subscriptionId = searchParams.get("subscriptionId");

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
            return NextResponse.json<GetWithExecutionsResponse>(
                { success: false, message: "未找到有效订阅" },
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
            return NextResponse.json<GetWithExecutionsResponse>(
                { success: false, message: "未找到训练计划" },
                { status: 404 },
            );
        }

        // 3. Get all executions for this instance
        const { data: executions } = await supabase
            .from("plan_instance_executions")
            .select("*")
            .eq("instance_id", instance.id)
            .order("started_at", { ascending: false });

        // Build executions map by day_index (most recent execution for each day)
        const executionsMap: Record<number, any> = {};
        if (executions) {
            for (const exec of executions) {
                // Keep only most recent execution per day
                if (!executionsMap[exec.day_index]) {
                    executionsMap[exec.day_index] = exec;
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
        const trainingDays = instance.training_days || [];
        const actionIds = new Set<string>();
        for (const day of trainingDays) {
            if (day.action_sets && Array.isArray(day.action_sets)) {
                for (const actionSet of day.action_sets) {
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

        return NextResponse.json<GetWithExecutionsResponse>({
            success: true,
            data: {
                instance,
                training_days: trainingDays,
                executions: executionsMap,
                actions: actionsMap,
            },
        });
    } catch (error) {
        console.error("获取训练计划执行数据失败:", error);
        return NextResponse.json<GetWithExecutionsResponse>(
            { success: false, message: "服务器错误" },
            { status: 500 },
        );
    }
}
