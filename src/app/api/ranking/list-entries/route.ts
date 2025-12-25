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
    const userIds = Array.from(new Set(data?.map(entry => entry.user_id).filter(id => id) as string[]));
    let userProfilesMap: { [userId: string]: { name: string; avatar: string } } = {};
    
    if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
            .from('user_profiles')
            .select('id, nickname, avatar_url, full_name')
            .in('user_id', userIds);
        
        if (profileError) {
            console.error('获取用户资料失败:', profileError);
        } else if (profiles) {
            // 构建用户信息映射
            for (let i = 0; i < profiles.length; i ++) {
                const profile = profiles[i];
                const userId = userIds[i];
                userProfilesMap[userId] = {
                    name: profile.nickname || profile.full_name || '',
                    avatar: profile.avatar_url || ''
                };
            }
        }
    }

    // 将用户信息注入到每个条目中
    const entriesWithProfile: LeaderboardEntryWithProfile[] = (data || []).map(entry => ({
        ...entry,
        userProfile: userProfilesMap[entry.user_id] || {
            name: '',
            avatar: ''
        }
    }));

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