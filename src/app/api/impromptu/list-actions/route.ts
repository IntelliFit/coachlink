import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { ListImpromptuActionsResponseDto } from "./entity";

export async function POST() {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<ListImpromptuActionsResponseDto>>({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;
        const [impromptuResult, planResult] = await Promise.all([
            supabase
                .from("impromptu_executions")
                .select("action_executions, completed_at")
                .eq("student_id", userId)
                .eq("status", "completed")
                .order("completed_at", { ascending: false })
                .limit(120),
            supabase
                .from("plan_instance_executions")
                .select("action_executions, completed_at")
                .eq("student_id", userId)
                .eq("status", "completed")
                .order("completed_at", { ascending: false })
                .limit(120),
        ]);

        if (impromptuResult.error || planResult.error) {
            console.error("load frequent action executions failed:", impromptuResult.error || planResult.error);
            return NextResponse.json<ApiData<ListImpromptuActionsResponseDto>>({
                success: false,
                message: "获取常用动作失败",
                data: null,
            }, { status: 500 });
        }

        const usage = new Map<string, { count: number; lastUsedAt: string | null }>();
        const collect = (rows: any[]) => {
            for (const row of rows || []) {
                const seen = new Set<string>();
                const actions = Array.isArray(row?.action_executions) ? row.action_executions : [];
                for (const action of actions) {
                    const actionId = String(action?.action_id || "").trim();
                    if (!actionId || seen.has(actionId)) continue;
                    seen.add(actionId);
                    const current = usage.get(actionId) || { count: 0, lastUsedAt: null };
                    const completedAt = row?.completed_at ? String(row.completed_at) : null;
                    usage.set(actionId, {
                        count: current.count + 1,
                        lastUsedAt: !current.lastUsedAt || (completedAt && completedAt > current.lastUsedAt)
                            ? completedAt
                            : current.lastUsedAt,
                    });
                }
            }
        };
        collect(impromptuResult.data || []);
        collect(planResult.data || []);

        const frequentIds = [...usage.entries()]
            .sort((a, b) => b[1].count - a[1].count || String(b[1].lastUsedAt || "").localeCompare(String(a[1].lastUsedAt || "")))
            .slice(0, 40)
            .map(([id]) => id);

        let actions: any[] = [];
        if (frequentIds.length > 0) {
            const result = await supabase
                .from("student_actions")
                .select("*")
                .eq("user_id", userId)
                .in("id", frequentIds);
            if (result.error) {
                console.error("load frequent student actions failed:", result.error);
                return NextResponse.json<ApiData<ListImpromptuActionsResponseDto>>({
                    success: false,
                    message: "获取常用动作失败",
                    data: null,
                }, { status: 500 });
            }
            actions = result.data || [];
        }

        if (actions.length === 0) {
            const fallback = await supabase
                .from("student_actions")
                .select("*")
                .eq("user_id", userId)
                .order("updated_at", { ascending: false })
                .limit(20);
            if (fallback.error) {
                console.error("load recent student actions failed:", fallback.error);
                return NextResponse.json<ApiData<ListImpromptuActionsResponseDto>>({
                    success: false,
                    message: "获取常用动作失败",
                    data: null,
                }, { status: 500 });
            }
            actions = fallback.data || [];
        }

        const canonicalIds = Array.from(new Set(actions.map((item) => item.canonical_action_id).filter(Boolean)));
        const canonicalMap = new Map<string, { category: string | null; referenceImageUrl: string | null }>();
        if (canonicalIds.length > 0) {
            const { data: canonicalRows, error: canonicalError } = await supabase
                .from("canonical_actions")
                .select("id, category, reference_image_url")
                .in("id", canonicalIds);
            if (canonicalError) {
                console.warn("load frequent action canonical metadata failed:", canonicalError);
            } else {
                for (const row of canonicalRows || []) {
                    canonicalMap.set(row.id, {
                        category: row.category ?? null,
                        referenceImageUrl: row.reference_image_url ?? null,
                    });
                }
            }
        }

        actions.sort((a, b) => {
            const left = usage.get(a.id) || { count: 0, lastUsedAt: null };
            const right = usage.get(b.id) || { count: 0, lastUsedAt: null };
            return right.count - left.count || String(right.lastUsedAt || "").localeCompare(String(left.lastUsedAt || ""));
        });

        return NextResponse.json<ApiData<ListImpromptuActionsResponseDto>>({
            success: true,
            message: "获取动作列表成功",
            data: {
                actions: actions.map((item) => {
                    const canonical = item.canonical_action_id
                        ? canonicalMap.get(item.canonical_action_id)
                        : null;
                    const usageEntry = usage.get(item.id) || { count: 0, lastUsedAt: null };
                    return {
                        ...item,
                        type: item.type || "STRENGTH",
                        category: canonical?.category ?? null,
                        reference_image_url: canonical?.referenceImageUrl ?? null,
                        usage_count: usageEntry.count,
                        last_used_at: usageEntry.lastUsedAt,
                    };
                }),
            },
        });
    } catch (error) {
        console.error("list impromptu actions error:", error);
        return NextResponse.json<ApiData<ListImpromptuActionsResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}

