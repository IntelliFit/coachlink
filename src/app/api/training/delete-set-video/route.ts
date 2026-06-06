import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import supabase from '@/lib/supabaseClient';
import { cosRemoveByUrl } from '@/lib/cos';
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

        // 6. 删除 COS 中的视频文件（无法识别的 URL 会被忽略，不阻断 DB 删除）
        if (video.video_url) {
            await cosRemoveByUrl([video.video_url]).catch((storageErr) => {
                console.error('删除 COS 文件失败:', storageErr);
            });
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

