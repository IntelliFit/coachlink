import { BaseService } from "@/lib/baseService";
import type { GetLeaderboardDto, GetLeaderboardResponseDto } from "../api/ranking/get-leaderboard/entity";

export class RankingService extends BaseService {
    async getLeaderboard(reqData: GetLeaderboardDto) {
        const res = await this.post<GetLeaderboardResponseDto>('get-leaderboard', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return;
    }
}


export const rankingService = new RankingService('/api/ranking');