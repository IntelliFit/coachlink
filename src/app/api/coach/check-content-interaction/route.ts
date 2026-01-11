import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { ApiData } from '@/types/api';
import type { CheckContentInteractionDto, CheckContentInteractionResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null,
        }, { status: 401 });
    }

    const { contentId, interactionType }: CheckContentInteractionDto = await req.json();

    if (!contentId || !interactionType) {
        return NextResponse.json({
            success: false,
            message: '缺少必要参数',
            data: null,
        }, { status: 400 });
    }

    try {
        // Check if user already has this type of interaction with this content
        const { data: existingInteraction } = await supabase
            .from('content_interactions')
            .select('id')
            .eq('content_id', contentId)
            .eq('user_id', session.user.id)
            .eq('interaction_type', interactionType)
            .single();

        return NextResponse.json<ApiData<CheckContentInteractionResponseDto>>({
            success: true,
            message: '查询成功',
            data: {
                hasInteracted: !!existingInteraction,
                interactionId: existingInteraction?.id
            },
        });
    } catch (error) {
        console.error('Error checking content interaction:', error);
        return NextResponse.json({
            success: false,
            message: '检查互动状态时发生错误',
            data: null,
        }, { status: 500 });
    }
}