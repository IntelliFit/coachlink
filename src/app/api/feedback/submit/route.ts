import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { SubmitFeedbackDto, SubmitFeedbackResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>({
            success: false,
            message: '用户未登录',
            data: {
                success: false,
                message: '用户未登录'
            }
        }, { status: 401 });
    }

    const userId = session.user.id;
    const { content, relatedQuestion } = await req.json() as SubmitFeedbackDto;

    // 验证输入
    if (!content || !content.trim()) {
        return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>({
            success: false,
            message: '反馈内容不能为空',
            data: {
                success: false,
                message: '反馈内容不能为空'
            }
        }, { status: 400 });
    }

    if (content.length > 2000) {
        return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>({
            success: false,
            message: '反馈内容不能超过2000字',
            data: {
                success: false,
                message: '反馈内容不能超过2000字'
            }
        }, { status: 400 });
    }

    try {
        // 插入反馈记录
        const { data: feedback, error } = await supabase
            .from('feedbacks')
            .insert({
                user_id: userId,
                content: content.trim(),
                related_question: relatedQuestion?.trim() || null,
                status: 'pending'
            })
            .select('id')
            .single();

        if (error) {
            console.error('插入反馈失败:', error);
            return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>({
                success: false,
                message: error.message || '提交反馈失败',
                data: {
                    success: false,
                    message: error.message || '提交反馈失败'
                }
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>({
            success: true,
            message: '反馈提交成功',
            data: {
                success: true,
                message: '反馈提交成功',
                feedbackId: feedback.id
            }
        });
    } catch (error: any) {
        console.error('提交反馈异常:', error);
        return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>({
            success: false,
            message: error.message || '提交反馈失败',
            data: {
                success: false,
                message: error.message || '提交反馈失败'
            }
        }, { status: 500 });
    }
}
