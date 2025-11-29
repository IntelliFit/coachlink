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

    const userId = session.user.id;

    if (!session.user.is_coach) {
        return NextResponse.json({
            success: false,
            message: '用户不是教练',
            data: null
        }, { status: 403 });
    }

    // 获取定价信息
    const { data, error } = await supabase
        .from('coach_pricing')
        .select('*')
        .eq('coach_id', userId)
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
        coach_id: userId,
        pricings: [],
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