import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { GetPricingDto, GetPricingResponseDto, Pricing } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    let {
        coachId = '',
        userId = ''
    } = await req.json() as GetPricingDto;

    if (userId && !coachId) {
        const { data: coach, error } = await supabase
            .from("coaches")
            .select("*")
            .eq("user_id", userId)
            .single();

        if (error) {
            return NextResponse.json({
                success: false,
                message: error.message
            });
        }

        coachId = coach.id;
    }


    // 获取定价信息
    const { data, error } = await supabase
        .from('coach_pricing')
        .select('*')
        .eq('coach_id', coachId)
        .maybeSingle();

    if (error) {
        return NextResponse.json<ApiData<GetPricingResponseDto>>({
            success: false,
            message: '获取定价信息失败',
            data: null
        });
    }

    const pricingData = data ?? {
        id: null,
        coach_id: coachId,
        pricings: [
            {
                title: session.profile.nickname + '的基础订阅计划',
                price: 100,
                features: [
                    '服务1',
                    '服务2',
                ],
                is_recommend: false,
            }
        ],
        created_at: null,
        updated_at: null,
    };

    return NextResponse.json<ApiData<GetPricingResponseDto>>({
        success: true,
        message: '获取定价信息成功',
        data: {
            pricings: pricingData.pricings as Pricing[],
        }
    });
}