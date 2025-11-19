import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { UploadVideoDto, UploadVideoResponseDto } from './entity';
import type { SubmitVideoUrlDto } from '@/app/api/user/submit-video-url/entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    // 重点！通过 session 获取用户 ID
    const userId = session.user.id;

    try {
        // 获取表单数据
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const contextString = formData.get('context') as string;
        
        if (!file || !contextString) {
            return NextResponse.json({
                success: false,
                message: '缺少必要参数',
                data: null
            }, { status: 400 });
        }

        const context = JSON.parse(contextString);

        // 上传到 Supabase Storage
        const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
        const safeName = `${Date.now()}-${uuidv4()}.${ext}`;
        const filePath = `${userId}/${safeName}`;

        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const { error: uploadError } = await supabase.storage
            .from('videos')
            .upload(filePath, uint8Array, { 
                contentType: file.type,
                upsert: false 
            });

        if (uploadError) {
            throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('videos')
            .getPublicUrl(filePath);

        // 调用 submit-video-url 接口保存数据库记录
        const submitVideoUrlDto: SubmitVideoUrlDto = {
            videoUrl: publicUrl,
            context: { ...context, user_id: userId }
        };

        const submitResponse = await fetch(
            `${new URL(req.url).origin}/api/user/submit-video-url`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(submitVideoUrlDto),
            }
        );

        const submitResult = await submitResponse.json();

        if (!submitResult.success) {
            throw new Error(submitResult.message || '保存视频记录失败');
        }

        // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
        return NextResponse.json<ApiData<UploadVideoResponseDto>>({
            success: true,
            message: '视频上传成功',
            data: submitResult.data
        });
    } catch (error: any) {
        console.error('视频上传失败:', error);
        
        return NextResponse.json({
            success: false,
            message: error?.message || '视频上传失败',
            data: null
        }, { status: 500 });
    }
}