import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { buildDatedKey, cosUpload } from '@/lib/cos';
import { logError, logInfo, withOperation } from '@/lib/observability/logger';
import { recordFeedbackImageUpload } from '@/lib/observability/metrics';
import { currentTraceContext } from '@/lib/observability/requestContext';
import type { ApiData } from '@/types/api';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const preferredRegion = 'auto';

interface UploadFeedbackImageResponseDto {
    imageUrl: string;
    url: string;
    storage_bucket: string;
    storage_path: string;
}

function getExtension(file: File) {
    const fromName = file.name.split('.').pop()?.toLowerCase();
    if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName === 'jpeg' ? 'jpg' : fromName;
    if (file.type === 'image/png') return 'png';
    if (file.type === 'image/webp') return 'webp';
    return 'jpg';
}

export async function POST(req: Request) {
    const auth = await getAuthUser(req);
    if (!auth.isAuthenticated || !auth.userId) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: '用户未登录', data: null },
            { status: 401 },
        );
    }

    const formData = await req.formData().catch(() => null);
    const file = formData?.get('file') as File | null;
    if (!file) {
        recordFeedbackImageUpload('missing_file', 0);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: '缺少图片文件', data: null },
            { status: 400 },
        );
    }

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedTypes.has(file.type)) {
        recordFeedbackImageUpload('unsupported_type', file.size || 0);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: '反馈截图仅支持 JPG、PNG、WebP', data: null },
            { status: 400 },
        );
    }

    const maxSizeBytes = 8 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        recordFeedbackImageUpload('too_large', file.size || 0);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: '单张截图请小于 8MB', data: null },
            { status: 413 },
        );
    }

    const traceContext = currentTraceContext();
    const operationFields = {
        user_id: auth.userId,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        trace_id: traceContext?.traceId || '',
        request_id: traceContext?.requestId || '',
    };

    try {
        const uploaded = await withOperation('feedback_image_upload', operationFields, async () => {
            const key = buildDatedKey(getExtension(file), auth.userId, 'feedback');
            const bytes = new Uint8Array(await file.arrayBuffer());
            const result = await cosUpload('feedback-images', key, bytes, {
                contentType: file.type,
                cacheControl: 'public, max-age=31536000, immutable',
            });
            return { ...result, key };
        });

        recordFeedbackImageUpload('success', file.size || 0);
        logInfo('反馈截图上传成功', {
            ...operationFields,
            storage_bucket: 'feedback-images',
            storage_path: uploaded.key,
        });

        return NextResponse.json<ApiData<UploadFeedbackImageResponseDto>>({
            success: true,
            message: '上传成功',
            data: {
                imageUrl: uploaded.url,
                url: uploaded.url,
                storage_bucket: 'feedback-images',
                storage_path: uploaded.key,
            },
        });
    } catch (error: any) {
        recordFeedbackImageUpload('error', file.size || 0);
        logError('反馈截图上传失败', error, operationFields);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: error?.message || '上传失败', data: null },
            { status: 500 },
        );
    }
}
