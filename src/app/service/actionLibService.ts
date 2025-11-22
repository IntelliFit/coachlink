import { BaseService } from "@/lib/baseService";
import { CoachActionRow } from "@/types";
import { GetActionsRequest, GetActionsResponse } from "@/app/api/action-lib/get-actions/entity";
import { AddActionRequest, AddActionResponse } from "@/app/api/action-lib/add-action/entity";
import { UpdateActionRequest, UpdateActionResponse } from "@/app/api/action-lib/update-action/entity";
import { DeleteActionRequest, DeleteActionResponse } from "@/app/api/action-lib/delete-action/entity";
import { GetActionRequest, GetActionResponse } from "@/app/api/action-lib/get-action/entity";

export class ActionLibService extends BaseService {
    async getActions(request: GetActionsRequest): Promise<GetActionsResponse> {
        const res = await fetch("/api/action-lib/get-actions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
        });

        if (!res.ok) {
            throw new Error("Failed to fetch actions");
        }

        return res.json();
    }

    async getAction(request: GetActionRequest): Promise<GetActionResponse> {
        const res = await fetch("/api/action-lib/get-action", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
        });

        if (!res.ok) {
            throw new Error("Failed to fetch action");
        }

        return res.json();
    }

    async addAction(action: AddActionRequest): Promise<AddActionResponse> {
        const res = await fetch("/api/action-lib/add-action", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(action),
        });

        if (!res.ok) {
            throw new Error("Failed to add action");
        }

        return res.json();
    }

    async updateAction(action: UpdateActionRequest): Promise<UpdateActionResponse> {
        const res = await fetch("/api/action-lib/update-action", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(action),
        });

        if (!res.ok) {
            throw new Error("Failed to update action");
        }

        return res.json();
    }

    async deleteAction(request: DeleteActionRequest): Promise<DeleteActionResponse> {
        const res = await fetch("/api/action-lib/delete-action", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
        });

        if (!res.ok) {
            throw new Error("Failed to delete action");
        }

        return res.json();
    }
}

export const actionLibService = new ActionLibService('/api/action-lib');