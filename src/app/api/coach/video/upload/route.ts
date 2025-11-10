import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import supabase from '@/lib/supabaseClient';

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, message: '未登录用户' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File;
        const contextRaw = formData.get('context');
        const context = contextRaw ? JSON.parse(contextRaw as string) : {};

        if (!file) {
            return NextResponse.json({ success: false, message: '未提供文件' }, { status: 400 });
        }

        const userId = session.user.id;
        const fileName = `${Date.now()}-${file.name}`;
        const folderPrefix = userId || 'anonymous';
        const filePath = `${folderPrefix}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('videos').upload(filePath, file);
        if (uploadError) {
            console.error('上传失败:', uploadError);
            return NextResponse.json({ success: false, message: '上传视频失败' });
        }

        const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(filePath);

        const { data, error } = await supabase
            .from('training_videos')
            .insert({
                user_id: userId,
                coach_id: context.coach_id ?? null,
                type: context.type,
                video_url: publicUrl,
                thumbnail_url: publicUrl,
                requires_review: context.requires_review ?? true,
                review_status: 'pending',
                processing_status: 'ready',
                metadata: {
                    storage_folder: folderPrefix,
                    submission_source: 'file_upload',
                },
            })
            .select()
            .single();

        if (error) {
            console.error('数据库记录创建失败:', error);
            return NextResponse.json({ success: false, message: '创建视频记录失败' });
        }

        return NextResponse.json({ success: true, message: '上传成功', data });
    } catch (err) {
        console.error('上传视频异常:', err);
        return NextResponse.json({ success: false, message: '服务器内部错误' }, { status: 500 });
    }
}
