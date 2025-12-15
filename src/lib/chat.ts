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
    const { data: chatroom, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .contains('members', members)
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
    message: CoachLinkTable['chat_messages']['Insert']
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

    message.room_id = systemChatroom.id;
    message.sender_id = admin.user_id;
    message.message_type = 'system';
    message.created_at = new Date().toISOString();

    const { data: messageInsert, error: messageInsertError } = await supabase
        .from('chat_messages')
        .insert(message)
        .single();

    if (messageInsertError) {
        console.error('插入系统消息失败:', messageInsertError);
        return false;
    }

    return true;
}