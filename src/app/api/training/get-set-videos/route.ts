import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import supabase from '@/lib/supabaseClient';
import type { GetSetVideosDto, GetSetVideosResponseDto, SetVideoData } from './entity';

/**
 * POST /api/training/get-set-videos
 * 
 * 获取训练记录的所有组视频
 */
export async function POST(request: NextRequest) {
    try {
        // 1. 验证用户身份
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json<GetSetVideosResponseDto>(
                { success: false, message: '未登录' },
                { status: 401 }
            );
        }

        const userId = session.user.id;

        // 2. 解析请求参数
        const body: GetSetVideosDto = await request.json();
        const { training_record_id } = body;

        // 3. 验证必填参数
        if (!training_record_id) {
            return NextResponse.json<GetSetVideosResponseDto>(
                { success: false, message: '缺少训练记录ID' },
                { status: 400 }
            );
        }

        // 4. 验证训练记录是否属于当前用户
        const { data: record, error: recordError } = await supabase
            .from('training_records')
            .select('user_id')
            .eq('id', training_record_id)
            .single();

        if (recordError || !record) {
            return NextResponse.json<GetSetVideosResponseDto>(
                { success: false, message: '训练记录不存在' },
                { status: 404 }
            );
        }

        if (record.user_id !== userId) {
            return NextResponse.json<GetSetVideosResponseDto>(
                { success: false, message: '无权访问此训练记录' },
                { status: 403 }
            );
        }

        // 6. 查询所有组视频
        const { data: videos, error: videosError } = await supabase
            .from('set_videos')
            .select('*')
            .eq('training_record_id', training_record_id)
            .order('exercise_index', { ascending: true })
            .order('set_index', { ascending: true });

        if (videosError) {
            console.error('查询组视频失败:', videosError);
            return NextResponse.json<GetSetVideosResponseDto>(
                { success: false, message: '查询视频失败' },
                { status: 500 }
            );
        }

        // 7. 转换数据格式
        const videoData: SetVideoData[] = (videos || []).map(video => ({
            id: video.id,
            training_record_id: video.training_record_id,
            exercise_index: video.exercise_index,
            set_index: video.set_index,
            video_url: video.video_url,
            thumbnail_url: video.thumbnail_url || undefined,
            duration_seconds: video.duration_seconds || undefined,
            file_size_bytes: video.file_size_bytes || undefined,
            upload_status: video.upload_status,
            coach_feedback: video.coach_feedback || undefined,
            coach_rating: video.coach_rating || undefined,
            reviewed_at: video.reviewed_at || undefined,
            reviewed_by: video.reviewed_by || undefined,
            created_at: video.created_at
        }));

        // 8. 返回成功响应
        return NextResponse.json<GetSetVideosResponseDto>({
            success: true,
            data: videoData
        });

    } catch (error) {
        console.error('获取组视频失败:', error);
        return NextResponse.json<GetSetVideosResponseDto>(
            { success: false, message: '服务器错误' },
            { status: 500 }
        );
    }
}

