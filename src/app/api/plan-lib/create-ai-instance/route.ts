import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { ApiData } from "@/types/api";
import { getServerSession } from "../../auth/[...nextauth]/auth";
import { TrainingItem } from "@/types/questionnaires";
import { CreateAiInstanceDto, CreateAiInstanceResponseDto } from "./entity";
import { fillTemplate, matchPlan } from "./match";

export async function POST(req: Request) {
    const {
        subscriptionId,
    } = await req.json() as CreateAiInstanceDto;

    // Check if user is logged in
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized"
        }, { status: 401 });
    }

    const { data: subscription, error: subscriptionError } = await supabase
        .from('coach_subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();

    if (subscriptionError) {
        return NextResponse.json({
            success: false,
            message: subscriptionError.message
        }, { status: 500 });
    }

    const answers = subscription.subscribe_data as unknown as TrainingItem[];
    const templates = await matchPlan(answers);

    if (templates?.length > 0) {
        const selectTemplate = templates[0];

        // 根据用户数据进行填充
        fillTemplate(answers, selectTemplate);

        // 更新数据库
        const { data: template, error: updateError } = await supabase
            .from('coach_plan_instances')
            .insert({
                name: 'AI 生成计划',
                description: '暂无描述',
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
                training_days: selectTemplate.training_days
            })
            .select('*')
            .single();

        if (updateError) {
            return NextResponse.json({
                success: false,
                message: updateError.message
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<CreateAiInstanceResponseDto>>({
            success: true,
            message: "创建训练计划实例成功",
            data: {
                template
            }
        });
    } else {
        return NextResponse.json<ApiData<CreateAiInstanceResponseDto>>({
            success: false,
            message: "没有匹配的训练计划",
            data: {
                template: null
            }
        }, { status: 400 });
    }
}