import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

export async function POST(request: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json({
                success: false,
                message: '用户未登录',
                data: null
            }, { status: 401 });
        }

        const { userId, videoUrl, context } = await request.json();

        // 验证用户ID
        if (!userId) {
            return NextResponse.json({
                success: false,
                message: '缺少用户ID',
                data: null
            }, { status: 400 });
        }

        // 验证URL
        if (!videoUrl) {
            return NextResponse.json({
                success: false,
                message: '缺少视频URL',
                data: null
            }, { status: 400 });
        }

        // 获取当前登录用户信息和关联的教练
        let authUserId: string | null = null;
        let studentName: string | null = null;
        let coachId: string | null = null;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            authUserId = user?.id ?? null;

            if (authUserId) {
                // 获取用户资料中的姓名
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('full_name, nickname')
                    .eq('user_id', authUserId)
                    .single();

                studentName = profile?.full_name || profile?.nickname || null;

                // 获取当前活跃的教练订阅
                const { data: subscription } = await supabase
                    .from('coach_subscriptions')
                    .select('coach_id')
                    .eq('student_id', authUserId)
                    .eq('status', 'active')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                coachId = subscription?.coach_id || (context as any).coach_id || null;
            }
        } catch {
            // 如果获取失败，尝试从 context 中获取
            coachId = (context as any).coach_id || null;
        }

        // 验证URL格式
        let isValidUrl = false;
        try {
            const urlObj = new URL(videoUrl);
            isValidUrl = urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            isValidUrl = false;
        }

        if (!isValidUrl) {
            return NextResponse.json({
                success: false,
                message: '无效的视频URL',
                data: null
            }, { status: 400 });
        }

        const urlFolder = authUserId || userId || 'anonymous';
        const videoData = {
            user_id: authUserId || null,
            coach_id: coachId,
            type: context.type,
            training_plan_id: context.training_plan_id,
            training_session_id: context.training_session_id,
            exercise_name: context.exercise_name,
            week_number: context.week_number,
            day_of_week: context.day_of_week,
            video_url: videoUrl,
            requires_review: context.requires_review ?? true,
            review_status: 'pending' as const,
            user_notes: context.user_notes,
            processing_status: 'ready' as const,
            tags: [], // 简化处理，实际应根据context生成标签
            metadata: {
                storage_folder: urlFolder,
                student_name: studentName || (context as any).student_name || null,
                submission_source: 'url_submission'
            }
        };

        const { data, error } = await supabase
            .from('training_videos')
            .insert(videoData)
            .select()
            .single();

        if (error) {
            throw new Error(`数据库记录创建失败: ${error.message}`);
        }

        return NextResponse.json({
            success: true,
            message: '提交视频URL成功',
            data
        });
    } catch (error: any) {
        console.error('提交视频URL失败:', error);
        return NextResponse.json({
            success: false,
            message: error.message || '提交视频URL失败',
            data: null
        }, { status: 500 });
    }
}