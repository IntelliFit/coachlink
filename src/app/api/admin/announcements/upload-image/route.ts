import { NextResponse } from 'next/server';
import { buildDatedKey, cosUpload } from '@/lib/cos';
import type { ApiData } from '@/types/api';
import { fail, requireAnnouncementAdmin } from '../adminAuth';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

/** 公告封面/正文图片，存公开的 chat-images 桶下 announcements/ 前缀。 */
export async function POST(req: Request) {
    const auth = await requireAnnouncementAdmin();
    if (!auth.ok) return auth.response;

    try {
        const formData = await req.formData();
        const file = formData.get('file');
        if (!(file instanceof File)) return fail('未选择文件', 400);
        const ext = ALLOWED_TYPES[file.type];
        if (!ext) return fail('仅支持 PNG/JPEG/WEBP/GIF 图片', 400);
        if (file.size > MAX_SIZE) return fail('图片不能超过 5MB', 400);

        const buffer = Buffer.from(await file.arrayBuffer());
        const key = buildDatedKey(ext, 'announcements');
        const { url } = await cosUpload('chat-images', key, buffer, { contentType: file.type });
        return NextResponse.json<ApiData<{ url: string }>>({ success: true, data: { url } });
    } catch (error) {
        console.error('[admin/announcements] upload failed:', error);
        return fail('上传失败', 500);
    }
}
