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
import type {
    KnowledgeBookDiscussionComment,
    ListKnowledgeBookCommentsResponse,
} from "@/types/knowledgeBookDiscussion";

export type PublicTrainingPlanLevel = "beginner" | "intermediate" | "advanced";

export interface PublicTrainingPlanListItem {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    sport: string;
    goal: string;
    level: PublicTrainingPlanLevel;
    weeks: number;
    daysPerWeek: number;
    equipment: string[];
    tags: string[];
    suitableFor: string;
    audience?: string | null;
    notes: string[];
    templateKind?: "fixed" | "parameterized";
    parameterSchema?: Record<string, any>;
    actionSlots?: any[];
    specialtyKey?: string;
    specialtyLabel?: string;
    specialtyPriority?: number;
    trainingDayCount?: number;
    entryKind?: "template" | "reference";
    canCopy?: boolean;
    author?: string | null;
    sourceName?: string | null;
    sourceUrl?: string | null;
    rightsStatus?: string | null;
}

export interface PublicTrainingPlanDetail extends PublicTrainingPlanListItem {
    trainingDays: any[];
}


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

    async listBookComments(bookId: string, params?: { limit?: number; offset?: number }) {
        const res = await this.post<ListKnowledgeBookCommentsResponse>('book-comments/list', {
            bookId,
            limit: params?.limit ?? 50,
            offset: params?.offset ?? 0,
        });
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async createBookComment(input: { bookId: string; body: string; parentId?: string | null }) {
        const res = await this.post<{ comment: KnowledgeBookDiscussionComment }>(
            'book-comments/create',
            input,
        );
        if (res.data && res.data.success) {
            return res.data.data?.comment || null;
        }
        return null;
    }

    async deleteBookComment(commentId: string) {
        const res = await this.post<{ commentId: string }>('book-comments/delete', { commentId });
        return Boolean(res.data?.success);
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

    async listTrainingPlans(params?: {
        level?: "all" | PublicTrainingPlanLevel;
        specialty?: string;
        limit?: number;
        offset?: number;
        search?: string;
    }) {
        const query = new URLSearchParams();
        query.set("level", params?.level || "all");
        if (params?.specialty) query.set("specialty", params.specialty);
        query.set("limit", String(params?.limit ?? 20));
        query.set("offset", String(params?.offset ?? 0));
        if (params?.search) query.set("q", params.search);

        const res = await this.get<{
            plans: PublicTrainingPlanListItem[];
            total: number;
            limit: number;
            offset: number;
        }>(`training-plans?${query.toString()}`);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return { plans: [], total: 0, limit: params?.limit ?? 20, offset: params?.offset ?? 0 };
    }

    async getTrainingPlan(idOrSlug: string) {
        const res = await this.get<{ plan: PublicTrainingPlanDetail }>(
            `training-plans/${encodeURIComponent(idOrSlug)}`,
        );
        if (res.data && res.data.success) {
            return res.data.data?.plan || null;
        }
        return null;
    }

    async copyTrainingPlanToFavorite(idOrSlug: string) {
        const res = await this.post<{ favorite: any }>(
            `training-plans/${encodeURIComponent(idOrSlug)}/copy-to-favorite`,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }
}

export default new KnowledgeService("/api/knowledge");
