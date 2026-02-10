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
import type {
    SubmitPublicActionEditDto,
    SubmitPublicActionEditResponseDto,
} from "@/app/api/public-action-lib/submit-edit/entity";
import type {
    ListPublicActionEditsDto,
    ListPublicActionEditsResponseDto,
} from "@/app/api/public-action-lib/list-edits/entity";
import type {
    ReviewPublicActionEditDto,
    ReviewPublicActionEditResponseDto,
} from "@/app/api/public-action-lib/review-edit/entity";
import type {
    ListPublicActionContributorsDto,
    ListPublicActionContributorsResponseDto,
} from "@/app/api/public-action-lib/list-contributors/entity";
import type {
    SyncPublicActionToMyLibDto,
    SyncPublicActionToMyLibResponseDto,
} from "@/app/api/public-action-lib/sync-to-my-lib/entity";
import type {
    PendingEditsSummaryResponseDto,
} from "@/app/api/public-action-lib/pending-edits-summary/entity";
import type {
    GetPublicActionDto,
    GetPublicActionResponseDto,
} from "@/app/api/public-action-lib/get-action/entity";

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

    async submitEdit(reqData: SubmitPublicActionEditDto) {
        const res = await this.post<SubmitPublicActionEditResponseDto>(
            "submit-edit",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || "提交编辑建议失败");
    }

    async listEdits(reqData: ListPublicActionEditsDto) {
        const res = await this.post<ListPublicActionEditsResponseDto>(
            "list-edits",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || "获取编辑记录失败");
    }

    async reviewEdit(reqData: ReviewPublicActionEditDto) {
        const res = await this.post<ReviewPublicActionEditResponseDto>(
            "review-edit",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || "审核失败");
    }

    async listContributors(reqData: ListPublicActionContributorsDto) {
        const res = await this.post<ListPublicActionContributorsResponseDto>(
            "list-contributors",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || "获取贡献者失败");
    }

    async syncToMyLib(reqData: SyncPublicActionToMyLibDto) {
        const res = await this.post<SyncPublicActionToMyLibResponseDto>(
            "sync-to-my-lib",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || "同步失败");
    }

    async pendingEditsSummary() {
        const res = await this.post<PendingEditsSummaryResponseDto>(
            "pending-edits-summary",
            {},
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || "获取待审核编辑失败");
    }

    async getAction(reqData: GetPublicActionDto) {
        const res = await this.post<GetPublicActionResponseDto>(
            "get-action",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || "获取公共动作失败");
    }
}

export const publicActionLibService = new PublicActionLibService(
    "/api/public-action-lib",
);

