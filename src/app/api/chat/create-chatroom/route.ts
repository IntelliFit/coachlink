import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { getAuthUser } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';
import { normalizePrivateChatMembers } from '@/lib/chatMembers';
import type { createChatroomsDto, createChatroomsResponseDto } from './entity';
import { ApiData } from '@/types/api';


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

    const userId = authResult.userId;
    const {
        members
    } = await req.json() as createChatroomsDto;

    const normalized = await normalizePrivateChatMembers(supabase, members, userId);
    if (normalized.ok === false) {
        return NextResponse.json({
            success: false,
            message: normalized.message,
            data: null,
        }, { status: normalized.status });
    }

    const normalizedMembers = normalized.members;
    const { data: existingRoom, error: existingRoomError } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('is_archived', false)
        .contains('members', normalizedMembers)
        .containedBy('members', normalizedMembers)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (existingRoomError) {
        console.error('[create-chatroom] find existing room failed:', existingRoomError);
        return NextResponse.json({
            success: false,
            message: '查找会话失败',
            data: null,
        }, { status: 500 });
    }
    if (existingRoom) {
        return NextResponse.json<ApiData<createChatroomsResponseDto>>({
            success: true,
            message: '会话已存在',
            data: { roomId: existingRoom.id },
        });
    }

    const { data: chatRoomData, error: chatRoomError } = await supabase
        .from('chat_rooms')
        .insert({
            members: normalizedMembers,
            type: 'private',
            unread_members: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

    if (chatRoomError) {
        if (chatRoomError.code === '23505') {
            const { data: concurrentRoom } = await supabase
                .from('chat_rooms')
                .select('id')
                .eq('is_archived', false)
                .contains('members', normalizedMembers)
                .containedBy('members', normalizedMembers)
                .limit(1)
                .maybeSingle();
            if (concurrentRoom) {
                return NextResponse.json<ApiData<createChatroomsResponseDto>>({
                    success: true,
                    message: '会话已存在',
                    data: { roomId: concurrentRoom.id },
                });
            }
        }
        console.error('[create-chatroom] create failed:', chatRoomError);
        return NextResponse.json<ApiData<createChatroomsResponseDto>>({
            success: false,
            message: '创建会话失败',
        });
    }

    return NextResponse.json<ApiData<createChatroomsResponseDto>>({
        success: true,
        message: '创建会话成功',
        data: {
            roomId: chatRoomData.id,
        }
    });
}

