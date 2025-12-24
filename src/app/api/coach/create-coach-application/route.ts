import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

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
            achievements: body.achievements,
            teaching_philosophy: body.teachingPhilosophy,
            credentials: body.credentials,
            case_studies: body.caseStudies,
            contact_email: body.contactEmail,
            contact_phone: body.contactPhone,
            resume_url: body.resumeUrl,
            portfolio_url: body.portfolioUrl,
            social_links: body.socialLinks,
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