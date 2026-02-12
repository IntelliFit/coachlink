import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type { ActivityResponseDto } from "../../friends/entity";
import { differenceInMinutes } from "date-fns";

/**
 * GET /api/user/friends/activity
 *
 * 获取好友动态（最近完成的训练）
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "未登录" }, {
                status: 401,
            });
        }

        const userId = session.user.id;
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "20");

        // 1. 获取所有好友 ID
        const { data: friendships, error: friendError } = await supabase
            .from("social_friendships")
            .select("requester_id, addressee_id")
            .eq("status", "accepted")
            .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

        if (friendError) {
            console.error("Get friends for activity error:", friendError);
            return NextResponse.json({
                success: false,
                message: "获取好友失败",
            }, { status: 500 });
        }

        const friendIds = friendships.map((f: any) =>
            f.requester_id === userId ? f.addressee_id : f.requester_id
        );

        if (friendIds.length === 0) {
            return NextResponse.json<ActivityResponseDto>({
                success: true,
                data: { activities: [], nextCursor: undefined },
            });
        }

        // 2. 查询好友的完成训练记录 (plan_instance_executions)
        const { data: executions, error: execError } = await supabase
            .from("plan_instance_executions")
            .select(`
                id,
                completed_at,
                started_at,
                total_sets,
                completed_sets,
                share_token,
                status,
                visibility,
                student_id,
                coach_plan_instances:instance_id (name),
                day_index,
                action_executions
            `)
            .in("student_id", friendIds)
            .eq("status", "completed")
            .neq("visibility", "private") // 排除仅自己可见
            .order("completed_at", { ascending: false })
            .limit(limit);

        if (execError) {
            console.error("Get activities error:", execError);
            return NextResponse.json({
                success: false,
                message: "获取动态失败",
            }, { status: 500 });
        }

        if (!executions || executions.length === 0) {
            return NextResponse.json<ActivityResponseDto>({
                success: true,
                data: { activities: [], nextCursor: undefined },
            });
        }

        // 3. 批量获取用户信息
        const studentIds = [
            ...new Set(executions.map((ex: any) => ex.student_id)),
        ];
        const { data: profiles, error: profileError } = await supabase
            .from("user_profiles")
            .select("user_id, nickname, avatar_url")
            .in("user_id", studentIds);

        const profileMap = new Map();
        if (profiles) {
            profiles.forEach((p: any) => profileMap.set(p.user_id, p));
        }

        // 4. 格式化数据
        const activities = executions.map((ex: any) => {
            // 计算容量 + 找出亮点动作（最大重量的组）
            let totalVolume = 0;
            let highlight: { actionName: string; weight: number; reps: number } | null = null;
            let maxWeight = 0;

            if (ex.action_executions && Array.isArray(ex.action_executions)) {
                ex.action_executions.forEach((action: any) => {
                    if (action.sets && Array.isArray(action.sets)) {
                        action.sets.forEach((set: any) => {
                            if (
                                set.status === "completed" || set.completed_at
                            ) {
                                const weight = set.actual_weight || 0;
                                const reps = set.actual_reps || 0;
                                totalVolume += weight * reps;

                                // 找最大重量的组作为亮点
                                if (weight > maxWeight && reps > 0) {
                                    maxWeight = weight;
                                    highlight = {
                                        actionName: action.action_name || action.name || "动作",
                                        weight: weight,
                                        reps: reps,
                                    };
                                }
                            }
                        });
                    }
                });
            }

            const startDate = new Date(ex.started_at);
            const completedDate = ex.completed_at
                ? new Date(ex.completed_at)
                : new Date();
            const duration = differenceInMinutes(completedDate, startDate);

            const profile = profileMap.get(ex.student_id) || {};

            return {
                id: ex.id,
                user: {
                    userId: ex.student_id,
                    nickname: profile.nickname || "好友",
                    avatarUrl: profile.avatar_url,
                },
                execution: {
                    executionId: ex.id,
                    planName: ex.coach_plan_instances?.name || "未知计划",
                    dayIndex: ex.day_index || 0,
                    totalVolume: totalVolume,
                    durationMinutes: duration,
                    completedAt: ex.completed_at,
                    shareToken: ex.share_token,
                    highlight: highlight,
                },
            };
        });

        return NextResponse.json<ActivityResponseDto>({
            success: true,
            data: {
                activities: activities,
            },
        });
    } catch (error) {
        console.error("Activity API error:", error);
        return NextResponse.json({ success: false, message: "服务器错误" }, {
            status: 500,
        });
    }
}
