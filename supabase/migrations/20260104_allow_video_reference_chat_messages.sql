-- 允许聊天消息类型包含 video_reference（用于引用视频的消息）
alter table public.chat_messages
    drop constraint if exists coach_messages_message_type_check;

alter table public.chat_messages
    add constraint chat_messages_message_type_check
    check (message_type in ('text','image','video','voice','file','video_reference'));

