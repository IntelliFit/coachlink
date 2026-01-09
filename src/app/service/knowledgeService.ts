import { BaseService } from "@/lib/baseService";
import {
    KnowledgeBookRow,
    KnowledgeSubscriptionRow
} from "@/types";
import {
    GetKnowledgeBookDto,
    GetKnowledgeBookResponseDto
} from "../api/knowledge/get-book/entity";
import {
    ListKnowledgeBooksDto,
    ListKnowledgeBooksResponseDto
} from "../api/knowledge/list-books/entity";
import {
    CreateKnowledgeBookDto,
    CreateKnowledgeBookResponseDto
} from "../api/knowledge/create-book/entity";
import {
    UpdateKnowledgeBookDto,
    UpdateKnowledgeBookResponseDto
} from "../api/knowledge/update-book/entity";
import {
    GetKnowledgeSubscriptionDto,
    GetKnowledgeSubscriptionResponseDto
} from "../api/knowledge/get-subscription/entity";
import {
    CreateKnowledgeSubscriptionDto,
    CreateKnowledgeSubscriptionResponseDto
} from "../api/knowledge/create-subscription/entity";
import {
    UpdateKnowledgeSubscriptionDto,
    UpdateKnowledgeSubscriptionResponseDto
} from "../api/knowledge/update-subscription/entity";
import {
    ListKnowledgeSubscriptionsDto,
    ListKnowledgeSubscriptionsResponseDto
} from "../api/knowledge/list-subscriptions/entity";


export class KnowledgeService extends BaseService {
    async getKnowledgeBook(reqData: GetKnowledgeBookDto) {
        const res = await this.post<GetKnowledgeBookResponseDto>('get-book', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async listKnowledgeBooks(reqData?: ListKnowledgeBooksDto) {
        const res = await this.post<ListKnowledgeBooksResponseDto>('list-books', reqData || {});
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async createKnowledgeBook(reqData: CreateKnowledgeBookDto) {
        const res = await this.post<CreateKnowledgeBookResponseDto>('create-book', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async updateKnowledgeBook(reqData: UpdateKnowledgeBookDto) {
        const res = await this.post<UpdateKnowledgeBookResponseDto>('update-book', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async getKnowledgeSubscription(reqData?: GetKnowledgeSubscriptionDto) {
        const res = await this.post<GetKnowledgeSubscriptionResponseDto>('get-subscription', reqData || {});
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async createKnowledgeSubscription(reqData: CreateKnowledgeSubscriptionDto) {
        const res = await this.post<CreateKnowledgeSubscriptionResponseDto>('create-subscription', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async updateKnowledgeSubscription(reqData: UpdateKnowledgeSubscriptionDto) {
        const res = await this.post<UpdateKnowledgeSubscriptionResponseDto>('update-subscription', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async listKnowledgeSubscriptions(reqData?: ListKnowledgeSubscriptionsDto) {
        const res = await this.post<ListKnowledgeSubscriptionsResponseDto>('list-subscriptions', reqData || {});
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }
}

export default new KnowledgeService("/api/knowledge");
