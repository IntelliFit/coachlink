import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import type { SearchMessagesDto, SearchMessagesResponseDto } from "./entity";
import supabase from "@/lib/supabaseClient";
import { mapChatMessageRowsToItems } from "@/lib/mapChatMessageRows";

function escapeIlikePattern(s: string): string {
    return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

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
    const body = await req.json() as SearchMessagesDto;
    const { roomId } = body;
    const rawQ = typeof body.query === "string" ? body.query.trim() : "";
    const limit = Math.min(Math.max(body.limit ?? 30, 1), 50);

    if (!roomId) {
        return NextResponse.json({
            success: false,
            message: "缺少会话ID",
            data: null,
        }, { status: 400 });
    }

    if (rawQ.length < 1) {
        return NextResponse.json({
            success: false,
            message: "请输入搜索关键词",
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

    const pat = `%${escapeIlikePattern(rawQ)}%`;

    const [contentRes, fileRes] = await Promise.all([
        supabase
            .from("chat_messages")
            .select("*")
            .eq("room_id", roomId)
            .ilike("content", pat)
            .order("created_at", { ascending: false })
            .limit(limit),
        supabase
            .from("chat_messages")
            .select("*")
            .eq("room_id", roomId)
            .ilike("file_name", pat)
            .order("created_at", { ascending: false })
            .limit(limit),
    ]);

    if (contentRes.error || fileRes.error) {
        console.error("搜索消息失败:", contentRes.error || fileRes.error);
        return NextResponse.json({
            success: false,
            message: "搜索失败",
            data: null,
        }, { status: 500 });
    }

    const byId = new Map<string, (typeof contentRes.data)[0]>();
    for (const r of contentRes.data || []) {
        byId.set(r.id, r);
    }
    for (const r of fileRes.data || []) {
        byId.set(r.id, r);
    }

    const merged = [...byId.values()].sort(
        (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const sliced = merged.slice(0, limit);

    if (!sliced.length) {
        return NextResponse.json<ApiData<SearchMessagesResponseDto>>({
            success: true,
            message: "无匹配消息",
            data: { messages: [] },
        });
    }

    const messages = await mapChatMessageRowsToItems(
        sliced as Parameters<typeof mapChatMessageRowsToItems>[0],
        userId,
    );

    return NextResponse.json<ApiData<SearchMessagesResponseDto>>({
        success: true,
        message: "搜索成功",
        data: { messages },
    });
}
