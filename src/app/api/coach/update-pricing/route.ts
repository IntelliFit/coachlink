import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { UpdatePricingDto, UpdatePricingResponseDto } from './entity';

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
            message: '教练不存在或无权限',
            data: null
        }, { status: 404 });
    }

    const {
        pricings
    } = await req.json() as UpdatePricingDto;

    // 检查是否已存在定价记录
    const { data: existingPricing } = await supabase
        .from('coach_pricing')
        .select('id')
        .eq('coach_id', userId)
        .single();

    if (existingPricing) {
        // 更新现有记录
        const { data, error } = await supabase
            .from('coach_pricing')
            .update({
                pricings: pricings,
            })
            .eq('id', existingPricing.id)
            .select()
            .single();

        if (error) {
            return NextResponse.json<ApiData<UpdatePricingResponseDto>>({
                success: false,
                message: '更新定价信息失败: ' + error.message,
                data: null
            });
        }

        return NextResponse.json<ApiData<UpdatePricingResponseDto>>({
            success: true,
            message: '定价信息保存成功',
            data: {
                pricing: data
            }
        });
    } else {
        // 创建新记录
        const { data, error } = await supabase
            .from('coach_pricing')
            .insert({
                coach_id: userId,
                pricings: pricings,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json<ApiData<UpdatePricingResponseDto>>({
                success: false,
                message: '创建定价信息失败: ' + error.message,
                data: null
            });
        }


        return NextResponse.json<ApiData<UpdatePricingResponseDto>>({
            success: true,
            message: '定价信息保存成功',
            data: {
                pricing: data
            }
        });
    }

}