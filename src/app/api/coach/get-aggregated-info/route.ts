import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { GetAggregatedInfoDto, GetAggregatedInfoResponseDto } from './entity';
import redis from '@/lib/redisClient';


async function getUniqueTags(userId: string) {
    const { data, error } = await supabase
        .from('coach_plan_templates')
        .select('tags')
        .eq('coach_id', userId);

    if (error) {
        return [];
    }

    // 提取并去重所有标签
    const allTags = data.flatMap(template => template.tags || []);
    const uniqueTags = Array.from(new Set(allTags));

    return uniqueTags;
}

async function getContentCount(coachId: string) {
    const { count, error } = await supabase
        .from('coach_contents')
        .select('*', { count: 'exact', head: true })
        .eq('coach_id', coachId);

    if (error) {
        console.error(error);
        return 0;
    }

    return count || 0;
}

async function getStudentCount(coachId: string) {
    const { count, error } = await supabase
        .from('coach_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('coach_id', coachId)
        .eq('status', 'active');

    if (error) {
        console.error(error);
        return 0;
    }

    return count || 0;
}

async function getReviewCount(coachId: string) {
    const cacheKey = `coach:reviews:${coachId}`;
    
    // 尝试从缓存中获取数据
    try {
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            return JSON.parse(cachedData as string);
        }
    } catch (err) {
        console.error('Redis get error:', err);
    }

    // 获取评论数量和平均评分
    const { data: reviewsData, error: reviewsError } = await supabase
        .from('student_comments')
        .select('rating')
        .eq('coach_id', coachId);

    let reviewCount = 0;
    let averageRating = 0;

    if (!reviewsError && reviewsData) {
        reviewCount = reviewsData.length;
        if (reviewCount > 0) {
            const totalRating = reviewsData.reduce((sum, review) => sum + review.rating, 0);
            averageRating = parseFloat((totalRating / reviewCount).toFixed(1));
        }
    }

    // 将结果存入缓存，设置5分钟过期时间
    const result = { reviewCount, averageRating };
    try {
        await redis.setEx(cacheKey, 300, JSON.stringify(result));
    } catch (err) {
        console.error('Redis set error:', err);
    }

    return result;
}

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const {
        coachId
    } = await req.json() as GetAggregatedInfoDto;

    // 获取教练基本信息
    const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('*')
        .eq('id', coachId)
        .single();

    if (coachError || !coach) {
        return NextResponse.json<ApiData<GetAggregatedInfoResponseDto>>({
            success: false,
            message: '教练信息不存在',
            data: null
        });
    }

    const [
        studentCount,
        contentCount,
        specialties,
        { reviewCount, averageRating }
    ] = await Promise.all([
        getStudentCount(coach.id),
        getContentCount(coach.id),
        getUniqueTags(coach.user_id),
        getReviewCount(coach.id),
    ]);

    return NextResponse.json<ApiData<GetAggregatedInfoResponseDto>>({
        success: true,
        message: '获取成功',
        data: {
            coach,
            contentCount,
            studentCount,
            reviewCount,
            averageRating,
            specialties
        }
    });
}