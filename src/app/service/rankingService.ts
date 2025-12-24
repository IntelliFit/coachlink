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
}

export const rankingService = new RankingService('/api');