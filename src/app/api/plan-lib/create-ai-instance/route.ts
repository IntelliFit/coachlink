import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { ApiData } from "@/types/api";
import { getServerSession } from "../../auth/[...nextauth]/auth";
import { TrainingItem } from "@/types/questionnaires";
import { CreateAiInstanceDto, CreateAiInstanceResponseDto } from "./entity";
import { matchPlan } from "./match";

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
    const template = await matchPlan(answers);



    return NextResponse.json<ApiData<CreateAiInstanceResponseDto>>({
        success: true,
        message: "创建训练计划实例成功",
        data: {
            template
        }
    });
}