import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabaseAdmin from '@/lib/supabaseAdmin';
import type { ApiData } from '@/types/api';
import type { GetConversationsDto, GetConversationsResponseDto, ConversationItem } from './entity';

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
    const { page = 1, limit = 20 } = await req.json() as GetConversationsDto;
    const offset = (page - 1) * limit;

    try {
        // 判断用户是教练还是学员
        const { data: coachData } = await supabaseAdmin
            .from('coaches')
            .select('id')
            .eq('user_id', userId)
            .single();

        const isCoach = !!coachData;
        const coachId = coachData?.id;

        // 查询会话
        let query = supabaseAdmin
            .from('conversations' as any)
            .select('*', { count: 'exact' })
            .eq('is_archived', false)
            .order('updated_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (isCoach) {
            query = query.eq('coach_id', coachId);
        } else {
            query = query.eq('student_id', userId);
        }

        const { data: conversations, error, count } = await query as any;

        if (error) {
            console.error('查询会话失败:', error);
            return NextResponse.json({
                success: false,
                message: '获取会话列表失败',
                data: null
            }, { status: 500 });
        }

        if (!conversations || (conversations as any[]).length === 0) {
            return NextResponse.json<ApiData<GetConversationsResponseDto>>({
                success: true,
                message: '暂无会话',
                data: {
                    conversations: [],
                    total: 0
                }
            });
        }

        // 获取教练信息
        const conversationsArray = conversations as any[];
        const coachIds = [...new Set(conversationsArray.map((c: any) => c.coach_id))];
        const { data: coaches } = await supabaseAdmin
            .from('coaches')
            .select('id, name, avatar_url')
            .in('id', coachIds);

        const coachMap = new Map(coaches?.map(c => [c.id, c]) || []);

        // 获取学员信息
        const studentIds = [...new Set(conversationsArray.map((c: any) => c.student_id))];
        const { data: profiles } = await supabaseAdmin
            .from('user_profiles')
            .select('user_id, nickname, avatar_url')
            .in('user_id', studentIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        // 组装数据
        const enrichedConversations: ConversationItem[] = conversationsArray.map((conv: any) => {
            const coach = coachMap.get(conv.coach_id);
            const studentProfile = profileMap.get(conv.student_id);

            return {
                id: String(conv.id),
                coach_id: String(conv.coach_id),
                student_id: String(conv.student_id),
                coach_name: coach?.name || '教练',
                student_name: studentProfile?.nickname || '学员',
                coach_avatar: coach?.avatar_url || null,
                student_avatar: studentProfile?.avatar_url || null,
                last_message: conv.last_message || null,
                last_message_at: conv.last_message_at || null,
                unread_count: isCoach ? (conv.coach_unread || 0) : (conv.student_unread || 0),
                is_archived: conv.is_archived || false
            };
        });

        return NextResponse.json<ApiData<GetConversationsResponseDto>>({
            success: true,
            message: '获取会话列表成功',
            data: {
                conversations: enrichedConversations,
                total: count || 0
            }
        });
    } catch (error: any) {
        console.error('获取会话列表错误:', error);
        return NextResponse.json({
            success: false,
            message: error?.message || '服务器错误',
            data: null
        }, { status: 500 });
    }
}

