import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { UpdateVideoCollectionDto, UpdateVideoCollectionResponseDto } from './entity';

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
    const { id, title, description, tags, isFeatured } = await req.json() as UpdateVideoCollectionDto;

    if (!id) {
        return NextResponse.json({
            success: false,
            message: '缺少视频集ID',
            data: null
        }, { status: 400 });
    }

    try {
        const { data: existed, error: fetchError } = await supabase
            .from('student_video_collections')
            .select('id')
            .eq('id', id)
            .eq('user_id', userId)
            .is('deleted_at', null)
            .maybeSingle();

        if (fetchError) {
            throw new Error(fetchError.message);
        }

        if (!existed) {
            return NextResponse.json({
                success: false,
                message: '记录不存在或无权限',
                data: null
            }, { status: 404 });
        }

        const { data, error } = await supabase
            .from('student_video_collections')
            .update({
                title: title === undefined ? undefined : (title?.trim() || null),
                description: description?.trim(),
                tags: tags ?? undefined,
                is_featured: isFeatured ?? undefined,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            throw new Error(error?.message || '更新失败');
        }

        return NextResponse.json<ApiData<UpdateVideoCollectionResponseDto>>({
            success: true,
            message: '更新成功',
            data: { collection: data }
        });
    } catch (error: any) {
        console.error('update-video-collection error', error);
        return NextResponse.json({
            success: false,
            message: error?.message || '更新失败',
            data: null
        }, { status: 500 });
    }
}

