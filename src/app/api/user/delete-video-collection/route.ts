import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { DeleteVideoCollectionDto, DeleteVideoCollectionResponseDto } from './entity';

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
    const { id } = await req.json() as DeleteVideoCollectionDto;

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

        const { error } = await supabase
            .from('student_video_collections')
            .update({
                deleted_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) {
            throw new Error(error.message);
        }

        return NextResponse.json<ApiData<DeleteVideoCollectionResponseDto>>({
            success: true,
            message: '删除成功',
            data: { deleted: true }
        });
    } catch (error: any) {
        console.error('delete-video-collection error', error);
        return NextResponse.json({
            success: false,
            message: error?.message || '删除失败',
            data: null
        }, { status: 500 });
    }
}

