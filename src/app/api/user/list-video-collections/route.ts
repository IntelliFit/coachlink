import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { ListVideoCollectionsDto, ListVideoCollectionsResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const userId = session.user.id;
    const { filters, pagination } = await req.json() as ListVideoCollectionsDto;

    try {
        let query = supabase
            .from('student_video_collections')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .is('deleted_at', null);

        if (filters) {
            if (filters.source) {
                query = query.eq('source', filters.source);
            }
            if (filters.isFeatured !== undefined) {
                query = query.eq('is_featured', filters.isFeatured);
            }
            if (filters.search) {
                const keyword = `%${filters.search}%`;
                query = query.or([
                    `description.ilike.${keyword}`,
                    `title.ilike.${keyword}`
                ].join(','));
            }
            if (filters.tags && filters.tags.length > 0) {
                query = query.contains('tags', filters.tags);
            }
        }

        if (pagination) {
            const from = (pagination.page - 1) * pagination.limit;
            const to = from + pagination.limit - 1;
            query = query.range(from, to);
        }

        const { data, count, error } = await query.order('is_featured', { ascending: false }).order('created_at', { ascending: false });

        if (error) {
            throw new Error(`获取视频集失败: ${error.message}`);
        }

        return NextResponse.json<ApiData<ListVideoCollectionsResponseDto>>({
            success: true,
            message: '获取视频集成功',
            data: {
                collections: data || [],
                total: count || 0
            }
        });
    } catch (error: any) {
        console.error('list-video-collections error', error);
        return NextResponse.json({
            success: false,
            message: error?.message || '获取视频集失败',
            data: null
        }, { status: 500 });
    }
}

