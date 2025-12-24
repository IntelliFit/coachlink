import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { SubmitRecordDto, SubmitRecordResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    // 重点！通过 session 获取用户 ID
    const userId = session.user.id;

    const {
        leaderboardType,
        weightKg,
        videoUrl,
        douyinNickname,
        gender,
        notes
    } = await req.json() as SubmitRecordDto;

    // 验证必填字段
    if (!weightKg || weightKg <= 0) {
        return NextResponse.json({
            success: false,
            message: '请输入有效的重量',
            data: null
        }, { status: 400 });
    }

    if (!videoUrl) {
        return NextResponse.json({
            success: false,
            message: '请上传视频',
            data: null
        }, { status: 400 });
    }

    // 目前只支持引体向上排行榜（pullup_leaderboard表）
    // 未来可以扩展其他类型的排行榜表
    if (leaderboardType !== 'pullup') {
        return NextResponse.json({
            success: false,
            message: '暂不支持该类型的排行榜',
            data: null
        }, { status: 400 });
    }

    // 插入排行榜记录
    const { data: record, error } = await supabase
        .from('pullup_leaderboard')
        .insert({
            user_id: userId,
            weight_kg: weightKg,
            video_url: videoUrl,
            douyin_nickname: douyinNickname || null,
            gender: gender || null,
            notes: notes || null,
            submission_status: 'pending',
            submitted_by: userId,
            submitted_at: new Date().toISOString(),
            is_user_submission: true
        })
        .select('id, submitted_at')
        .single();

    if (error) {
        console.error('提交排行榜记录失败:', error);
        return NextResponse.json({
            success: false,
            message: `提交失败: ${error.message}`,
            data: null
        }, { status: 500 });
    }

    if (!record) {
        return NextResponse.json({
            success: false,
            message: '提交失败，未返回记录',
            data: null
        }, { status: 500 });
    }

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<SubmitRecordResponseDto>>({
        success: true,
        message: '提交成功，等待审核',
        // SubmitRecordResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            recordId: record.id,
            submittedAt: record.submitted_at || new Date().toISOString()
        }
    });
}