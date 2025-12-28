import { BaseService } from "@/lib/baseService";
import type {
    ListStudentActionsDto,
    ListStudentActionsResponseDto,
} from "@/app/api/student/action-lib/list-actions/entity";
import type {
    AddStudentActionDto,
    AddStudentActionResponseDto,
} from "@/app/api/student/action-lib/add-action/entity";
import type {
    UpdateStudentActionDto,
    UpdateStudentActionResponseDto,
} from "@/app/api/student/action-lib/update-action/entity";
import type {
    DeleteStudentActionDto,
    DeleteStudentActionResponseDto,
} from "@/app/api/student/action-lib/delete-action/entity";
import type {
    BatchCreateStudentActionsDto,
    BatchCreateStudentActionsResponseDto,
} from "@/app/api/student/action-lib/batch-create-actions/entity";

export class StudentActionLibService extends BaseService {
    async listActions(reqData: ListStudentActionsDto) {
        const res = await this.post<ListStudentActionsResponseDto>(
            "list-actions",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res?.data?.message || "获取动作列表失败");
        }
        return res.data.data;
    }

    async addAction(reqData: AddStudentActionDto) {
        const res = await this.post<AddStudentActionResponseDto>(
            "add-action",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res?.data?.message || "添加动作失败");
        }
        return res.data.data;
    }

    async updateAction(reqData: UpdateStudentActionDto) {
        const res = await this.post<UpdateStudentActionResponseDto>(
            "update-action",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res?.data?.message || "更新动作失败");
        }
        return res.data.data;
    }

    async deleteAction(reqData: DeleteStudentActionDto) {
        const res = await this.post<DeleteStudentActionResponseDto>(
            "delete-action",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res?.data?.message || "删除动作失败");
        }
        return res.data.data;
    }

    async batchCreateActions(reqData: BatchCreateStudentActionsDto) {
        const res = await this.post<BatchCreateStudentActionsResponseDto>(
            "batch-create-actions",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res?.data?.message || "批量创建动作失败");
        }
        return res.data.data;
    }
}

export const studentActionLibService = new StudentActionLibService(
    "/api/student/action-lib",
);
