import { BaseService } from "@/lib/baseService";

// 排行榜创建相关接口
import type {
    CreateLeaderboardDto,
    CreateLeaderboardResponseDto
} from '@/app/api/ranking/create-leaderboard/entity';

// 排行榜获取相关接口
import type {
    GetLeaderboardDto,
    GetLeaderboardResponseDto
} from '@/app/api/ranking/get-leaderboard/entity';

// 排行榜列表相关接口
import type {
    ListLeaderboardDto,
    ListLeaderboardResponseDto
} from '@/app/api/ranking/list-leaderboard/entity';

// 排行榜删除相关接口
import type {
    DeleteLeaderboardDto,
    DeleteLeaderboardResponseDto
} from '@/app/api/ranking/delete-leaderboard/entity';

// 排行榜更新相关接口
import type {
    UpdateLeaderboardDto,
    UpdateLeaderboardResponseDto
} from '@/app/api/ranking/update-leaderboard/entity';

export interface ListEntriesDto {
    template_id?: string;
    user_id?: string;
    page?: number;
    limit?: number;
}

export interface ListEntriesResponseDto {
    entries: LeaderboardEntriesRow[];
    total: number;
    page: number;
    limit: number;
}

export interface GetEntryDto {
    id: string;
}

export interface GetEntryResponseDto {
    entry: LeaderboardEntriesRow;
}

export interface CreateEntryDto {
    template_id: string;
    form_data: any;
    score?: number | null;
    evidence_url?: string | null;
    status?: string;
    user_id?: string;
}

export interface CreateEntryResponseDto {
    entry: LeaderboardEntriesRow;
}

export interface UpdateEntryDto {
    id: string;
    form_data?: any;
    score?: number | null;
    evidence_url?: string | null;
    status?: string;
}

export interface UpdateEntryResponseDto {
    entry: LeaderboardEntriesRow;
}

export interface DeleteEntryDto {
    id: string;
}

export interface DeleteEntryResponseDto {
    entry: LeaderboardEntriesRow;
}

export interface LeaderboardEntriesRow {
    created_at: string | null;
    evidence_url: string | null;
    form_data: any;
    id: string;
    score: number | null;
    status: string | null;
    template_id: string | null;
    user_id: string | null;
}

export class RankingService extends BaseService {
    async createLeaderboard(reqData: CreateLeaderboardDto) {
        const res = await this.post<CreateLeaderboardResponseDto>('ranking/create-leaderboard', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async getLeaderboard(reqData: GetLeaderboardDto) {
        const res = await this.post<GetLeaderboardResponseDto>('ranking/get-leaderboard', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async listLeaderboard(reqData?: ListLeaderboardDto) {
        const res = await this.post<ListLeaderboardResponseDto>('ranking/list-leaderboard', reqData || {
            page: 1,
            limit: 10
        });
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async deleteLeaderboard(reqData: DeleteLeaderboardDto) {
        const res = await this.post<DeleteLeaderboardResponseDto>('ranking/delete-leaderboard', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async updateLeaderboard(reqData: UpdateLeaderboardDto) {
        const res = await this.post<UpdateLeaderboardResponseDto>('ranking/update-leaderboard', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async listEntries(reqData: ListEntriesDto) {
        const res = await this.post<ListEntriesResponseDto>('ranking/list-entries', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async getEntry(reqData: GetEntryDto) {
        const res = await this.post<GetEntryResponseDto>('ranking/get-entry', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async createEntry(reqData: CreateEntryDto) {
        const res = await this.post<CreateEntryResponseDto>('ranking/create-entry', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async updateEntry(reqData: UpdateEntryDto) {
        const res = await this.post<UpdateEntryResponseDto>('ranking/update-entry', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async deleteEntry(reqData: DeleteEntryDto) {
        const res = await this.post<DeleteEntryResponseDto>('ranking/delete-entry', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }
}

export const rankingService = new RankingService('/api');