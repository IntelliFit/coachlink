import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';
import { logError, logInfo, withOperation } from '@/lib/observability/logger';
import { recordFeedbackSubmission } from '@/lib/observability/metrics';
import { currentTraceContext } from '@/lib/observability/requestContext';
import type { ApiData } from '@/types/api';
import type { Json } from '@/types/database.types';
import type { FeedbackCategory, RecentRequestTraceDto, SubmitFeedbackDto, SubmitFeedbackResponseDto } from './entity';

const VALID_CATEGORIES = new Set<FeedbackCategory>(['bug', 'suggestion', 'experience', 'other']);
const MAX_CONTENT_LENGTH = 2000;
const MIN_CONTENT_LENGTH = 5;
const MAX_CONTACT_LENGTH = 200;
const MAX_PAGE_PATH_LENGTH = 240;
const MAX_APP_VERSION_LENGTH = 80;
const MAX_RECENT_REQUESTS = 50;
const MAX_IMAGES = 4;

function isLegacySubmitPayload(body: SubmitFeedbackDto) {
    return !('category' in body)
        && !('contact' in body)
        && !('page_path' in body)
        && !('app_version' in body)
        && !('client_info' in body)
        && !('recent_requests' in body)
        && !('image_urls' in body);
}

function jsonResponse(message: string, status: number) {
    return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>(
        {
            success: false,
            message,
            data: {
                success: false,
                message,
            },
        },
        { status },
    );
}

function text(value: unknown, maxLength: number) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, maxLength);
}

function normalizeCategory(value: unknown, relatedQuestion?: string): FeedbackCategory {
    if (typeof value === 'string' && VALID_CATEGORIES.has(value as FeedbackCategory)) {
        return value as FeedbackCategory;
    }
    return relatedQuestion ? 'suggestion' : 'other';
}

function normalizeClientInfo(value: unknown): Json {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Json;
}

function normalizeImageUrls(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, MAX_IMAGES);
}

function normalizeRecentRequests(value: unknown): RecentRequestTraceDto[] {
    if (!Array.isArray(value)) return [];
    return value.slice(0, MAX_RECENT_REQUESTS).map((item) => {
        const source = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        const out: RecentRequestTraceDto = {};
        const id = text(source.id, 80);
        const method = text(source.method, 12).toUpperCase();
        const url = text(source.url, MAX_PAGE_PATH_LENGTH);
        const message = text(source.message, 160);
        const startedAt = text(source.started_at, 40);
        const requestId = text(source.request_id, 100);
        const traceId = text(source.trace_id, 100);
        const status = typeof source.status === 'number' || typeof source.status === 'string' ? source.status : null;
        const duration = typeof source.duration_ms === 'number' && Number.isFinite(source.duration_ms)
            ? Math.max(0, Math.round(source.duration_ms))
            : null;

        if (id) out.id = id;
        if (method) out.method = method;
        if (url) out.url = url;
        if (status !== null) out.status = status;
        if (typeof source.success === 'boolean') out.success = source.success;
        if (duration !== null) out.duration_ms = duration;
        if (startedAt) out.started_at = startedAt;
        if (requestId) out.request_id = requestId;
        if (traceId) out.trace_id = traceId;
        if (message) out.message = message;
        return out;
    });
}

function header(req: Request, name: string) {
    return typeof req.headers?.get === 'function' ? req.headers.get(name) || '' : '';
}

export async function POST(req: Request) {
    const auth = await getAuthUser(req);
    if (!auth.isAuthenticated || !auth.userId) {
        return jsonResponse('用户未登录', 401);
    }

    const body = (await req.json().catch(() => null)) as SubmitFeedbackDto | null;
    if (!body || typeof body !== 'object') {
        return jsonResponse('请求格式错误', 400);
    }

    const content = text(body.content, MAX_CONTENT_LENGTH);
    if (!content) {
        return jsonResponse('反馈内容不能为空', 400);
    }
    const legacySubmitPayload = isLegacySubmitPayload(body);
    if (!legacySubmitPayload && content.length < MIN_CONTENT_LENGTH) {
        return jsonResponse(`反馈内容至少需要${MIN_CONTENT_LENGTH}个字`, 400);
    }

    const relatedQuestion = text(body.relatedQuestion, 240);
    const category = normalizeCategory(body.category, relatedQuestion);
    const clientInfo = normalizeClientInfo(body.client_info);
    const imageUrls = normalizeImageUrls(body.image_urls);
    const recentRequests = normalizeRecentRequests(body.recent_requests);
    const primaryTrace = recentRequests.find((item) => item.trace_id || item.request_id);
    const activeTrace = currentTraceContext();
    const submitTraceId = text(
        activeTrace?.traceId ||
        header(req, 'x-trace-id') ||
        header(req, 'x-client-trace-id') ||
        primaryTrace?.trace_id,
        100,
    );
    const submitRequestId = text(
        activeTrace?.requestId ||
        header(req, 'x-request-id') ||
        header(req, 'x-client-request-id') ||
        primaryTrace?.request_id,
        100,
    );
    const submitHostName = text(
        activeTrace?.hostName ||
        header(req, 'x-host-name') ||
        header(req, 'host') ||
        header(req, 'x-forwarded-host'),
        160,
    );
    const operationFields = {
        user_id: auth.userId,
        category,
        legacy_payload: legacySubmitPayload,
        image_count: imageUrls.length,
        recent_request_count: recentRequests.length,
        submit_trace_id: submitTraceId,
        submit_request_id: submitRequestId,
    };

    try {
        const insertPayload = legacySubmitPayload
            ? {
                user_id: auth.userId,
                content,
                related_question: relatedQuestion || null,
                status: 'pending',
            }
            : {
                user_id: auth.userId,
                content,
                related_question: relatedQuestion || null,
                category,
                contact: text(body.contact, MAX_CONTACT_LENGTH),
                page_path: text(body.page_path, MAX_PAGE_PATH_LENGTH),
                app_version: text(body.app_version, MAX_APP_VERSION_LENGTH),
                client_info: clientInfo,
                recent_requests: recentRequests as Json,
                image_urls: imageUrls as Json,
                submit_trace_id: submitTraceId,
                submit_request_id: submitRequestId,
                submit_host_name: submitHostName,
                status: 'open',
                updated_at: new Date().toISOString(),
            };

        const feedback = await withOperation('feedback_submit', operationFields, async () => {
            const { data, error } = await supabase
                .from('feedbacks')
                .insert(insertPayload)
                .select('id')
                .single();

            if (error || !data) {
                throw error || new Error('反馈写入后未返回 id');
            }

            return data;
        });

        recordFeedbackSubmission('success', category, imageUrls.length, recentRequests.length);
        logInfo('用户反馈提交成功', {
            ...operationFields,
            feedback_id: feedback.id,
        });

        return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>({
            success: true,
            message: '反馈提交成功',
            data: {
                success: true,
                message: '反馈提交成功',
                feedbackId: feedback.id,
                id: feedback.id,
            },
        });
    } catch (error: any) {
        recordFeedbackSubmission('error', category, imageUrls.length, recentRequests.length);
        logError('用户反馈提交失败', error, operationFields);
        return jsonResponse(error?.message || '提交反馈失败', 500);
    }
}
