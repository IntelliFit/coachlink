import { BaseService } from "@/lib/baseService";
import { CoachActionRow } from "@/types";
import { GetActionsRequest, GetActionsResponse } from "@/app/api/action-lib/get-actions/entity";
import { AddActionRequest, AddActionResponse } from "@/app/api/action-lib/add-action/entity";
import { UpdateActionRequest, UpdateActionResponse } from "@/app/api/action-lib/update-action/entity";
import { DeleteActionRequest, DeleteActionResponse } from "@/app/api/action-lib/delete-action/entity";
import { GetActionRequest, GetActionResponse } from "@/app/api/action-lib/get-action/entity";

export class ActionLibService extends BaseService {
    async getActions(reqData: GetActionsRequest) {
        const res = await this.post<GetActionsResponse>('get-actions', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async getAction(reqData: GetActionRequest) {
        const res = await this.post<GetActionResponse>('get-action', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async addAction(reqData: AddActionRequest) {
        const res = await this.post<AddActionResponse>('add-action', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async updateAction(reqData: UpdateActionRequest) {
        const res = await this.post<UpdateActionResponse>('update-action', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async deleteAction(reqData: DeleteActionRequest) {
        const res = await this.post<DeleteActionResponse>('delete-action', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }
}

export const actionLibService = new ActionLibService('/api/action-lib');