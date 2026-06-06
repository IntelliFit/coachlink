import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
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

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type {
    CreateCoachApplicationDto,
    CreateCoachApplicationResponseDto
} from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    // 通过 session 获取用户 ID
    const userId = session.user.id;

    const body = await req.json() as CreateCoachApplicationDto;
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
            contact_phone: body.contactPhone,
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
