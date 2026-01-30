import { BaseService } from "@/lib/baseService";
import { CoachActionRow } from "@/types";
import { ListActionsDto, ListActionsResponseDto } from "@/app/api/action-lib/list-actions/entity";
import { AddActionDto, AddActionResponseDto } from "@/app/api/action-lib/add-action/entity";
import { UpdateActionRequest, UpdateActionResponse } from "@/app/api/action-lib/update-action/entity";
import { DeleteActionDto, DeleteActionResponseDto } from "@/app/api/action-lib/delete-action/entity";
import { GetActionDto, GetActionResponseDto } from "@/app/api/action-lib/get-action/entity";
import { ListAutoComputeActionsDto, ListAutoComputeActionsResponseDto } from "../api/action-lib/list-auto-compute-actions/entity";
import { UploadDemoVideoResponseDto } from "@/app/api/action-lib/upload-demo-video/entity";
import type {
    ActionReferencesDto,
    ActionReferencesResponseDto,
} from "@/app/api/action-lib/action-references/entity";
import type {
    MergeActionsDto,
    MergeActionsResponseDto,
} from "@/app/api/action-lib/merge-actions/entity";

export class ActionLibService extends BaseService {
    async listActions(reqData: ListActionsDto) {
        const res = await this.post<ListActionsResponseDto>("list-actions", reqData);
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to fetch actions");
        }
        return res.data.data;
    }

    async listAutoComputeActions(reqData: ListAutoComputeActionsDto) {
        const res = await this.post<ListAutoComputeActionsResponseDto>("list-auto-compute-actions", reqData);
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to fetch auto compute actions");
        }
        return res.data.data;
    }

    async getAction(reqData: GetActionDto) {
        const res = await this.post<GetActionResponseDto>("get-action", reqData);
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to fetch action");
        }
        return res.data.data;
    }

    async addAction(reqData: AddActionDto) {
        const res = await this.post<AddActionResponseDto>("add-action", reqData);
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to add action");
        }
        return res.data.data;
    }

    async updateAction(reqData: UpdateActionRequest) {
        const res = await this.post<UpdateActionResponse>("update-action", reqData);
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to update action");
        }
        return res.data.data;
    }

    async deleteAction(reqData: DeleteActionDto) {
        const res = await this.post<DeleteActionResponseDto>("delete-action", reqData);
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to delete action");
        }
        return res.data.data;
    }

    async getActionReferences(reqData: ActionReferencesDto) {
        const res = await this.post<ActionReferencesResponseDto>(
            "action-references",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res?.data?.message || "获取动作引用失败");
        }
        return res.data.data;
    }

    async mergeActions(reqData: MergeActionsDto) {
        const res = await this.post<MergeActionsResponseDto>("merge-actions", reqData);
        if (!res || !res.data.success) {
            throw new Error(res?.data?.message || "合并动作失败");
        }
        return res.data.data;
    }

    async uploadDemoVideo(file: File) {
        const form = new FormData();
        form.append("file", file);

        const res = await this.post<UploadDemoVideoResponseDto>(
            "upload-demo-video",
            form,
            {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            },
        );

        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to upload demo video");
        }
        return res.data.data;
    }
}

export const actionLibService = new ActionLibService('/api/action-lib');