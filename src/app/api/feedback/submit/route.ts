import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { SubmitFeedbackResponseDto } from './entity';
import { normalizeFeedbackSubmission } from '@/lib/feedbackSubmission';
import { currentTraceContext } from '@/lib/observability/requestContext';
import { getNoticeUserName, notifyPlatformOwners } from '@/lib/platformNotice';

export async function POST(req: Request) {
    const auth = await getAuthUser(req);
    if (!auth.isAuthenticated || !auth.userId) {
        return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>({
            success: false,
            message: '用户未登录',
            data: {
                success: false,
                message: '用户未登录'
            }
        }, { status: 401 });
    }

    const normalized = normalizeFeedbackSubmission(await req.json().catch(() => null));
    if (!normalized.ok) {
        return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>({
            success: false,
            message: normalized.message,
            data: {
                success: false,
                message: normalized.message
            }
        }, { status: 400 });
    }

    const userId = auth.userId;
    const value = normalized.value;
    const trace = currentTraceContext();
    const requestHeaders = typeof req.headers?.get === 'function' ? req.headers : null;

    try {
        // 插入反馈记录
        const { data: feedback, error } = await supabase
            .from('feedbacks')
            .insert({
                user_id: userId,
                content: value.content,
                related_question: value.relatedQuestion || null,
                status: 'open',
                category: value.category,
                contact: value.contact,
                page_path: value.pagePath,
                app_version: value.appVersion,
                client_info: value.clientInfo,
                recent_requests: value.recentRequests,
                image_urls: value.imageUrls,
                submit_trace_id: trace?.traceId || '',
                submit_request_id: trace?.requestId || '',
                submit_host_name: requestHeaders?.get('x-forwarded-host') || requestHeaders?.get('host') || '',
            } as any)
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

        await notifyPlatformOwners({
            kind: 'feedback_new',
            title: '新的用户反馈',
            fields: [
                ['用户', await getNoticeUserName(userId)],
                ['类型', value.category],
                ['内容', value.content],
                ['页面', value.pagePath],
            ],
            adminPath: '/admin/feedback',
        });

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
