import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "未登录" }, {
                status: 401,
            });
        }

        const userId = session.user.id;

        // 1. 查找活跃订阅
        const { data: subscription } = await supabase
            .from("coach_subscriptions")
            .select("id, coach_id")
            .eq("student_id", userId)
            .eq("status", "active")
            .limit(1)
            .single();

        if (!subscription) {
            return NextResponse.json({
                success: false,
                message: "未找到活跃的订阅，请先订阅教练或创建自建订阅",
            });
        }

        // 2. 查找可用模板 (优先使用该教练的模板)
        let templateToUse = null;

        // 尝试获取教练的模板
        if (subscription.coach_id) {
            const { data: templates } = await supabase
                .from("coach_plan_templates")
                .select("*")
                .eq("coach_id", subscription.coach_id)
                .limit(1);

            if (templates && templates.length > 0) {
                templateToUse = templates[0];
            }
        }

        // 如果没有找到，尝试找任何公开模板或系统模板 (这里简化为必须有教练模板)
        if (!templateToUse) {
            // 尝试找用户自己的模板（如果是教练）
            const { data: myTemplates } = await supabase
                .from("coach_plan_templates")
                .select("*")
                .eq("coach_id", userId)
                .limit(1);

            if (myTemplates && myTemplates.length > 0) {
                templateToUse = myTemplates[0];
            }
        }

        if (!templateToUse) {
            return NextResponse.json({
                success: false,
                message:
                    "未找到可用模板。请确保您的教练（或您自己）至少创建了一个模板。",
            });
        }

        // 3. 提取第一天训练日
        const trainingDays = templateToUse.training_days as any[];
        const firstTrainingDay = trainingDays.find((d) =>
            d.type === "training"
        );

        if (!firstTrainingDay) {
            return NextResponse.json({
                success: false,
                message: "选中的模板没有训练日",
            });
        }

        // 4. 归档现有 Active 计划
        await supabase
            .from("coach_plan_instances")
            .update({ status: "archived" })
            .eq("student_id", userId)
            .eq("status", "active");

        // 5. 创建新 1 天计划
        const { data: newInstance, error } = await supabase
            .from("coach_plan_instances")
            .insert({
                name: "1天测试计划 (自动生成)",
                description: `基于模板 [${templateToUse.name}] 生成的测试计划`,
                coach_subscription_id: subscription.id,
                coach_id: subscription.coach_id,
                student_id: userId,
                coach_plan_template_id: templateToUse.id,
                start_date: new Date().toISOString(),
                end_date: new Date().toISOString(), // 当天结束
                status: "active",
                type: "custom",
                training_days: [
                    { ...firstTrainingDay, dayIndex: 1 },
                ],
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        return NextResponse.json({
            success: true,
            message: "成功创建 1 天测试计划",
            data: newInstance,
        });
    } catch (error: any) {
        console.error("Create test plan error:", error);
        return NextResponse.json({ success: false, message: error.message }, {
            status: 500,
        });
    }
}
