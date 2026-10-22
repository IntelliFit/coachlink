import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { getAuthUser } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';
import { serviceRoleSupabase } from '@/lib/supabaseClient';
import {
    sanitizeCoachTrack,
    sanitizeServiceModes,
    sanitizeTargetStudentLevels,
} from '@/lib/coachApplicationOptions';
import {
    deriveLegacyFieldsFromMaterials,
    normalizeCoachApplicationMaterials,
} from '@/lib/coachApplicationMaterials';
import { notifyPlatformOwners } from '@/lib/platformNotice';
import { isValidCoachContactPhone } from '@coachlink/core/src/coachPolicy';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type {
    CreateCoachApplicationDto,
    CreateCoachApplicationResponseDto
} from './entity';

async function loadAccountPhone(userId: string): Promise<string | null> {
    const { data, error } = await serviceRoleSupabase
        .from('users')
        .select('phone')
        .eq('id', userId)
        .maybeSingle();
    if (error) {
        console.error('[create-coach-application] load account phone failed:', error);
        return null;
    }
    return data?.phone || null;
}

export async function POST(req: Request) {
    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id }
        : await getAuthUser(req);
    if (!authResult.isAuthenticated || !authResult.userId) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    // 通过 session 获取用户 ID
    const userId = authResult.userId;

    const body = await req.json() as CreateCoachApplicationDto;

    // 审核要电话联系申请人。新版三端都必填；老版本客户端可能没传，用账号手机号兜底，
    // 不直接拒绝——老版小程序服务层失败不抛错，拒绝会被当成「已提交」吞掉。
    const submittedPhone = String(body.contactPhone ?? '').trim();
    if (submittedPhone && !isValidCoachContactPhone(submittedPhone)) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '请填写有效的手机号',
            data: null
        }, { status: 400 });
    }
    const contactPhone = submittedPhone || await loadAccountPhone(userId);

    const coachTrack = sanitizeCoachTrack(body.coachTrack);
    const serviceModes = sanitizeServiceModes(body.serviceModes);
    const targetStudentLevels = sanitizeTargetStudentLevels(body.targetStudentLevels);
    const applicationMaterials = normalizeCoachApplicationMaterials(
        body.applicationMaterials,
        {
            achievements: body.achievements,
            caseStudies: body.caseStudies,
            credentials: body.credentials as any,
            socialLinks: body.socialLinks as any,
        },
    );
    const legacyFields = deriveLegacyFieldsFromMaterials(applicationMaterials, {
        achievements: body.achievements,
        caseStudies: body.caseStudies,
        credentials: body.credentials as any,
        socialLinks: body.socialLinks as any,
    });

    // 插入教练申请记录
    const { data, error } = await supabase
        .from('coach_applications')
        .insert({
            user_id: userId,
            name: body.name,
            title: body.title,
            avatar_url: body.avatarUrl,
            specialties: body.specialties,
            bio: body.bio,
            years_experience: body.yearsExperience,
            achievements: legacyFields.achievements,
            teaching_philosophy: body.teachingPhilosophy,
            credentials: legacyFields.credentials,
            case_studies: legacyFields.caseStudies,
            application_materials: applicationMaterials,
            contact_email: body.contactEmail,
            contact_phone: contactPhone,
            resume_url: body.resumeUrl,
            portfolio_url: body.portfolioUrl,
            social_links: legacyFields.socialLinks,
            coach_track: coachTrack,
            service_modes: serviceModes,
            target_student_levels: targetStudentLevels,
            support_focus: body.supportFocus ?? null,
            province: body.province ?? null,
            city: body.city ?? null,
            county: body.county ?? null,
            address: body.address ?? null,
            latitude: body.latitude ?? null,
            longitude: body.longitude ?? null,
            applied_at: new Date().toISOString(),
            status: 'pending'
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '创建教练申请失败: ' + error.message,
            data: null
        }, { status: 500 });
    }

    await serviceRoleSupabase
        .from('users')
        .update({
            coach_status: 'pending',
            is_coach: false,
        })
        .eq('id', userId);

    await notifyPlatformOwners({
        kind: 'coach_application_new',
        title: '新的教练申请',
        fields: [
            ['申请人', body.name],
            ['头衔', body.title],
            ['从业年限', body.yearsExperience],
            ['城市', [body.province, body.city].filter(Boolean).join(' ')],
            ['联系电话', contactPhone || '未留手机号'],
        ],
        adminPath: '/admin/coach-applications',
    });

    // 重要！必须声明接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<CreateCoachApplicationResponseDto>>({
        success: true,
        message: '教练申请创建成功',
        // CreateCoachApplicationResponseDto 反映的是这里的 data 数据结构
        data: {
            application: data
        }
    });
}
