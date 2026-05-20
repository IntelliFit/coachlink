import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { sendDirectMessage } from "@/lib/chat";
import type { ApiData } from "@/types/api";
import { archiveCurrentPlanInstancesForSubscription } from "@/lib/subscriptionEntitlement";

/**
 * 激活延迟的计划实例（定时任务）
 * 检查创建时间超过2分钟且仍为 scheduled 状态的计划，将其激活并通知学员
 * 
 * 这个端点应该由定时任务（cron job）定期调用，例如每1分钟调用一次
 */
export async function POST(req: Request) {
    // 可选：添加认证检查（例如检查 x-cron-secret header）
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedSecret = process.env.CRON_SECRET || process.env.ALIPAY_SYNC_SECRET;
    
    if (expectedSecret && cronSecret !== expectedSecret) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    try {
        // 计算2分钟前的时间戳
        const twoMinutesAgo = new Date();
        twoMinutesAgo.setMinutes(twoMinutesAgo.getMinutes() - 2);
        const twoMinutesAgoIso = twoMinutesAgo.toISOString();

        // 查询创建时间超过2分钟且仍为 scheduled 状态的计划
        const { data: pendingPlans, error: queryError } = await supabase
            .from("coach_plan_instances")
            .select("id, name, student_id, coach_id, coach_subscription_id, created_at")
            .eq("status", "scheduled")
            .lte("created_at", twoMinutesAgoIso);

        if (queryError) {
            console.error("[activate-pending-plans] 查询失败:", queryError);
            return NextResponse.json<ApiData<{ activated: number }>>({
                success: false,
                message: "查询失败",
                data: { activated: 0 },
            }, { status: 500 });
        }

        if (!pendingPlans || pendingPlans.length === 0) {
            return NextResponse.json<ApiData<{ activated: number }>>({
                success: true,
                message: "没有需要激活的计划",
                data: { activated: 0 },
            });
        }

        let activatedCount = 0;
        const errors: string[] = [];

        // 批量激活计划
        for (const plan of pendingPlans) {
            try {
                await archiveCurrentPlanInstancesForSubscription({
                    supabase,
                    subscriptionId: (plan as any).coach_subscription_id || null,
                    studentId: (plan as any).student_id || null,
                    excludeInstanceId: plan.id,
                });

                // 更新状态为 active
                const { error: updateError } = await supabase
                    .from("coach_plan_instances")
                    .update({ status: "active" })
                    .eq("id", plan.id);

                if (updateError) {
                    errors.push(`计划 ${plan.id} 激活失败: ${updateError.message}`);
                    continue;
                }

                // 通知学员
                const studentId = plan.student_id as string | null;
                if (studentId) {
                    const safePlanName = (plan.name || "训练计划").trim();
                    const content =
                        `✅ 你的训练计划已制定完成：**${safePlanName}**\n\n` +
                        `请点击 [今日训练](/today-training) 查看并开始训练。`;

                    // 获取教练的 user_id（用于发送消息）
                    let coachUserId: string | null = null;
                    if (plan.coach_id) {
                        const { data: coach } = await supabase
                            .from("coaches")
                            .select("user_id")
                            .eq("id", plan.coach_id)
                            .single();
                        coachUserId = coach?.user_id || null;
                    }

                    // 如果有教练 user_id，发送通知；否则跳过通知（计划已激活，学员可以通过其他方式看到）
                    if (coachUserId) {
                        try {
                            await sendDirectMessage({
                                fromUserId: coachUserId,
                                toUserId: studentId,
                                content,
                                contentMetadata: {
                                    kind: "plan_instance_created",
                                    instance_id: plan.id,
                                    link: "/today-training",
                                    ai_generated: true,
                                },
                            });
                        } catch (msgError) {
                            console.error(`[activate-pending-plans] 通知学员失败 (计划 ${plan.id}):`, msgError);
                            // 通知失败不影响激活，继续处理
                        }
                    } else {
                        console.warn(`[activate-pending-plans] 计划 ${plan.id} 无教练 user_id，跳过通知`);
                    }
                }

                activatedCount++;
                console.log(`[activate-pending-plans] 计划 ${plan.id} 已激活`);
            } catch (e: any) {
                errors.push(`计划 ${plan.id} 处理失败: ${e?.message || String(e)}`);
                console.error(`[activate-pending-plans] 处理计划 ${plan.id} 失败:`, e);
            }
        }

        return NextResponse.json<ApiData<{ activated: number; errors?: string[] }>>({
            success: true,
            message: `成功激活 ${activatedCount} 个计划`,
            data: {
                activated: activatedCount,
                ...(errors.length > 0 && { errors }),
            },
        });
    } catch (e: any) {
        console.error("[activate-pending-plans] 处理失败:", e);
        return NextResponse.json<ApiData<{ activated: number }>>({
            success: false,
            message: e?.message || "处理失败",
            data: { activated: 0 },
        }, { status: 500 });
    }
}

