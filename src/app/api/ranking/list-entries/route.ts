import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

import type { ApiData } from '@/types/api';
import type { ListEntriesDto, ListEntriesResponseDto, LeaderboardEntryWithProfile } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<ListEntriesResponseDto>>({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const body: ListEntriesDto = await req.json();

    // 设置默认分页参数
    const page = body.page || 1;
    const limit = body.limit || 10;
    const offset = (page - 1) * limit;

    // 构建查询
    let query = supabase
        .from('leaderboard_entries')
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1);

    if (body.sort_by === 'score') {
        query = query.order('score', { ascending: false });
    }

    if (body.sort_by === 'created_at') {
        query = query.order('created_at', { ascending: false });
    }

    // 根据参数添加过滤条件
    if (body.template_id) {
        query = query.eq('template_id', body.template_id);
    }

    if (body.user_id) {
        query = query.eq('user_id', body.user_id);
    }

    // 如果提供了status参数，则按status过滤，否则不进行状态过滤
    if (body.status) {
        query = query.eq('status', body.status);
    }

    const { data, error, count } = await query;

    if (error) {
        console.error('获取排行榜条目列表失败:', error);
        return NextResponse.json<ApiData<ListEntriesResponseDto>>({
            success: false,
            message: error.message,
            data: null
        });
    }

    // 获取所有涉及的用户信息
    const userIds = Array.from(new Set(data?.map(entry => entry.user_id).filter(Boolean)));
    let userProfilesMap: Record<string, { name: string; avatar: string }> = {};

    if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
            .from('user_profiles')
            .select('user_id, nickname, avatar_url, full_name') // 确保包含了 user_id 字段
            .in('user_id', userIds);

        if (profiles) {
            profiles.forEach(p => {
                // 使用 user_id 作为唯一的 Key
                userProfilesMap[p.user_id] = {
                    name: p.nickname || p.full_name || '匿名用户',
                    avatar: p.avatar_url || ''
                };
            });
        }
    }

    // 将用户信息注入
    const entriesWithProfile: LeaderboardEntryWithProfile[] = (data || []).map(entry => {
        // 1. 尝试从映射表获取 profile
        const profile = userProfilesMap[entry.user_id];

        // 2. 解析 extra_data 里的抖音昵称 (安全处理 JSONB)
        const extraData = entry.extra_data as any;
        const douyinNickname = extraData?.douyin_nickname;
        const douyinAvatar = extraData?.douyin_avatar; // 如果 extra_data 里也有头像的话

        // 3. 确定最终显示的名字
        // 优先级：Profile 昵称 > Profile 全名 > 抖音昵称 > 未知用户
        const finalName = profile?.name || douyinNickname || '未知用户';
        const finalAvatar = profile?.avatar || douyinAvatar || '';

        return {
            ...entry,
            userProfile: {
                name: finalName,
                avatar: finalAvatar
            }
        };
    });

    return NextResponse.json<ApiData<ListEntriesResponseDto>>({
        success: true,
        message: '获取排行榜条目列表成功',
        data: {
            entries: entriesWithProfile,
            total: count || 0,
            page,
            limit,
        },
    });
}