import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import { UploadVideoDto } from './entity';

export async function POST(request: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const userId = session.user.id;

    // 注意：文件上传需要特殊处理，这里只是示例
    // 实际项目中应该使用 form-data 解析文件
    const {
        context
    } = await request.json() as UploadVideoDto;

    // 验证用户ID
    if (!userId) {
        return NextResponse.json({
            success: false,
            message: '缺少用户ID',
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

    // 这里应该处理实际的文件上传，但由于 Next.js API Routes 对文件上传的支持有限
    // 实际项目中应该使用单独的文件上传服务或者使用第三方服务如 AWS S3

    // 模拟返回数据
    const mockVideoData = {
        id: 'mock-video-id',
        user_id: authUserId || null,
        coach_id: coachId,
        type: context.type,
        training_plan_id: context.training_plan_id,
        training_session_id: context.training_session_id,
        exercise_name: context.exercise_name,
        week_number: context.week_number,
        day_of_week: context.day_of_week,
        video_url: 'https://example.com/video.mp4',
        thumbnail_url: 'https://example.com/thumbnail.jpg',
        file_size: 0,
        requires_review: context.requires_review ?? true,
        review_status: 'pending',
        user_notes: context.user_notes,
        processing_status: 'ready',
        tags: [],
        metadata: {
            storage_folder: authUserId || userId || 'anonymous',
            student_name: studentName || (context as any).student_name || null,
            submission_source: 'file_upload'
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    return NextResponse.json({
        success: true,
        message: '上传视频成功',
        data: mockVideoData
    });

}