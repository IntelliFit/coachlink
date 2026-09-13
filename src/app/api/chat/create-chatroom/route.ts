import { NextResponse } from 'next/server';
import { getApiUserId } from '@/lib/getApiUserId';
import supabase from '@/lib/supabaseClient';
import type { createChatroomsDto, createChatroomsResponseDto } from './entity';
import { ApiData } from '@/types/api';


export async function POST(req: Request) {
    const userId = await getApiUserId(req);
    if (!userId) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const {
        members
    } = await req.json() as createChatroomsDto;

    if (!members) {
        return NextResponse.json({
            success: false,
            message: '缺少参数',
            data: null
        }, { status: 400 });
    }

    if (!members.includes(userId)) {
        return NextResponse.json({
            success: false,
            message: '没有权限',
            data: null
        }, { status: 401 });
    }
    const { data: chatRoomData, error: chatRoomError } = await supabase
        .from('chat_rooms')
        .insert({
            members: members,
            type: 'private',
            unread_members: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

    if (chatRoomError) {
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

