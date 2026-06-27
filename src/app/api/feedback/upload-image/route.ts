import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { buildDatedKey, cosUpload } from '@/lib/cos';
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
        return NextResponse.json<ApiData<null>>(
            { success: false, message: '缺少图片文件', data: null },
            { status: 400 },
        );
    }

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedTypes.has(file.type)) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: '反馈截图仅支持 JPG、PNG、WebP', data: null },
            { status: 400 },
        );
    }

    const maxSizeBytes = 8 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: '单张截图请小于 8MB', data: null },
            { status: 413 },
        );
    }

    try {
        const key = buildDatedKey(getExtension(file), auth.userId, 'feedback');
        const bytes = new Uint8Array(await file.arrayBuffer());
        const uploaded = await cosUpload('feedback-images', key, bytes, {
            contentType: file.type,
            cacheControl: 'public, max-age=31536000, immutable',
        });

        return NextResponse.json<ApiData<UploadFeedbackImageResponseDto>>({
            success: true,
            message: '上传成功',
            data: {
                imageUrl: uploaded.url,
                url: uploaded.url,
                storage_bucket: 'feedback-images',
                storage_path: key,
            },
        });
    } catch (error: any) {
        console.error('[feedback/upload-image] upload error:', error);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: error?.message || '上传失败', data: null },
            { status: 500 },
        );
    }
}
