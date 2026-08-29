import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { getAuthUser } from '@/lib/auth';
import { MOTION_GAME_CONFIG, type MotionGameKey } from '@/lib/motionGameLeaderboard';
import { findPowerAnalysisChallengeByTemplateId } from '@/lib/powerAnalysisLeaderboard';
import supabase, { serviceRoleSupabase } from '@/lib/supabaseClient';

import type { ApiData } from '@/types/api';
import type { ListEntriesDto, ListEntriesResponseDto, LeaderboardEntryWithProfile } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id }
        : await getAuthUser(req);
    if (!authResult.isAuthenticated || !authResult.userId) {
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

    const powerAnalysisChallenge = findPowerAnalysisChallengeByTemplateId(body.template_id);
    if (powerAnalysisChallenge) {
        const [challengeKey, config] = powerAnalysisChallenge;
        const db = serviceRoleSupabase as any;
        const { data: bestScores, error: bestScoresError, count: bestScoresCount } = await db
            .from('power_analysis_best_scores')
            .select(
                'user_id, best_power_w, best_power_mode, best_power_job_id, best_power_achieved_at, best_velocity_mps, best_velocity_mode, best_velocity_job_id, best_velocity_achieved_at',
                { count: 'exact' },
            )
            .not(config.scoreColumn, 'is', null)
            .order(config.scoreColumn, { ascending: false })
            .order(config.achievedAtColumn, { ascending: true })
            .order('user_id', { ascending: true })
            .range(offset, offset + limit - 1);

        if (bestScoresError) {
            console.error('获取功率挑战排行榜失败:', bestScoresError);
            return NextResponse.json<ApiData<ListEntriesResponseDto>>({
                success: false,
                message: bestScoresError.message,
                data: null,
            }, { status: 500 });
        }

        const userIds = Array.from(new Set((bestScores || []).map((item: any) => item.user_id)));
        const profilesMap = new Map<string, { name: string; avatar: string }>();
        if (userIds.length > 0) {
            const { data: profiles } = await db
                .from('user_profiles')
                .select('user_id, nickname, avatar_url, full_name')
                .in('user_id', userIds);
            for (const profile of profiles || []) {
                profilesMap.set(profile.user_id, {
                    name: profile.nickname || profile.full_name || '匿名用户',
                    avatar: profile.avatar_url || '',
                });
            }
        }

        const modeLabels: Record<string, string> = {
            pullup: '引体向上',
            muscleup: '双力臂',
            dip: '双杠臂屈伸',
            pushup: '俯卧撑',
            squat: '深蹲起身',
        };
        const powerEntries = (bestScores || []).map((item: any) => {
            const score = Number(Number(item[config.scoreColumn] || 0).toFixed(config.digits));
            const otherValue = challengeKey === 'power'
                ? Number(Number(item.best_velocity_mps || 0).toFixed(2))
                : Number(Number(item.best_power_w || 0).toFixed(0));
            const otherFieldName = challengeKey === 'power' ? '最快速度（m/s）' : '最高功率（W）';
            const mode = String(item[config.modeColumn] || '');
            const jobId = item[config.jobIdColumn] || null;

            return {
                id: jobId || `${challengeKey}-${item.user_id}`,
                template_id: config.templateId,
                user_id: item.user_id,
                score,
                status: 'approved',
                form_data: [
                    { type: 'number', name: config.rankByField, required: true, userInput: score },
                    { type: 'number', name: otherFieldName, required: true, userInput: otherValue },
                    { type: 'text', name: '动作', required: true, userInput: modeLabels[mode] || mode || '未知' },
                ],
                evidence_url: null,
                extra_data: {
                    challenge_key: challengeKey,
                    source_job_id: jobId,
                    verified: true,
                    scope: 'coachlink_nationwide_participants',
                },
                created_at: item[config.achievedAtColumn],
                userProfile: profilesMap.get(item.user_id) || { name: '匿名用户', avatar: '' },
            };
        });

        return NextResponse.json<ApiData<ListEntriesResponseDto>>({
            success: true,
            message: '获取功率挑战排行榜成功',
            data: {
                entries: powerEntries,
                total: bestScoresCount || 0,
                page,
                limit,
            },
        });
    }

    const motionGameEntry = Object.entries(MOTION_GAME_CONFIG).find(
        ([, config]) => config.templateId === body.template_id,
    ) as [MotionGameKey, (typeof MOTION_GAME_CONFIG)[MotionGameKey]] | undefined;

    if (motionGameEntry) {
        const [gameKey, config] = motionGameEntry;
        const actionLabel = gameKey === 'pullup-rush' ? '引体次数' : '俯卧撑次数';
        const db = serviceRoleSupabase as any;
        const { data: bestScores, error: bestScoresError, count: bestScoresCount } = await db
            .from('motion_game_best_scores')
            .select('user_id, score, elapsed_ms, action_count, lock_ratio, run_id, achieved_at', { count: 'exact' })
            .eq('game_key', gameKey)
            .order('score', { ascending: false })
            .order('elapsed_ms', { ascending: false })
            .order('action_count', { ascending: false })
            .order('achieved_at', { ascending: true })
            .order('user_id', { ascending: true })
            .range(offset, offset + limit - 1);

        if (bestScoresError) {
            console.error('获取体感游戏排行榜失败:', bestScoresError);
            return NextResponse.json<ApiData<ListEntriesResponseDto>>({
                success: false,
                message: bestScoresError.message,
                data: null,
            }, { status: 500 });
        }

        const motionUserIds = Array.from(new Set((bestScores || []).map((item: any) => item.user_id)));
        const motionProfiles = new Map<string, { name: string; avatar: string }>();
        if (motionUserIds.length > 0) {
            const { data: profiles } = await db
                .from('user_profiles')
                .select('user_id, nickname, avatar_url, full_name')
                .in('user_id', motionUserIds);
            for (const profile of profiles || []) {
                motionProfiles.set(profile.user_id, {
                    name: profile.nickname || profile.full_name || '匿名用户',
                    avatar: profile.avatar_url || '',
                });
            }
        }

        const motionEntries = (bestScores || []).map((item: any) => ({
            id: item.run_id,
            template_id: config.templateId,
            user_id: item.user_id,
            score: item.score,
            status: 'approved',
            form_data: [
                { type: 'number', name: '穿越通道', required: true, userInput: item.score },
                { type: 'number', name: '坚持秒数', required: true, userInput: Math.floor(item.elapsed_ms / 1000) },
                { type: 'number', name: actionLabel, required: true, userInput: item.action_count },
            ],
            evidence_url: null,
            extra_data: {
                game_key: gameKey,
                elapsed_ms: item.elapsed_ms,
                action_count: item.action_count,
                lock_ratio: item.lock_ratio,
                verified: true,
            },
            created_at: item.achieved_at,
            userProfile: motionProfiles.get(item.user_id) || { name: '匿名用户', avatar: '' },
        }));

        return NextResponse.json<ApiData<ListEntriesResponseDto>>({
            success: true,
            message: '获取体感游戏排行榜成功',
            data: {
                entries: motionEntries,
                total: bestScoresCount || 0,
                page,
                limit,
            },
        });
    }

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
