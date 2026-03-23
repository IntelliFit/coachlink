import { BaseService } from "@/lib/baseService";
import { TrainingPlanRow } from "@/types";
import {
    ListTemplatesDto,
    ListTemplatesResponseDto,
} from "@/app/api/plan-lib/list-templates/entity";
import {
    GetTemplateDto,
    GetTemplateResponseDto,
} from "@/app/api/plan-lib/get-template/entity";
import {
    AddTemplateDto,
    AddTemplateResponseDto,
} from "@/app/api/plan-lib/create-template/entity";
import {
    UpdateTemplateDto,
    UpdateTemplateResponseDto,
} from "@/app/api/plan-lib/update-template/entity";
import {
    DeleteTemplateDto,
    DeleteTemplateResponseDto,
} from "@/app/api/plan-lib/delete-template/entity";
import {
    CopyTemplateDto,
    CopyTemplateResponseDto,
} from "@/app/api/plan-lib/copy-template/entity";
import type {
    GetInstanceDto,
    GetInstanceResponseDto,
} from "@/app/api/plan-lib/get-instance/entity";
import type {
    GetTodayTrainingInstanceDto,
    GetTodayTrainingInstanceResponseDto,
} from "@/app/api/plan-lib/get-today-training-instance/entity";
import type {
    CreateInstanceDto,
    CreateInstanceResponseDto,
} from "@/app/api/plan-lib/create-instance/entity";
import type {
    UpdateInstanceDto,
    UpdateInstanceResponseDto,
} from "@/app/api/plan-lib/update-instance/entity";
import type {
    DeleteInstanceDto,
    DeleteInstanceResponseDto,
} from "@/app/api/plan-lib/delete-instance/entity";
import type {
    ArchiveInstanceDto,
    ArchiveInstanceResponseDto,
} from "@/app/api/plan-lib/archive-instance/entity";
import {
    GetWithExecutionsDto,
    GetWithExecutionsResponseDto,
} from "../api/plan-lib/get-with-executions/entity";
import type {
    GetUniqueTemplateTagsDto,
    GetUniqueTemplateTagsResponseDto,
} from "@/app/api/plan-lib/get-unique-template-tags/entity";
import {
    CreateAiInstanceDto,
    CreateAiInstanceResponseDto,
} from "../api/plan-lib/create-ai-instance/entity";
import type {
    BulkCreateAiInstancesDto,
    BulkCreateAiInstancesResponseDto,
} from "../api/plan-lib/bulk-create-ai-instances/entity";

export class PlanLibService extends BaseService {
    async listTemplates(reqData: ListTemplatesDto) {
        const res = await this.post<ListTemplatesResponseDto>(
            "list-templates",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to fetch templates");
        }
        return res.data.data;
    }

    async getTemplate(reqData: GetTemplateDto) {
        const res = await this.post<GetTemplateResponseDto>(
            "get-template",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to fetch template");
        }
        return res.data.data;
    }

    async addTemplate(reqData: AddTemplateDto) {
        const res = await this.post<AddTemplateResponseDto>(
            "create-template",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to add template");
        }
        return res.data.data;
    }

    async updateTemplate(reqData: UpdateTemplateDto) {
        const res = await this.post<UpdateTemplateResponseDto>(
            "update-template",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to update template");
        }
        return res.data.data;
    }

    async deleteTemplate(reqData: DeleteTemplateDto) {
        const res = await this.post<DeleteTemplateResponseDto>(
            "delete-template",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to delete template");
        }
        return res.data.data;
    }

    async copyTemplate(reqData: CopyTemplateDto) {
        const res = await this.post<CopyTemplateResponseDto>(
            "copy-template",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to copy template");
        }
        return res.data.data;
    }

    // 实例相关方法

    /**
     * Canonical instance API.
     * Prefer this in new code paths.
     */
    async getInstance(reqData: GetInstanceDto) {
        const res = await this.post<GetInstanceResponseDto>(
            "get-instance",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to fetch instance");
        }
        return res.data.data;
    }

    // Alias with clearer intent for new callers.
    async getPlanInstance(reqData: GetInstanceDto) {
        return this.getInstance(reqData);
    }

    /**
     * Aggregated legacy endpoint (coach plan + self plan).
     * Internally now delegates to get-instance so core logic stays single-source.
     */
    async getTodayTrainingInstance(reqData: GetTodayTrainingInstanceDto) {
        const res = await this.post<GetTodayTrainingInstanceResponseDto>(
            "get-today-training-instance",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to fetch today training instance");
        }
        return res.data.data;
    }

    // Alias with clearer intent for new callers.
    async getTodayTrainingBundle(reqData: GetTodayTrainingInstanceDto) {
        return this.getTodayTrainingInstance(reqData);
    }

    async createInstance(reqData: CreateInstanceDto) {
        const res = await this.post<CreateInstanceResponseDto>(
            "create-instance",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to create instance");
        }
        return res.data.data;
    }

    async createAiInstance(reqData: CreateAiInstanceDto) {
        const res = await this.post<CreateAiInstanceResponseDto>(
            "create-ai-instance",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to create ai instance");
        }
        return res.data.data;
    }

    async bulkCreateAiInstances(reqData: BulkCreateAiInstancesDto) {
        const res = await this.post<BulkCreateAiInstancesResponseDto>(
            "bulk-create-ai-instances",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to bulk create ai instances");
        }
        return res.data.data;
    }

    async updateInstance(reqData: UpdateInstanceDto) {
        const res = await this.post<UpdateInstanceResponseDto>(
            "update-instance",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to update instance");
        }
        return res.data.data;
    }

    async deleteInstance(reqData: DeleteInstanceDto) {
        const res = await this.post<DeleteInstanceResponseDto>(
            "delete-instance",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to delete instance");
        }
        return res.data.data;
    }

    async archiveInstance(reqData: ArchiveInstanceDto) {
        const res = await this.post<ArchiveInstanceResponseDto>(
            "archive-instance",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to archive instance");
        }
        return res.data.data;
    }

    async getWithExecutions(reqData: GetWithExecutionsDto) {
        const res = await this.post<GetWithExecutionsResponseDto>(
            "get-with-executions",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(
                res.data.message || "Failed to get plan with executions",
            );
        }
        return res.data.data;
    }

    async getUniqueTemplateTags(reqData: GetUniqueTemplateTagsDto) {
        const res = await this.post<GetUniqueTemplateTagsResponseDto>(
            "get-unique-template-tags",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(
                res.data.message || "Failed to fetch template tags",
            );
        }
        return res.data.data;
    }
}

export const planLibService = new PlanLibService("/api/plan-lib");
