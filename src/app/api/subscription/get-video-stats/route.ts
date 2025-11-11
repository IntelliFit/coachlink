import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import type { GetVideoStatsDto, GetVideoStatsResponseDto } from './entity';
export async function POST(req: Request) {
    try {
        // 🔐 验证登录
        const session = await getServerSession();
        if (!session || !session.user?.email) {
            return NextResponse.json({
                success: false,
                message: 'Unauthorized',
                data: null,
            });
        }

        const userId = session.user.id;

        // 📦 查询 training_videos 表
        const { data: videos, error } = await supabase
            .from('training_videos')
            .select('*')
            .eq('user_id', userId);

        if (error) {
            console.error('获取视频统计失败:', error);
            return NextResponse.json({
                success: false,
                message: '获取视频统计失败',
                data: null,
            });
        }

        // 📊 统计逻辑
        const stats: GetVideoStatsResponseDto = {
            total: videos.length,
            pending: videos.filter((v) => v.review_status === 'pending').length,
            reviewed: videos.filter((v) => v.review_status === 'reviewed').length,
            not_required: videos.filter((v) => v.review_status === 'not_required').length,
            averageRating: 0,
        };

        const ratedVideos = videos.filter((v) => (v.coach_feedback as any).rating);
        if (ratedVideos.length > 0) {
            const totalRating = ratedVideos.reduce((sum, v) => sum + ((v.coach_feedback as any).rating || 0), 0);
            stats.averageRating = totalRating / ratedVideos.length;
        }

        // ✅ 返回统一格式
        return NextResponse.json({
            success: true,
            message: '获取视频统计成功',
            data: stats,
        });
    } catch (error: any) {
        console.error('❌ 获取视频统计错误:', error);
        return NextResponse.json({
            success: false,
            message: '服务器错误，请稍后重试',
            data: null,
        });
    }
}
