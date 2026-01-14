import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { ContentInteractionDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: '未登录' }, { status: 401 });
    }

    const { contentId, interactionType } = await req.json() as ContentInteractionDto;
    const userId = session.user.id;

    try {
        // 如果是点赞，调用 RPC 函数，一次请求完成所有逻辑
        if (interactionType === 'like') {
            const { data, error } = await supabase.rpc('toggle_content_like', {
                p_content_id: contentId,
                p_user_id: userId
            });

            if (error) throw error;

            return NextResponse.json({
                success: true,
                message: (data as any).action === 'added' ? '点赞成功' : '已取消点赞',
                data: data
            });
        }

    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
    }
}