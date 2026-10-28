import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    GetTrainingDayHistoryDto,
    GetTrainingDayHistoryResponseDto,
    TrainingDayHistoryItem,
} from "./entity";
import { resolveImpromptuTitle } from "@coachlink/core/src/impromptuTitle";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        const authResult = session?.user?.id
            ? { isAuthenticated: true, userId: session.user.id }
            : await getAuthUser(req);
        if (!authResult.isAuthenticated || !authResult.userId) {
            return NextResponse.json<ApiData<GetTrainingDayHistoryResponseDto>>({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }
        const userId = authResult.userId;
        const { date } = await req.json() as GetTrainingDayHistoryDto;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
            return NextResponse.json<ApiData<GetTrainingDayHistoryResponseDto>>({
                success: false,
                message: "date 参数格式错误",
                data: null,
            }, { status: 400 });
        }

        const dayStart = `${date}T00:00:00.000Z`;
        const dayEndDate = new Date(`${date}T00:00:00.000Z`);
        dayEndDate.setUTCDate(dayEndDate.getUTCDate() + 1);
        const dayEnd = dayEndDate.toISOString();

        const queryImpromptuExecs = (withTitle: boolean) => supabase
            .from("impromptu_executions")
            .select(
                `id, status, started_at, completed_at, total_sets, completed_sets, action_executions${withTitle ? ", title" : ""}`,
            )
            .eq("student_id", userId)
            .gte("started_at", dayStart)
            .lt("started_at", dayEnd)
            .order("started_at", { ascending: false });

        const [{ data: planExecs, error: planError }, {
            data: impromptuExecs,
            error: impromptuError,
        }] = await Promise.all([
            supabase
                .from("plan_instance_executions")
                .select(
                    "id, status, started_at, completed_at, total_sets, completed_sets, action_executions, instance_id, coach_plan_instances:instance_id(name, source)",
                )
                .eq("student_id", userId)
                .gte("started_at", dayStart)
                .lt("started_at", dayEnd)
                .order("started_at", { ascending: false }),
            queryImpromptuExecs(true).then((result) =>
                // 兼容 title 列迁移前的库：缺列时退回旧字段集
                result.error?.code === "42703" ? queryImpromptuExecs(false) : result
            ),
        ]);

        if (planError || impromptuError) {
            return NextResponse.json<ApiData<GetTrainingDayHistoryResponseDto>>({
                success: false,
                message: "获取训练记录失败",
                data: null,
            }, { status: 500 });
        }

        const items: TrainingDayHistoryItem[] = [];

        const summarizeActions = (raw: any) => {
            const actions = Array.isArray(raw) ? raw : [];
            return actions.map((action: any) => {
                const sets = Array.isArray(action?.sets) ? action.sets : [];
                const completed = sets.filter((set: any) => set?.status === "completed")
                    .length;
                return {
                    actionName: action?.action_name || "未命名动作",
                    completedSets: completed,
                    totalSets: sets.length,
                };
            });
        };

        for (const item of planExecs || []) {
            const source = (item as any)?.coach_plan_instances?.source;
            const sourceType = source === "self" || source === "student"
                ? "SELF_PLAN"
                : "COACH_PLAN";
            const planName = (item as any)?.coach_plan_instances?.name || "计划训练";
            items.push({
                id: item.id,
                sourceType,
                status: item.status,
                startedAt: item.started_at,
                completedAt: item.completed_at || null,
                totalSets: item.total_sets || 0,
                completedSets: item.completed_sets || 0,
                title: planName,
                actionSummaries: summarizeActions((item as any).action_executions),
            });
        }

        for (const item of impromptuExecs || []) {
            items.push({
                id: item.id,
                sourceType: "IMPROMPTU",
                status: item.status,
                startedAt: item.started_at,
                completedAt: item.completed_at || null,
                totalSets: item.total_sets || 0,
                completedSets: item.completed_sets || 0,
                title: resolveImpromptuTitle((item as any).title),
                actionSummaries: summarizeActions((item as any).action_executions),
            });
        }

        items.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

        return NextResponse.json<ApiData<GetTrainingDayHistoryResponseDto>>({
            success: true,
            message: "获取训练记录成功",
            data: { date, items },
        });
    } catch (error) {
        console.error("training history day error:", error);
        return NextResponse.json<ApiData<GetTrainingDayHistoryResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
