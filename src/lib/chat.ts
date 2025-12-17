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
            unread_members: [userId]
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