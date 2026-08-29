import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { getAuthUser } from '@/lib/auth';
import { findPowerAnalysisChallengeByType } from '@/lib/powerAnalysisLeaderboard';
import supabase, { serviceRoleSupabase } from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { ListLeaderboardDto, ListLeaderboardResponseDto } from './entity';

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

    const {
        page = 1,
        limit = 10,
        countStatus = 'pending'
    } = await req.json() as ListLeaderboardDto;

    // 计算偏移量
    const offset = (page - 1) * limit;

    // 查询排行榜列表和总数
    const { data, error, count } = await supabase
        .from('leaderboard_templates')
        .select('id, title, description, start_at, end_at, rank_by_field, sort_order, type, remarks, created_at, creator_id', { count: 'exact' })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error('获取排行榜列表失败:', error);
        return NextResponse.json({
            success: false,
            message: error.message || '获取排行榜列表失败',
            data: null
        }, { status: 500 });
    }

    // 为每个排行榜获取未审核条目的数量
    const leaderboardsWithCount = await Promise.all(
        (data || []).map(async (item) => {
            const powerAnalysisChallenge = findPowerAnalysisChallengeByType(item.type);
            if (powerAnalysisChallenge) {
                const [, config] = powerAnalysisChallenge;
                const db = serviceRoleSupabase as any;
                const { count: participantCount, error: participantError } = await db
                    .from('power_analysis_best_scores')
                    .select('user_id', { count: 'exact', head: true })
                    .not(config.scoreColumn, 'is', null);

                if (participantError) {
                    console.error(`获取功率排行榜 ${item.id} 的参与人数失败:`, participantError);
                }

                return {
                    id: item.id,
                    title: item.title,
                    description: item.description,
                    start_at: item.start_at,
                    end_at: item.end_at,
                    rank_by_field: item.rank_by_field,
                    sort_order: item.sort_order,
                    type: item.type,
                    remarks: item.remarks,
                    created_at: item.created_at,
                    creator_id: item.creator_id,
                    statusCount: participantCount || 0,
                };
            }

            // 查询此排行榜模板的未审核条目数量
            const { count, error: unreviewedError } = await supabase
                .from('leaderboard_entries')
                .select('*', { count: 'exact', head: true })
                .eq('template_id', item.id)
                .eq('status', countStatus);

            if (unreviewedError) {
                console.error(`获取排行榜 ${item.id} 的未审核条目数量失败:`, unreviewedError);
            }

            return {
                id: item.id,
                title: item.title,
                description: item.description,
                start_at: item.start_at,
                end_at: item.end_at,
                rank_by_field: item.rank_by_field,
                sort_order: item.sort_order,
                type: item.type,
                remarks: item.remarks,
                created_at: item.created_at,
                creator_id: item.creator_id,
                statusCount: count || 0
            };
        })
    );

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<ListLeaderboardResponseDto>>({
        success: true,
        message: '获取排行榜列表成功',
        // ListLeaderboardResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            leaderboards: leaderboardsWithCount,
            total: count || 0,
            page,
            limit
        }
    });
}
