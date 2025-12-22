import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type {
    UpdateCoachApplicationDto,
    UpdateCoachApplicationResponseDto
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
    const userProfile = session.profile;

    const body = await req.json() as UpdateCoachApplicationDto;

    // 首先获取申请记录以检查权限
    const { data: existingApplication, error: selectError } = await supabase
        .from('coach_applications')
        .select('*')
        .eq('id', body.id)
        .maybeSingle();

    if (selectError) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '查询教练申请失败: ' + selectError.message,
            data: null
        }, { status: 500 });
    }

    if (!existingApplication) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '未找到指定的教练申请',
            data: null
        }, { status: 404 });
    }

    // 检查权限：
    // 1. 如果是普通用户，只能更新自己的申请，且不能更新状态和审核相关信息
    // 2. 如果是管理员，可以更新任何申请的所有字段
    const isAdmin = userProfile?.role === 'admin';
    const isOwner = existingApplication.user_id === userId;

    if (!isAdmin && !isOwner) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '无权限更新该申请',
            data: null
        }, { status: 403 });
    }

    // 构建更新对象
    const updateData: any = {};

    // 普通用户和管理员都能更新的字段
    if (body.name !== undefined) updateData.name = body.name;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.avatarUrl !== undefined) updateData.avatar_url = body.avatarUrl;
    if (body.specialties !== undefined) updateData.specialties = body.specialties;
    if (body.bio !== undefined) updateData.bio = body.bio;
    if (body.yearsExperience !== undefined) updateData.years_experience = body.yearsExperience;
    if (body.achievements !== undefined) updateData.achievements = body.achievements;
    if (body.teachingPhilosophy !== undefined) updateData.teaching_philosophy = body.teachingPhilosophy;
    if (body.credentials !== undefined) updateData.credentials = body.credentials;
    if (body.caseStudies !== undefined) updateData.case_studies = body.caseStudies;
    if (body.contactEmail !== undefined) updateData.contact_email = body.contactEmail;
    if (body.contactPhone !== undefined) updateData.contact_phone = body.contactPhone;
    if (body.resumeUrl !== undefined) updateData.resume_url = body.resumeUrl;
    if (body.portfolioUrl !== undefined) updateData.portfolio_url = body.portfolioUrl;
    if (body.socialLinks !== undefined) updateData.social_links = body.socialLinks;

    // 只有管理员才能更新的字段
    if (isAdmin) {
        if (body.status !== undefined) updateData.status = body.status;
        if (body.reviewNotes !== undefined) updateData.review_notes = body.reviewNotes;
        if (body.reviewedAt !== undefined) updateData.reviewed_at = body.reviewedAt;
        if (body.reviewedBy !== undefined) updateData.reviewed_by = body.reviewedBy;

        // 如果设置了审核状态且还没有设置审核人，则自动设置当前用户为审核人
        if (body.status !== undefined && !existingApplication.reviewed_by &&
            ['approved', 'rejected', 'needs_info'].includes(body.status)) {
            updateData.reviewed_by = userId;
            updateData.reviewed_at = new Date().toISOString();
        }
    }

    // 更新申请记录
    const { data, error } = await supabase
        .from('coach_applications')
        .update(updateData)
        .eq('id', body.id)
        .select()
        .single();

    if (error) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '更新教练申请失败: ' + error.message,
            data: null
        }, { status: 500 });
    }

    // 重要！必须声明接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<UpdateCoachApplicationResponseDto>>({
        success: true,
        message: '教练申请更新成功',
        // UpdateCoachApplicationResponseDto 反映的是这里的 data 数据结构
        data: {
            application: data
        }
    });
}