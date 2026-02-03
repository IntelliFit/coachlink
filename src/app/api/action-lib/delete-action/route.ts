import { NextRequest, NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import type { DeleteActionDto, DeleteActionResponseDto } from "./entity";
import type { ApiData } from "@/types/api";
import { countActionRefs, removeActionRefs } from "@/lib/actionRefs";

export async function POST(req: NextRequest) {
    const { id, removeReferences }: DeleteActionDto = await req.json();

    // 验证必要参数
    if (!id) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "缺少动作ID",
            data: null
        }, { status: 400 });
    }

    // 检查用户登录状态和教练角色
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "用户未登录",
            data: null
        }, { status: 401 });
    }

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('is_coach')
        .eq('id', userId)
        .single();

    if (userError || !user.is_coach) {
        return NextResponse.json({
            success: false,
            message: "Forbidden",
        }, { status: 403 });
    }


    // 检查动作是否存在且属于该教练
    const { data: existingAction, error: fetchError } = await supabase
        .from("coach_actions")
        .select("id, url")
        .eq("id", id)
        .eq("coach_id", userId)
        .single();

    if (fetchError || !existingAction) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "动作不存在或无权访问",
            data: null
        }, { status: 404 });
    }

    // 删除前：若不移除引用，则检查该动作是否被模板/计划实例引用
    try {
        const { data: templates, error: templatesError } = await supabase
            .from("coach_plan_templates")
            .select("id,training_days")
            .eq("coach_id", userId);
        if (templatesError) {
            console.error("检查模板引用失败:", templatesError);
        } else {
            const actionSet = new Set([id]);
            const templateHits = (templates || []).map((t: any) => ({
                id: t.id,
                c: countActionRefs(t.training_days, actionSet),
                training_days: t.training_days,
            })).filter((x) => x.c > 0);

            let instanceHits: Array<{ id: string; c: number; training_days: any }> = [];
            const { data: coachRow } = await supabase
                .from("coaches")
                .select("id")
                .eq("user_id", userId)
                .maybeSingle();
            if (coachRow?.id) {
                const { data: instances, error: instancesError } = await supabase
                    .from("coach_plan_instances")
                    .select("id,training_days")
                    .eq("coach_id", coachRow.id);
                if (instancesError) {
                    console.error("检查实例引用失败:", instancesError);
                } else {
                    instanceHits = (instances || []).map((i: any) => ({
                        id: i.id,
                        c: countActionRefs(i.training_days, actionSet),
                        training_days: i.training_days,
                    })).filter((x) => x.c > 0);
                }
            }

            const templateCount = templateHits.length;
            const instanceCount = instanceHits.length;
            const matchCount = templateHits.reduce((s, x) => s + x.c, 0) + instanceHits.reduce((s, x) => s + x.c, 0);

            if (!removeReferences && matchCount > 0) {
                return NextResponse.json<ApiData<null>>({
                    success: false,
                    message: `该动作正在被引用：模板 ${templateCount} 个、计划实例 ${instanceCount} 个（共 ${matchCount} 处）。请先使用“合并/去重”功能替换引用后再删除。`,
                    data: null,
                }, { status: 409 });
            }

            if (removeReferences && matchCount > 0) {
                for (const t of templateHits) {
                    const { trainingDays, removed } = removeActionRefs(t.training_days, actionSet);
                    if (removed <= 0) continue;
                    const { error: updErr } = await supabase
                        .from("coach_plan_templates")
                        .update({ training_days: trainingDays, updated_at: new Date().toISOString() })
                        .eq("id", t.id)
                        .eq("coach_id", userId);
                    if (updErr) {
                        console.error("移除模板引用失败:", updErr);
                        return NextResponse.json<ApiData<null>>({
                            success: false,
                            message: "移除模板引用失败",
                            data: null,
                        }, { status: 500 });
                    }
                }

                for (const i of instanceHits) {
                    const { trainingDays, removed } = removeActionRefs(i.training_days, actionSet);
                    if (removed <= 0) continue;
                    const { error: updErr } = await supabase
                        .from("coach_plan_instances")
                        .update({ training_days: trainingDays, updated_at: new Date().toISOString() })
                        .eq("id", i.id);
                    if (updErr) {
                        console.error("移除实例引用失败:", updErr);
                        return NextResponse.json<ApiData<null>>({
                            success: false,
                            message: "移除计划实例引用失败",
                            data: null,
                        }, { status: 500 });
                    }
                }
            }
        }
    } catch (e) {
        console.error("检查/移除引用异常:", e);
    }

    // 如果演示视频来自本项目 Storage，则尝试删除文件
    try {
        const storageUrl = process.env.NEXT_SUPABASE_URL;
        const prevUrl = (existingAction as any)?.url;
        if (storageUrl && prevUrl && typeof prevUrl === "string" && prevUrl.includes(storageUrl)) {
            const parts = prevUrl.split("/videos/");
            if (parts.length === 2) {
                const rawPath = parts[1];
                const filePath = rawPath.split("?")[0];
                if (filePath) {
                    const { error: storageError } = await supabase.storage
                        .from("videos")
                        .remove([filePath]);
                    if (storageError) {
                        console.error("删除动作演示视频失败:", storageError);
                    }
                }
            }
        }
    } catch (e) {
        console.error("删除动作演示视频异常:", e);
    }

    // 删除动作
    const { error } = await supabase
        .from("coach_actions")
        .delete()
        .eq("id", id)
        .eq("coach_id", userId);

    if (error) {
        console.error("删除动作失败:", error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "删除动作失败",
            data: null
        }, { status: 500 });
    }


    return NextResponse.json<ApiData<DeleteActionResponseDto>>({
        success: true,
        message: "删除动作成功",
        data: '删除成功'
    });
}