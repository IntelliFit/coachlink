import { BaseService } from '@/lib/baseService';
import type { GetChatroomsDto, GetChatroomsResponseDto } from '../api/chat/list-chatrooms/entity';
import type { createChatroomsDto, createChatroomsResponseDto } from '../api/chat/create-chatroom/entity';
import type { GetMessagesDto, GetMessagesResponseDto } from '../api/chat/list-messages/entity';
import type { SendMessageDto, SendMessageResponseDto } from '../api/chat/send-message/entity';
import type { MarkAsReadDto, MarkAsReadResponseDto } from '../api/chat/mark-as-read/entity';
import type { GetUnreadCountDto, GetUnreadCountResponseDto } from '../api/chat/get-unread-count/entity';

class ChatService extends BaseService {
    constructor() {
        super('/api/chat');
    }

    async getConversations(reqData: GetChatroomsDto) {
        const res = await this.post<GetChatroomsResponseDto>('list-chatrooms', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async createConversation(reqData: createChatroomsDto) {
        const res = await this.post<createChatroomsResponseDto>('create-chatroom', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async getMessages(reqData: GetMessagesDto) {
        const res = await this.post<GetMessagesResponseDto>('list-messages', reqData);
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


