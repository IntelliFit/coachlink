import { BaseService } from "@/lib/baseService";
import { CoachActionRow } from "@/types";
import { ListActionsDto, ListActionsResponseDto } from "@/app/api/action-lib/list-actions/entity";
import { AddActionDto, AddActionResponseDto } from "@/app/api/action-lib/add-action/entity";
import { UpdateActionRequest, UpdateActionResponse } from "@/app/api/action-lib/update-action/entity";
import { DeleteActionDto, DeleteActionResponseDto } from "@/app/api/action-lib/delete-action/entity";
import { GetActionDto, GetActionResponseDto } from "@/app/api/action-lib/get-action/entity";
import { ApiData } from "@/types/api";

export class ActionLibService extends BaseService {
    async listActions(reqData: ListActionsDto) {
        const res = await this.post<ListActionsResponseDto>("list-actions", reqData);
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to fetch actions");
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
}

export const actionLibService = new ActionLibService('/api/action-lib');