import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import { ApiData } from '@/types/api';
import { GetStudentProfileResponseDto } from './entity';

export async function POST(request: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const { userId } = await request.json();
    const targetUserId = userId || session.user.id;

    // 直接数据库查询聚合：用户档案、最近问卷、视频、生活记录
    const [{ data: profile }, { data: questionnaire }, { data: videos }, { data: lifestyle }] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('user_id', targetUserId).maybeSingle(),
        supabase.from('onboarding_questionnaires').select('*').eq('user_id', targetUserId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('training_videos').select('*').eq('user_id', targetUserId).order('created_at', { ascending: false }).limit(20),
        supabase.from('lifestyle_logs').select('*').eq('user_id', targetUserId).order('log_date', { ascending: false }).limit(14),
    ]);

    return NextResponse.json<ApiData<GetStudentProfileResponseDto>>({
        success: true,
        message: '获取学员档案成功',
        data: {
            profile: profile || null,
            questionnaire: questionnaire || null,
            videos: videos || [],
            lifestyle: lifestyle || []
        }
    });
}