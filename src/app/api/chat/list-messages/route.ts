import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import type {
    GetMessagesDto,
    GetMessagesResponseDto,
    MessageItem,
} from "./entity";
import supabase from "@/lib/supabaseClient";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json() as GetMessagesDto;
    const { roomId, beforeId } = body;
    const limit = Math.min(body.limit ?? 50, 50);

    if (!roomId) {
        return NextResponse.json({
            success: false,
            message: "缺少会话ID",
            data: null,
        }, { status: 400 });
    }
    // 验证用户是否为会话参与者
    const { data: chatRoom, error: chatRoomError } = await supabase
        .from("chat_rooms")
        .select("members")
        .eq("id", roomId)
        .single();

    if (chatRoomError || !chatRoom) {
        return NextResponse.json({
            success: false,
            message: "会话不存在",
            data: null,
        }, { status: 404 });
    }

    if (!chatRoom.members.includes(userId)) {
        return NextResponse.json({
            success: false,
            message: "无权限",
            data: null,
        }, { status: 403 });
    }

    // 查询消息
    let query = supabase
        .from("chat_messages")
        .select("*", { count: "exact" })
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (beforeId) {
        // 加载更早的消息
        const { data: beforeMsg } = await supabase
            .from("chat_messages")
            .select("created_at")
            .eq("id", beforeId)
            .single();

        if (beforeMsg) {
            query = query.lt("created_at", beforeMsg.created_at);
        }
    }

    const { data: messages, error, count } = await query;

    if (error) {
        console.error("查询消息失败:", error);
        return NextResponse.json({
            success: false,
            message: "获取消息失败",
            data: null,
        }, { status: 500 });
    }

    const hasMore = messages.length === limit;

    if (!messages || messages.length === 0) {
        return NextResponse.json<ApiData<GetMessagesResponseDto>>({
            success: true,
            message: "暂无消息",
            data: {
                messages: [],
                has_more: false,
                total: count ?? 0,
            },
        });
    }

    // 获取发送者信息
    const senderIds = [...new Set(messages.map((m) => m.sender_id))];

    const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, nickname, avatar_url")
        .in("user_id", senderIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

    // 组装消息数据
    const returnChatMessages: MessageItem[] = messages.map((msg) => {
        const profile = profileMap.get(msg.sender_id);

        return {
            id: msg.id,
            chatUserId: msg.sender_id,
            chatUserProfile: {
                name: profile?.nickname || "",
                avatar: profile?.avatar_url || null,
            },
            messageType: msg.message_type,
            content: msg.content,
            mediaUrl: msg.media_url,
            fileName: msg.file_name,
            fileSize: msg.file_size,
            duration: msg.duration,
            isRead: msg.is_read,
            createdAt: msg.created_at,
            isMine: msg.sender_id === userId,
            contentMetadata: (msg as any).content_metadata || null,
        };
    }).reverse();

    return NextResponse.json<ApiData<GetMessagesResponseDto>>({
        success: true,
        message: "获取消息成功",
        data: {
            messages: returnChatMessages,
            has_more: hasMore,
            total: count ?? 0,
        },
    });
}
