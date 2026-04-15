import { BaseService } from "@/lib/baseService";
import type {
    GetChatroomsDto,
    GetChatroomsResponseDto,
} from "../api/chat/list-chatrooms/entity";
import type {
    createChatroomsDto,
    createChatroomsResponseDto,
} from "../api/chat/create-chatroom/entity";
import type {
    GetMessagesDto,
    GetMessagesResponseDto,
} from "../api/chat/list-messages/entity";
import type {
    SearchMessagesDto,
    SearchMessagesResponseDto,
} from "../api/chat/search-messages/entity";
import type {
    SendMessageDto,
    SendMessageResponseDto,
} from "../api/chat/send-message/entity";
import type {
    MarkAsReadDto,
    MarkAsReadResponseDto,
} from "../api/chat/mark-as-read/entity";
import type {
    GetUnreadCountDto,
    GetUnreadCountResponseDto,
} from "../api/chat/get-unread-count/entity";
import {
    GetChatroomDto,
    GetChatroomResponseDto,
} from "../api/chat/get-chatroom/entity";
import type {
    ListStudentVideosDto,
    ListStudentVideosResponseDto,
} from "../api/chat/list-student-videos/entity";

class ChatService extends BaseService {
    constructor() {
        super("/api/chat");
    }

    async listChatrooms(reqData: GetChatroomsDto) {
        const res = await this.post<GetChatroomsResponseDto>(
            "list-chatrooms",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async createConversation(reqData: createChatroomsDto) {
        const res = await this.post<createChatroomsResponseDto>(
            "create-chatroom",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async listMessages(reqData: GetMessagesDto) {
        const res = await this.post<GetMessagesResponseDto>(
            "list-messages",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async searchMessages(reqData: SearchMessagesDto) {
        const res = await this.post<SearchMessagesResponseDto>(
            "search-messages",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async sendMessage(reqData: SendMessageDto) {
        const res = await this.post<SendMessageResponseDto>(
            "send-message",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async markAsRead(reqData: MarkAsReadDto) {
        const res = await this.post<MarkAsReadResponseDto>(
            "mark-as-read",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async getUnreadCount(reqData: GetUnreadCountDto = {}) {
        const res = await this.post<GetUnreadCountResponseDto>(
            "get-unread-count",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async getChatroom(reqData: GetChatroomDto) {
        const res = await this.post<GetChatroomResponseDto>(
            "get-chatroom",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async listStudentVideos(reqData: ListStudentVideosDto) {
        const res = await this.post<ListStudentVideosResponseDto>(
            "list-student-videos",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }
}

export const chatService = new ChatService();
