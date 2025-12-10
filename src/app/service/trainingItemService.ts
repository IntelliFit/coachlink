import { BaseService } from "@/lib/baseService";
import type { 
    CreateTrainingItemDto, 
    CreateTrainingItemResponseDto
} from '../api/plan-lib/training-items/create/entity';
import type { 
    UpdateTrainingItemDto,
    UpdateTrainingItemResponseDto
} from '../api/plan-lib/training-items/update/entity';
import type { 
    DeleteTrainingItemDto,
    DeleteTrainingItemResponseDto
} from '../api/plan-lib/training-items/delete/entity';
import type { 
    GetTrainingItemDto,
    GetTrainingItemResponseDto
} from '../api/plan-lib/training-items/get/entity';
import type { 
    ListTrainingItemsDto,
    ListTrainingItemsResponseDto
} from '../api/plan-lib/training-items/list-training-items/entity';
import { ApiData } from "@/types/api";

class TrainingItemService extends BaseService {
    async createTrainingItem(reqData: CreateTrainingItemDto) {
        const res = await this.post<CreateTrainingItemResponseDto>('plan-lib/training-items/create', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || '创建训练项目失败');
    }

    async updateTrainingItem(reqData: UpdateTrainingItemDto) {
        const res = await this.post<UpdateTrainingItemResponseDto>('update', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || '更新训练项目失败');
    }

    async deleteTrainingItem(reqData: DeleteTrainingItemDto) {
        const res = await this.post<DeleteTrainingItemResponseDto>('delete', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || '删除训练项目失败');
    }

    async getTrainingItem(reqData: GetTrainingItemDto) {
        const res = await this.post<GetTrainingItemResponseDto>('get', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || '获取训练项目失败');
    }

    async listTrainingItems(reqData?: ListTrainingItemsDto) {
        const res = await this.post<ListTrainingItemsResponseDto>('list-training-items', reqData || {});
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || '获取训练项目列表失败');
    }
}

export const trainingItemService = new TrainingItemService('/api/plan-lib/training-items');