import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import type {
    GetMessagesDto,
    GetMessagesResponseDto,
} from "./entity";
import supabase from "@/lib/supabaseClient";
import { mapChatMessageRowsToItems } from "@/lib/mapChatMessageRows";

const ANCHOR_WINDOW = 25;

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
    const { roomId, beforeId, anchorMessageId } = body;
    const limit = Math.min(body.limit ?? 50, 50);

    if (!roomId) {
        return NextResponse.json({
            success: false,
            message: "缺少会话ID",
            data: null,
        }, { status: 400 });
    }

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

    const { count: totalCount } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("room_id", roomId);

    if (anchorMessageId) {
        const { data: anchor, error: anchorErr } = await supabase
            .from("chat_messages")
            .select("*")
            .eq("id", anchorMessageId)
            .eq("room_id", roomId)
            .single();

        if (anchorErr || !anchor) {
            return NextResponse.json({
                success: false,
                message: "消息不存在",
                data: null,
            }, { status: 404 });
        }

        const t = anchor.created_at as string;

        const { data: older } = await supabase
            .from("chat_messages")
            .select("*")
            .eq("room_id", roomId)
            .lt("created_at", t)
            .order("created_at", { ascending: false })
            .limit(ANCHOR_WINDOW);

        const { data: newer } = await supabase
            .from("chat_messages")
            .select("*")
            .eq("room_id", roomId)
            .gt("created_at", t)
            .order("created_at", { ascending: true })
            .limit(ANCHOR_WINDOW);

        const olderAsc = [...(older || [])].reverse();
        const merged = [ ...olderAsc, anchor, ...(newer || []) ];
        const seen = new Set<string>();
        const mergedUnique = merged.filter((m) => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
        });

        const hasMore =
            (older?.length ?? 0) === ANCHOR_WINDOW ||
            (newer?.length ?? 0) === ANCHOR_WINDOW;

        const returnChatMessages = await mapChatMessageRowsToItems(
            mergedUnique as Parameters<typeof mapChatMessageRowsToItems>[0],
            userId,
        );

        return NextResponse.json<ApiData<GetMessagesResponseDto>>({
            success: true,
            message: "获取消息成功",
            data: {
                messages: returnChatMessages,
                has_more: hasMore,
                total: totalCount ?? 0,
            },
        });
    }

    let query = supabase
        .from("chat_messages")
        .select("*", { count: "exact" })
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (beforeId) {
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
                total: count ?? totalCount ?? 0,
            },
        });
    }

    const returnChatMessages = await mapChatMessageRowsToItems(
        [...messages].reverse() as Parameters<typeof mapChatMessageRowsToItems>[0],
        userId,
    );

    return NextResponse.json<ApiData<GetMessagesResponseDto>>({
        success: true,
        message: "获取消息成功",
        data: {
            messages: returnChatMessages,
            has_more: hasMore,
            total: count ?? totalCount ?? 0,
        },
    });
}
