import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import type { GetTrainingPlansDto, GetTrainingPlansResponseDto } from './entity';

export async function POST(req: Request) {
    // 🔐 鉴权检查
    const session = await getServerSession();

    if (!session || !session.user?.id) {
        return NextResponse.json({
            success: false,
            message: 'Unauthorized',
            data: null,
        });
    }

    // 📥 获取请求参数
    const {
        limit = 10,
        offset = 0
    } = await req.json() as GetTrainingPlansDto;
    
    const userId = session.user.id;

    // 📦 查询训练计划及练习动作
    const { data: trainingPlans, error: plansError } = await supabase
        .from('training_plans')
        .select(
            `
        *,
        exercises (
          id,
          name,
          category,
          description,
          sets,
          reps,
          rest_time,
          tips,
          order_index
        )
        `
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (plansError) {
        console.error('获取训练计划失败:', plansError);
        return NextResponse.json({
            success: false,
            message: '获取训练计划失败',
            data: null,
        });
    }

    // 🧩 对每个计划的 exercises 排序
    const sortedPlans =
        trainingPlans?.map((plan) => ({
            ...plan,
            exercises: (plan.exercises).sort((a, b) => {
                if (a.order_index !== null && b.order_index !== null) {
                    return a.order_index - b.order_index;
                }

                return 0;
            }),
        })) ?? [];

    // 📊 获取总数
    const { count, error: countError } = await supabase
        .from('training_plans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (countError) {
        console.error('获取计划总数失败:', countError);
    }

    const data: GetTrainingPlansResponseDto = {
        plans: sortedPlans,
        total: count || 0,
        limit,
        offset,
    };

    return NextResponse.json({
        success: true,
        message: '获取训练计划成功',
        data,
    });
}
