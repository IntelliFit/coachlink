import { BaseService } from "@/lib/baseService";
import type {
    ListFavoritesDto,
    ListFavoritesResponseDto,
} from "@/app/api/student/plan-lib/list-favorites/entity";
import type {
    GetFavoriteDto,
    GetFavoriteResponseDto,
} from "@/app/api/student/plan-lib/get-favorite/entity";
import type {
    SaveFavoriteDto,
    SaveFavoriteResponseDto,
} from "@/app/api/student/plan-lib/save-favorite/entity";
import type {
    UpdateFavoriteDto,
    UpdateFavoriteResponseDto,
} from "@/app/api/student/plan-lib/update-favorite/entity";
import type {
    DeleteFavoriteDto,
    DeleteFavoriteResponseDto,
} from "@/app/api/student/plan-lib/delete-favorite/entity";

export class StudentPlanLibService extends BaseService {
    async listFavorites(reqData: ListFavoritesDto) {
        const res = await this.post<ListFavoritesResponseDto>(
            "list-favorites",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res?.data?.message || "获取常用计划列表失败");
        }
        return res.data.data;
    }

    async getFavorite(reqData: GetFavoriteDto) {
        const res = await this.post<GetFavoriteResponseDto>(
            "get-favorite",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res?.data?.message || "获取常用计划失败");
        }
        return res.data.data;
    }

    async saveFavorite(reqData: SaveFavoriteDto) {
        const res = await this.post<SaveFavoriteResponseDto>(
            "save-favorite",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res?.data?.message || "保存常用计划失败");
        }
        return res.data.data;
    }

    async updateFavorite(reqData: UpdateFavoriteDto) {
        const res = await this.post<UpdateFavoriteResponseDto>(
            "update-favorite",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res?.data?.message || "更新常用计划失败");
        }
        return res.data.data;
    }

    async deleteFavorite(reqData: DeleteFavoriteDto) {
        const res = await this.post<DeleteFavoriteResponseDto>(
            "delete-favorite",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res?.data?.message || "删除常用计划失败");
        }
        return res.data.data;
    }

    async applyFavorite(reqData: { favoriteId: string; startDate?: string }) {
        const res = await this.post<
            { planInstanceId: string; message: string }
        >(
            "apply-favorite",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res?.data?.message || "应用计划失败");
        }
        return res.data.data;
    }
}

export const studentPlanLibService = new StudentPlanLibService(
    "/api/student/plan-lib",
);
