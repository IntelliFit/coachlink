import { NextResponse } from 'next/server'
import supabase from '@/lib/supabaseClient'
import { getServerSession } from '../../auth/[...nextauth]/auth'
import { GetTrainingPlansDetailDto } from './entity'

export async function POST(req: Request) {
    const session = await getServerSession();

    if (!session?.user?.id) {
        return NextResponse.json(
            { success: false, message: '未登录用户', data: null },
            { status: 401 }
        )
    }

    const userId = session.user.id;
    const {
        id = '',
    } = await req.json() as GetTrainingPlansDetailDto;

    const { data: plan, error: plansError } = await supabase
        .from('training_plans')
        .select()
        .eq('id', id)
        .single();
    
    if (plansError) {
        return NextResponse.json({
            success: false,
            message: plansError.message,
            data: null
        });
    }

    if (plan.user_id !== userId && plan.coach_id !== userId) {
        return NextResponse.json({
            success: false,
            message: '无权限访问此训练计划',
            data: null
        });
    }

    // 根据 plan id 查找 detail

    const { data: details, error: detailError } = await supabase
        .from('training_plan_details')
        .select('*')
        .eq('training_plan_id', plan.id)
        .order('created_at', { ascending: false });

    if (detailError) {
        return NextResponse.json({
            success: false,
            message: detailError.message,
            data: null
        });
    }



    return NextResponse.json({
        success: true,
        message: '成功获取训练计划',
        data: {
            plan,
            details
        }
    });

}
