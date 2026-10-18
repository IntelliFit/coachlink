import { NextResponse } from "next/server";
import supabase from "./supabaseClient";
import { CoachLinkTable } from "@/types";

export async function getAdmin() {
    const { data: admin, error } = await supabase.from('admin_users').select('*').limit(1).single();
    if (error) {
        console.error(error);
        return null;
    }

    return admin;
}

export async function getSystemChatroom(adminId: string, userId: string) {
    const members = [adminId, userId];
    // 只取未归档、成员恰好是这两人的会话；用户可能还留着一个已归档的旧会话，
    // 不加过滤时 maybeSingle 会因多行报错，导致系统消息发不出去。
    const { data: chatroom, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('is_archived', false)
        .contains('members', members)
        .containedBy('members', members)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
    
    if (error) {
        console.error(error);
        return null;
    }

    if (!chatroom) {
        const { data: newChatroom, error: createError } = await supabase
            .from('chat_rooms')
            .insert({
                members: members,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_archived: false
            })
            .select('*')
            .single();
        
        if (createError) {
            console.error(createError);
            return null;
        }

        return newChatroom;
    }

    return chatroom;
}

export async function sendSystemMessage(
    userId: string,
    message: Omit<CoachLinkTable['chat_messages']['Insert'], 'sender_id' | 'message_type' | 'created_at' | 'room_id'>
) {
    const admin = await getAdmin();    

    if (!admin) {
        return false;
    }

    // 当前系统和当前用户的聊天室 id
    const systemChatroom = await getSystemChatroom(admin.user_id, userId);

    if (!systemChatroom) {
        return false;
    }

    const createdAt = new Date().toISOString();

    const { data: messageInsert, error: messageInsertError } = await supabase
        .from('chat_messages')
        .insert({
            ...message,
            room_id: systemChatroom.id,
            sender_id: admin.user_id,
            message_type: 'text',
            created_at: createdAt,
        })
        .single();
    
    if (messageInsertError) {
        console.error(messageInsertError);
    }

    // 更新 chatRoom
    const { data: chatRoomUpdate, error: chatRoomUpdateError } = await supabase
        .from('chat_rooms')
        .update({
            last_message: message.content,
            last_message_at: createdAt,
            unread_members: [userId],
            updated_at: createdAt,
        })
        .eq('id', systemChatroom.id)
        .single();

    if (chatRoomUpdateError) {
        console.error(chatRoomUpdateError);
    }

    if (messageInsertError) {
        console.error('插入系统消息失败:', messageInsertError);
        return false;
    }

    return true;
}

export async function getOrCreatePrivateChatroom(members: string[]) {
    const { data: existing, error: findError } = await supabase
        .from("chat_rooms")
        .select("id")
        .eq("type", "private")
        .contains("members", members)
        .maybeSingle();

    if (findError) {
        console.error(findError);
        return null;
    }

    if (existing?.id) return existing.id as string;

    const now = new Date().toISOString();
    const { data: created, error: createError } = await supabase
        .from("chat_rooms")
        .insert({
            members,
            type: "private",
            unread_members: [],
            is_archived: false,
            created_at: now,
            updated_at: now,
        })
        .select("id")
        .single();

    if (createError) {
        console.error(createError);
        return null;
    }

    return (created?.id as string) || null;
}

export async function sendDirectMessage(opts: {
    fromUserId: string;
    toUserId: string;
    content: string;
    contentMetadata?: Record<string, unknown>;
}) {
    const { fromUserId, toUserId, content, contentMetadata } = opts;
    if (!fromUserId || !toUserId || !content) return false;

    const roomId = await getOrCreatePrivateChatroom([fromUserId, toUserId]);
    if (!roomId) return false;

    const createdAt = new Date().toISOString();

    const { error: insertErr } = await supabase
        .from("chat_messages")
        .insert({
            room_id: roomId,
            sender_id: fromUserId,
            message_type: "text",
            content,
            created_at: createdAt,
            content_metadata: contentMetadata || null,
        } as any);

    if (insertErr) {
        console.error(insertErr);
        return false;
    }

    const { error: updateRoomErr } = await supabase
        .from("chat_rooms")
        .update({
            last_message: content,
            last_message_at: createdAt,
            unread_members: [toUserId],
            updated_at: createdAt,
        })
        .eq("id", roomId);

    if (updateRoomErr) {
        console.error(updateRoomErr);
        // message inserted already; still return true
    }

    return true;
}
