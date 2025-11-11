import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import type { CoachMessagesDto, CoachMessagesResponseDto } from './entity';

export async function POST(req: Request) {
    try {
        // 🔐 1. 获取用户会话
        const session = await getServerSession();
        const userId = session?.user?.id; // 假设 session.user 中包含 id
        if (!userId) {
            return NextResponse.json({
                success: false,
                message: 'Unauthorized',
                data: null,
            });
        }

        // 📥 2. 解析请求体
        const { limit = 30 } = (await req.json()) as CoachMessagesDto;

        // 📨 3. 查询消息表
        const { data, count, error } = await supabase
            .from('coach_messages')
            .select('id, created_at', { count: 'exact' })
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('获取消息失败:', error);
            return NextResponse.json({
                success: false,
                message: '获取消息失败',
                data: null,
            });
        }

        // ✅ 4. 组织返回数据
        const result: CoachMessagesResponseDto = {
            messages: data || [],
            total: count || 0,
            limit,
        };

        return NextResponse.json({
            success: true,
            message: '获取消息成功',
            data: result,
        });
    } catch (error: any) {
        console.error('❌ 获取消息错误:', error);
        return NextResponse.json({
            success: false,
            message: error?.message || '服务器错误，请稍后重试',
            data: null,
        });
    }
}
