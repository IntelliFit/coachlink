import { BaseService } from "@/lib/baseService";
import { TrainingPlanRow } from "@/types";
import { ListTemplatesDto, ListTemplatesResponseDto } from "@/app/api/plan-lib/list-templates/entity";
import { GetTemplateDto, GetTemplateResponseDto } from "@/app/api/plan-lib/get-template/entity";
import { AddTemplateDto, AddTemplateResponseDto } from "@/app/api/plan-lib/add-template/entity";
import { UpdateTemplateDto, UpdateTemplateResponseDto } from "@/app/api/plan-lib/update-template/entity";
import { DeleteTemplateDto, DeleteTemplateResponseDto } from "@/app/api/plan-lib/delete-template/entity";

export class PlanLibService extends BaseService {

    async listTemplates(reqData: ListTemplatesDto) {
        const res = await this.post<ListTemplatesResponseDto>("list-templates", reqData);
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to fetch templates");
        }
        return res.data.data;
    }

    async getTemplate(reqData: GetTemplateDto) {
        const res = await this.post<GetTemplateResponseDto>("get-template", reqData);
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to fetch template");
        }
        return res.data.data;
    }

    async addTemplate(reqData: AddTemplateDto) {
        const res = await this.post<AddTemplateResponseDto>("add-template", reqData);
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to add template");
        }
        return res.data.data;
    }

    async updateTemplate(reqData: UpdateTemplateDto) {
        const res = await this.post<UpdateTemplateResponseDto>("update-template", reqData);
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to update template");
        }
        return res.data.data;
    }

    async deleteTemplate(reqData: DeleteTemplateDto) {
        const res = await this.post<DeleteTemplateResponseDto>("delete-template", reqData);
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to delete template");
        }
        return res.data.data;
    }
}

export const planLibService = new PlanLibService('/api/plan-lib');