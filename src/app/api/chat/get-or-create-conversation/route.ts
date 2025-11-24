import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabaseAdmin from '@/lib/supabaseAdmin';
import type { ApiData } from '@/types/api';
import type { GetOrCreateConversationDto, GetOrCreateConversationResponseDto } from './entity';

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
    const { coach_id } = await req.json() as GetOrCreateConversationDto;

    if (!coach_id) {
        return NextResponse.json({
            success: false,
            message: '缺少教练ID',
            data: null
        }, { status: 400 });
    }

    try {
        // 查询订阅关系（可选，不强制要求）
        const { data: subscription } = await supabaseAdmin
            .from('coach_subscriptions')
            .select('id')
            .eq('student_id', userId)
            .eq('coach_id', coach_id)
            .eq('status', 'active')
            .single();

        // 查找现有会话
        let { data: conversation, error } = await supabaseAdmin
            .from('conversations' as any)
            .select('id')
            .eq('student_id', userId)
            .eq('coach_id', coach_id)
            .single() as any;

        let isNew = false;

        if (error || !conversation) {
            // 创建新会话
            const { data: newConv, error: createError } = await supabaseAdmin
                .from('conversations' as any)
                .insert({
                    student_id: userId,
                    coach_id: coach_id,
                    subscription_id: subscription?.id || null
                })
                .select('id')
                .single() as any;

            if (createError || !newConv) {
                console.error('创建会话失败:', createError);
                return NextResponse.json({
                    success: false,
                    message: '创建会话失败',
                    data: null
                }, { status: 500 });
            }

            conversation = newConv;
            isNew = true;
        }

        return NextResponse.json<ApiData<GetOrCreateConversationResponseDto>>({
            success: true,
            message: isNew ? '会话创建成功' : '会话已存在',
            data: {
                conversation_id: conversation.id,
                is_new: isNew
            }
        });
    } catch (error: any) {
        console.error('获取或创建会话错误:', error);
        return NextResponse.json({
            success: false,
            message: error?.message || '服务器错误',
            data: null
        }, { status: 500 });
    }
}

