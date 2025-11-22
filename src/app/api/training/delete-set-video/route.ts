import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import supabase from '@/lib/supabaseClient';
import type { DeleteSetVideoDto, DeleteSetVideoResponseDto } from './entity';

/**
 * POST /api/training/delete-set-video
 * 
 * 删除组视频
 */
export async function POST(request: NextRequest) {
    try {
        // 1. 验证用户身份
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json<DeleteSetVideoResponseDto>(
                { success: false, message: '未登录' },
                { status: 401 }
            );
        }

        const userId = session.user.id;

        // 2. 解析请求参数
        const body: DeleteSetVideoDto = await request.json();
        const { video_id } = body;

        // 3. 验证必填参数
        if (!video_id) {
            return NextResponse.json<DeleteSetVideoResponseDto>(
                { success: false, message: '缺少视频ID' },
                { status: 400 }
            );
        }

        // 4. 查询视频记录，验证权限（获取完整信息包括 video_url）
        const { data: video, error: videoError } = await supabase
            .from('set_videos')
            .select('training_record_id, video_url')
            .eq('id', video_id)
            .single();

        if (videoError || !video) {
            return NextResponse.json<DeleteSetVideoResponseDto>(
                { success: false, message: '视频不存在' },
                { status: 404 }
            );
        }

        // 5. 验证训练记录是否属于当前用户
        const { data: record, error: recordError } = await supabase
            .from('training_records')
            .select('user_id')
            .eq('id', video.training_record_id)
            .single();

        if (recordError || !record) {
            return NextResponse.json<DeleteSetVideoResponseDto>(
                { success: false, message: '训练记录不存在' },
                { status: 404 }
            );
        }

        if (record.user_id !== userId) {
            return NextResponse.json<DeleteSetVideoResponseDto>(
                { success: false, message: '无权删除此视频' },
                { status: 403 }
            );
        }

        // 6. 如果视频存储在 Supabase Storage 中，删除文件
        if (video.video_url) {
            try {
                // 判断是否为 Supabase Storage URL
                const storageUrl = process.env.NEXT_SUPABASE_URL;
                if (storageUrl && video.video_url.includes(storageUrl)) {
                    // 从 URL 中提取文件路径
                    // URL 格式: https://{project}.supabase.co/storage/v1/object/public/videos/{userId}/{fileName}
                    const urlParts = video.video_url.split('/videos/');
                    if (urlParts.length === 2) {
                        const filePath = urlParts[1];
                        
                        // 从 Storage 中删除文件
                        const { error: storageError } = await supabase.storage
                            .from('videos')
                            .remove([filePath]);
                        
                        if (storageError) {
                            console.error('删除 Storage 文件失败:', storageError);
                            // 继续删除数据库记录，即使文件删除失败
                        } else {
                            console.log('成功删除 Storage 文件:', filePath);
                        }
                    }
                }
            } catch (storageErr) {
                console.error('处理 Storage 文件删除时出错:', storageErr);
                // 继续删除数据库记录
            }
        }

        // 7. 删除数据库中的视频记录
        const { error: deleteError } = await supabase
            .from('set_videos')
            .delete()
            .eq('id', video_id);

        if (deleteError) {
            console.error('删除视频记录失败:', deleteError);
            return NextResponse.json<DeleteSetVideoResponseDto>(
                { success: false, message: '删除视频失败' },
                { status: 500 }
            );
        }

        // 8. 返回成功响应
        return NextResponse.json<DeleteSetVideoResponseDto>({
            success: true,
            message: '视频已删除'
        });

    } catch (error) {
        console.error('删除组视频失败:', error);
        return NextResponse.json<DeleteSetVideoResponseDto>(
            { success: false, message: '服务器错误' },
            { status: 500 }
        );
    }
}

