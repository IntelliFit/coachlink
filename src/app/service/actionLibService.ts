import { BaseService } from "@/lib/baseService";
import type { 
  GetActionsDto, 
  GetActionsResponseDto,
  ExerciseAction
} from "@/app/api/action-lib/get-actions/entity";
import type { 
  AddActionDto, 
  AddActionResponseDto 
} from "@/app/api/action-lib/add-action/entity";
import type { 
  UpdateActionDto, 
  UpdateActionResponseDto 
} from "@/app/api/action-lib/update-action/entity";
import type { 
  DeleteActionDto, 
  DeleteActionResponseDto 
} from "@/app/api/action-lib/delete-action/entity";
import type { 
  GetActionDto, 
  GetActionResponseDto 
} from "@/app/api/action-lib/get-action/entity";

export class ActionLibService extends BaseService { 
  async getActions(reqData: GetActionsDto) {
    const res = await this.post<GetActionsResponseDto>('get-actions', reqData);
    if (res.data && res.data.success) {
      return res.data.data;
    }
  }

  async getAction(reqData: GetActionDto) {
    const res = await this.post<GetActionResponseDto>('get-action', reqData);
    if (res.data && res.data.success) {
      return res.data.data;
    }
  }

  async addAction(reqData: AddActionDto) {
    const res = await this.post<AddActionResponseDto>('add-action', reqData);
    if (res.data && res.data.success) {
      return res.data.data;
    }
  }

  async updateAction(reqData: UpdateActionDto) {
    const res = await this.post<UpdateActionResponseDto>('update-action', reqData);
    if (res.data && res.data.success) {
      return res.data.data;
    }
  }

  async deleteAction(reqData: DeleteActionDto) {
    const res = await this.post<DeleteActionResponseDto>('delete-action', reqData);
    if (res.data && res.data.success) {
      return res.data.data;
    }
  }
}

export const actionLibService = new ActionLibService("/api/action-lib");