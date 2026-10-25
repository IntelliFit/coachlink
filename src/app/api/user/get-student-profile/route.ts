import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { ApiData } from '@/types/api';
import { GetStudentProfileResponseDto } from './entity';
import { getAuthUser } from '@/lib/auth';
import { PUBLIC_PROFILE_COLUMNS, resolveProfileAccess } from '@/lib/profileAccess';

export async function POST(request: Request) {
    // 使用统一鉴权函数,支持session和token两种方式
    const authResult = await getAuthUser(request);
    if (!authResult.isAuthenticated || !authResult.userId) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const { userId } = await request.json().catch(() => ({})) as { userId?: unknown };
    if (userId !== undefined && userId !== null && typeof userId !== 'string') {
        return NextResponse.json({
            success: false,
            message: 'userId 参数无效',
            data: null
        }, { status: 400 });
    }
    const targetUserId = userId || authResult.userId;

    // body 里的 userId 只决定"看谁"：本人/管理员/该学员的教练拿完整档案，
    // 其他用户（如小程序好友主页）只拿公开名片字段，不返回问卷、视频、生活记录
    const access = await resolveProfileAccess({
        viewerId: authResult.userId,
        targetUserId,
        viewerIsAdmin: authResult.user?.is_admin === true,
    });

    if (access === 'public') {
        const { data: profile } = await supabase
            .from('user_profiles')
            .select(PUBLIC_PROFILE_COLUMNS)
            .eq('user_id', targetUserId)
            .maybeSingle();

        return NextResponse.json<ApiData<GetStudentProfileResponseDto>>({
            success: true,
            message: '获取学员档案成功',
            data: {
                profile: profile || null,
                questionnaire: null,
                videos: [],
                lifestyle: []
            }
        });
    }

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
