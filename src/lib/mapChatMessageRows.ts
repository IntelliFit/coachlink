import supabase from "@/lib/supabaseClient";
import type { MessageItem } from "@/app/api/chat/list-messages/entity";

type ChatMessageRow = {
    id: string;
    sender_id: string;
    message_type: string;
    content: string | null;
    media_url: string | null;
    file_name: string | null;
    file_size: number | null;
    duration: number | null;
    is_read: boolean;
    created_at: string;
    content_metadata?: unknown;
};

export async function mapChatMessageRowsToItems(
    rows: ChatMessageRow[],
    userId: string,
): Promise<MessageItem[]> {
    if (!rows.length) return [];

    const senderIds = [...new Set(rows.map((m) => m.sender_id))];
    const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, nickname, avatar_url")
        .in("user_id", senderIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

    return rows.map((msg) => {
        const profile = profileMap.get(msg.sender_id);
        return {
            id: msg.id,
            chatUserId: msg.sender_id,
            chatUserProfile: {
                name: profile?.nickname || "",
                avatar: profile?.avatar_url || null,
            },
            messageType: msg.message_type,
            content: msg.content ?? "",
            mediaUrl: msg.media_url,
            fileName: msg.file_name,
            fileSize: msg.file_size,
            duration: msg.duration,
            isRead: msg.is_read,
            createdAt: msg.created_at,
            isMine: msg.sender_id === userId,
            contentMetadata: (msg as { content_metadata?: MessageItem["contentMetadata"] })
                .content_metadata ?? null,
        };
    });
}
