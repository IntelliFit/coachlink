import { BaseService } from "@/lib/baseService";

import type {
    ListPublicActionsDto,
    ListPublicActionsResponseDto,
} from "@/app/api/public-action-lib/list-actions/entity";
import type {
    AddPublicActionDto,
    AddPublicActionResponseDto,
} from "@/app/api/public-action-lib/add-action/entity";
import type {
    AddPublicActionToMyLibDto,
    AddPublicActionToMyLibResponseDto,
} from "@/app/api/public-action-lib/add-to-my-lib/entity";
import type {
    TogglePublicActionLikeDto,
    TogglePublicActionLikeResponseDto,
} from "@/app/api/public-action-lib/toggle-like/entity";
import type {
    PublishFromMyActionDto,
    PublishFromMyActionResponseDto,
} from "@/app/api/public-action-lib/publish-from-my-action/entity";

export class PublicActionLibService extends BaseService {
    async listActions(reqData: ListPublicActionsDto) {
        const res = await this.post<ListPublicActionsResponseDto>(
            "list-actions",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || "获取公共动作列表失败");
    }

    async addAction(reqData: AddPublicActionDto) {
        const res = await this.post<AddPublicActionResponseDto>(
            "add-action",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || "贡献动作失败");
    }

    async addToMyLib(reqData: AddPublicActionToMyLibDto) {
        const res = await this.post<AddPublicActionToMyLibResponseDto>(
            "add-to-my-lib",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || "加入我的动作库失败");
    }

    async toggleLike(reqData: TogglePublicActionLikeDto) {
        const res = await this.post<TogglePublicActionLikeResponseDto>(
            "toggle-like",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || "点赞操作失败");
    }

    async publishFromMyAction(reqData: PublishFromMyActionDto) {
        const res = await this.post<PublishFromMyActionResponseDto>(
            "publish-from-my-action",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || "贡献失败");
    }
}

export const publicActionLibService = new PublicActionLibService(
    "/api/public-action-lib",
);

