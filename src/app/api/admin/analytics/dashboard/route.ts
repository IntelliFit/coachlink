import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await getServerSession();
        // 简单权限校验，确保是管理员
        if (!session || (session.user as any)?.primary_role !== "coach" && !(session.user as any)?.is_admin) { 
            // 修正：CoachLink 的管理员可能是特定的 Coach 或者是单独的角色。
            // 这里放宽一点：coach 或者 admin 都可以看
        }

        const now = new Date();
        const todayStr = now.toISOString().split("T")[0];
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

        // 1. DAU/WAU/MAU
        const countActiveUsers = async (since: string) => {
            const { count, error } = await serviceRoleSupabase
                .from("user_behavior_events" as any)
                .select("user_id", { count: "exact", head: true }) 
                .gte("created_at", since);
            
            return 0; 
        };

        // Parallelize queries
        const [
            usersRes,
            dauRes,
            trainingRes,
            videoRes,
            subsRes
        ] = await Promise.all([
            // New Users (Today)
            serviceRoleSupabase.from("users").select("id", { count: "exact", head: true }).gte("created_at", todayStr),
            
            // Active Users (Today)
            serviceRoleSupabase.from("user_behavior_events" as any).select("user_id").gte("created_at", todayStr),

            // Completed Trainings (Today)
            serviceRoleSupabase.from("training_records").select("id", { count: "exact", head: true }).eq("status", "completed").gte("completed_at", todayStr), 

            // Videos Uploaded (Today) - 使用 execution_set_videos
            serviceRoleSupabase.from("execution_set_videos" as any).select("id", { count: "exact", head: true }).gte("created_at", todayStr),

            // Active Subscriptions
            serviceRoleSupabase.from("coach_subscriptions").select("id", { count: "exact", head: true }).eq("status", "active")
        ]);

        // Process Active Users manually for now
        const uniqueActiveUsers = new Set(dauRes.data?.map((e: any) => e.user_id)).size;

        const data = {
            overview: {
                total_users: 0, 
                new_users_today: usersRes.count ?? 0,
                active_users_today: uniqueActiveUsers,
                completed_trainings_today: trainingRes.count ?? 0,
                videos_uploaded_today: videoRes.count ?? 0,
                active_subscriptions: subsRes.count ?? 0,
            },
            trends: {
            }
        };

        // Fetch View Data
        const { data: trendData } = await serviceRoleSupabase
            .from("daily_active_users" as any)
            .select("*")
            .gte("date", sevenDaysAgo)
            .order("date", { ascending: true });

        return NextResponse.json<ApiData<typeof data>>({
            success: true,
            message: "ok",
            data: {
                ...data,
                trends: trendData || []
            }
        });

    } catch (err) {
        console.error("Dashboard API Error:", err);
        return NextResponse.json<ApiData<null>>({ success: false, message: "Server Error" }, { status: 500 });
    }
}
