import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { TrainingItem } from "@/types/questionnaires";
import { CreateAiInstanceDto, CreateAiInstanceResponseDto } from "./entity";
import { fillTemplate, matchPlan } from "./match";

export async function POST(req: Request) {
    const {
        subscriptionId,
        startWeek = 1,
        startDay = 1,
        keepOriginalIndex = true,
    } = await req.json() as CreateAiInstanceDto;

    // Check if user is logged in
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    const { data: subscription, error: subscriptionError } = await supabase
        .from("coach_subscriptions")
        .select("*")
        .eq("id", subscriptionId)
        .single();

    if (subscriptionError) {
        return NextResponse.json({
            success: false,
            message: subscriptionError.message,
        }, { status: 500 });
    }

    const answers = subscription.subscribe_data as unknown as TrainingItem[];

    // 获取学员体重
    const { data: profile } = await supabase
        .from("user_profiles")
        .select("weight, nickname, full_name")
        .eq("user_id", subscription.student_id)
        .single();

    const studentBodyWeight = profile?.weight || null;
    const studentNameRaw = (profile?.nickname || profile?.full_name || "学员").trim();
    const studentName = studentNameRaw || "学员";

    // --- QUOTA CHECK START ---
    // Check if user has sufficient AI quota (1 per generation)
    // We import checkAndConsumeAiQuota from our shared lib
    const { checkAndConsumeAiQuota } = await import("@/lib/membershipLimit");
    const quotaResult = await checkAndConsumeAiQuota(
        subscription.student_id,
        1,
    );

    if (!quotaResult.success) {
        return NextResponse.json({
            success: false,
            message: quotaResult.message ||
                "AI 生成配额不足，请升级会员或购买加油包",
        }, { status: 403 });
    }
    // --- QUOTA CHECK END ---

    // 获取支持自动计算的动作列表（包含 includesBodyWeight）
    const { data: autoComputeActions } = await supabase
        .from("coach_actions")
        .select("id, name, enableAutoWeightCompute, includesBodyWeight")
        .eq("enableAutoWeightCompute", true);

    const templates = await matchPlan(answers);

    console.log("匹配结果:", templates?.length, "个模板");
    if (templates) {
        templates.forEach((t) => {
            console.log(
                `模板: ${t.name}, tags: ${t.tags}, week_days: ${t.week_days}, contained_options: ${t.contained_options}`,
            );
        });
    }

    if (templates?.length > 0) {
        const selectTemplate = templates[0];

        // 根据用户数据进行填充，同时自动计算负重
        fillTemplate(answers, selectTemplate, {
            studentBodyWeight,
            autoComputeActions: autoComputeActions || [],
        });

        // 调试：检查计算后的数据
        console.log("计算后的训练计划数据:");
        const debugDays = selectTemplate.training_days as any[];
        debugDays?.forEach((day: any, dayIdx: number) => {
            day.actionSets?.forEach((action: any, actionIdx: number) => {
                console.log(
                    `Day${dayIdx + 1} Action${
                        actionIdx + 1
                    }: load=${action.params?.load}, 强度=${
                        action.params?.["强度"]
                    }`,
                );
            });
        });

        // 起始执行位置逻辑：以周为单位保留完整结构
        // 计算起始执行天数索引（1-based）
        const startExecutionDay = (startWeek - 1) * 7 + startDay;
        const trainingDays = selectTemplate.training_days as any[];

        console.log(
            `起始执行位置: 第${startWeek}周第${startDay}天, 起始天数=${startExecutionDay}, 总天数=${trainingDays.length}`,
        );

        if (startExecutionDay > trainingDays.length) {
            // 起始位置超出范围
            return NextResponse.json({
                success: false,
                message:
                    `起始位置(第${startWeek}周第${startDay}天)超出模板总天数(${trainingDays.length}天)`,
            }, { status: 400 });
        }

        // 调试：打印保存前的完整数据结构
        console.log("=== 保存前完整数据 ===");
        console.log(
            `保留完整训练计划，共${trainingDays.length}天，从第${startExecutionDay}天开始执行`,
        );

        const planBaseName = `${studentName}的计划`;
        const planName = startExecutionDay > 1
            ? `${planBaseName}（从第${startWeek}周${startDay > 1 ? `第${startDay}天` : ""}开始）`
            : planBaseName;

        // 更新数据库 - 保留完整结构，通过 start_execution_day 标记起始位置
        const { data: template, error: updateError } = await supabase
            .from("coach_plan_instances")
            .insert({
                name: planName,
                description: startExecutionDay > 1
                    ? `从第${startWeek}周第${startDay}天开始执行，前面${
                        startExecutionDay - 1
                    }天视为已完成`
                    : "暂无描述",
                coach_subscription_id: subscriptionId,
                coach_id: subscription.coach_id || null,
                student_id: subscription.student_id || null,
                coach_plan_template_id: selectTemplate.id,
                start_date: new Date().toISOString(),
                end_date: null,
                tags: selectTemplate.tags,
                type: selectTemplate.type,
                suitable_for: selectTemplate.suitable_for,
                status: "active",
                training_days: trainingDays, // 保留完整结构
                start_execution_day: startExecutionDay, // 新字段：起始执行天数
            })
            .select("*")
            .single();

        if (updateError) {
            return NextResponse.json({
                success: false,
                message: updateError.message,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<CreateAiInstanceResponseDto>>({
            success: true,
            message: "创建训练计划实例成功",
            data: {
                template,
            },
        });
    } else {
        return NextResponse.json<ApiData<CreateAiInstanceResponseDto>>({
            success: false,
            message: "没有匹配的训练计划",
            data: {
                template: null,
            },
        }, { status: 400 });
    }
}
