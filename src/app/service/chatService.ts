import { BaseService } from '@/lib/baseService';
import type { GetConversationsDto, GetConversationsResponseDto } from '../api/chat/get-conversations/entity';
import type { GetOrCreateConversationDto, GetOrCreateConversationResponseDto } from '../api/chat/get-or-create-conversation/entity';
import type { GetMessagesDto, GetMessagesResponseDto } from '../api/chat/get-messages/entity';
import type { SendMessageDto, SendMessageResponseDto } from '../api/chat/send-message/entity';
import type { MarkAsReadDto, MarkAsReadResponseDto } from '../api/chat/mark-as-read/entity';
import type { GetUnreadCountDto, GetUnreadCountResponseDto } from '../api/chat/get-unread-count/entity';

class ChatService extends BaseService {
    constructor() {
        super('/api/chat');
    }

    async getConversations(reqData: GetConversationsDto) {
        const res = await this.post<GetConversationsResponseDto>('get-conversations', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async getOrCreateConversation(reqData: GetOrCreateConversationDto) {
        const res = await this.post<GetOrCreateConversationResponseDto>('get-or-create-conversation', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async getMessages(reqData: GetMessagesDto) {
        const res = await this.post<GetMessagesResponseDto>('get-messages', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async sendMessage(reqData: SendMessageDto) {
        const res = await this.post<SendMessageResponseDto>('send-message', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async markAsRead(reqData: MarkAsReadDto) {
        const res = await this.post<MarkAsReadResponseDto>('mark-as-read', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async getUnreadCount(reqData: GetUnreadCountDto = {}) {
        const res = await this.post<GetUnreadCountResponseDto>('get-unread-count', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }
}

export const chatService = new ChatService();


