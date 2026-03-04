import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getApiUserId } from "@/lib/getApiUserId";
import type { FriendRecordsResponseDto } from "../../../friends/entity";
import { differenceInMinutes } from "date-fns";

/**
 * GET /api/user/friends/[friendId]/records
 *
 * 获取好友的训练记录列表（及基本信息）
 * 支持 NextAuth Session（网页）或 Authorization: Bearer JWT（小程序）
 */
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ friendId: string }> },
) {
    try {
        const userId = await getApiUserId(request);
        if (!userId) {
            return NextResponse.json({ success: false, message: "未登录" }, {
                status: 401,
            });
        }
        const params = await context.params;
        const friendId = params.friendId;

        if (!friendId) {
            return NextResponse.json({ success: false, message: "参数错误" }, {
                status: 400,
            });
        }

        // 1. 验证好友关系
        const { data: relationship, error: relError } = await supabase
            .from("social_friendships")
            .select("updated_at")
            .eq("status", "accepted")
            .or(`and(requester_id.eq.${userId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${userId})`)
            .single();

        if (relError || !relationship) {
            return NextResponse.json({
                success: false,
                message: "你们还不是好友",
            }, { status: 403 });
        }

        // 2. 获取好友信息
        const { data: profile } = await supabase
            .from("user_profiles")
            .select("user_id, nickname, avatar_url")
            .eq("user_id", friendId)
            .single();

        // 3. 获取训练记录
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "20");
        const offset = parseInt(searchParams.get("offset") || "0");

        const { data: executions, error: execError, count } = await supabase
            .from("plan_instance_executions")
            .select(
                `
                id,
                completed_at,
                started_at,
                share_token,
                status,
                visibility,
                coach_plan_instances:instance_id (name),
                action_executions
            `,
                { count: "exact" },
            )
            .eq("student_id", friendId)
            .eq("status", "completed")
            .neq("visibility", "private")
            .order("completed_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (execError) {
            console.error("Get friend records error:", execError);
            return NextResponse.json({
                success: false,
                message: "获取记录失败",
            }, { status: 500 });
        }

        // 4. 格式化数据
        const records = (executions || []).map((ex: any) => {
            let totalVolume = 0;
            if (ex.action_executions && Array.isArray(ex.action_executions)) {
                ex.action_executions.forEach((action: any) => {
                    if (action.sets && Array.isArray(action.sets)) {
                        action.sets.forEach((set: any) => {
                            if (
                                set.status === "completed" || set.completed_at
                            ) {
                                totalVolume += (set.actual_weight || 0) *
                                    (set.actual_reps || 0);
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

            return {
                executionId: ex.id,
                planName: ex.coach_plan_instances?.name || "未知计划",
                dayIndex: ex.day_index || 0,
                totalVolume: totalVolume,
                durationMinutes: duration,
                completedAt: ex.completed_at,
                shareToken: ex.share_token,
            };
        });

        return NextResponse.json<FriendRecordsResponseDto>({
            success: true,
            data: {
                user: {
                    userId: friendId,
                    nickname: profile?.nickname || "好友",
                    avatarUrl: profile?.avatar_url,
                },
                records: records,
                total: count || 0,
            },
        });
    } catch (error) {
        console.error("Friend records API error:", error);
        return NextResponse.json({ success: false, message: "服务器错误" }, {
            status: 500,
        });
    }
}
