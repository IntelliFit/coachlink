import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

import type { ApiData } from '@/types/api';
import type { CreateEntryDto, CreateEntryResponseDto } from './entity';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<CreateEntryResponseDto>>({
            success: false, message: '用户未登录', data: null
        }, { status: 401 });
    }

    const body: CreateEntryDto = await req.json();
    if (!body.template_id) {
        return NextResponse.json({ success: false, message: '缺少 template_id', data: null });
    }

    const userId = session.user.id;

    // 1. 先查找该用户在此模板下是否存在 pending 状态的记录
    const { data: existingEntry } = await supabase
        .from('leaderboard_entries')
        .select('id')
        .eq('user_id', userId)
        .eq('template_id', body.template_id)
        .eq('status', 'pending')
        .maybeSingle();

    let result;

    if (existingEntry) {
        // 2. 如果存在，执行更新 (Update)
        result = await supabase
            .from('leaderboard_entries')
            .update({
                form_data: body.form_data,
                score: body.score,
                evidence_url: body.evidence_url,
                updated_at: new Date().toISOString(), // 建议记录更新时间
            })
            .eq('id', existingEntry.id)
            .select()
            .single();
    } else {
        // 3. 如果不存在，执行插入 (Insert)
        result = await supabase
            .from('leaderboard_entries')
            .insert({
                id: randomUUID(),
                template_id: body.template_id,
                form_data: body.form_data,
                score: body.score,
                evidence_url: body.evidence_url,
                status: 'pending',
                user_id: userId,
            })
            .select()
            .single();
    }

    const { data, error } = result;

    if (error) {
        console.error('操作排行榜条目失败:', error);
        return NextResponse.json<ApiData<CreateEntryResponseDto>>({
            success: false, message: error.message, data: null
        });
    }

    return NextResponse.json<ApiData<CreateEntryResponseDto>>({
        success: true,
        message: existingEntry ? '待审核条目已更新' : '排行榜条目创建成功',
        data: { entry: data }
    });
}