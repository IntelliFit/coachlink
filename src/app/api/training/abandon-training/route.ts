import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { AbandonTrainingDto, AbandonTrainingResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const userId = session.user.id;

    const {
        training_record_id
    } = await req.json() as AbandonTrainingDto;

    if (!training_record_id || training_record_id === 'preview') {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '无效的训练记录ID',
            data: null
        }, { status: 400 });
    }

    try {
        // 删除训练记录
        const { error: deleteError } = await supabase
            .from('training_records')
            .delete()
            .eq('id', training_record_id)
            .eq('user_id', userId);

        if (deleteError) {
            console.error('放弃训练失败:', deleteError);
            throw deleteError;
        }

        return NextResponse.json<ApiData<AbandonTrainingResponseDto>>({
            success: true,
            message: '训练已放弃',
            data: { success: true }
        });
    } catch (error: any) {
        console.error('放弃训练失败:', error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: error.message || '放弃训练失败',
            data: null
        }, { status: 500 });
    }
}


