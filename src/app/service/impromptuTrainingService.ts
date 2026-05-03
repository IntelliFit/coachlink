import { BaseService } from "@/lib/baseService";
import type {
    StartImpromptuDto,
    StartImpromptuResponseDto,
} from "@/app/api/impromptu/start/entity";
import type {
    CompleteImpromptuSetDto,
    CompleteImpromptuSetResponseDto,
} from "@/app/api/impromptu/complete-set/entity";
import type {
    FinishImpromptuDto,
    FinishImpromptuResponseDto,
} from "@/app/api/impromptu/finish/entity";
import type {
    GetImpromptuExecutionDto,
    GetImpromptuExecutionResponseDto,
} from "@/app/api/impromptu/get/entity";
import type {
    ListImpromptuActionsDto,
    ListImpromptuActionsResponseDto,
} from "@/app/api/impromptu/list-actions/entity";
import type {
    AddImpromptuExtraExerciseDto,
    AddImpromptuExtraExerciseResponseDto,
    AddImpromptuExtraSetDto,
    AddImpromptuExtraSetResponseDto,
    DeleteImpromptuExtraExerciseDto,
    DeleteImpromptuExtraExerciseResponseDto,
    DeleteImpromptuExtraSetDto,
    DeleteImpromptuExtraSetResponseDto,
} from "@/app/api/impromptu/extra-content/entity";

class ImpromptuTrainingService extends BaseService {
    async listActions(reqData: ListImpromptuActionsDto = {}) {
        const res = await this.post<ListImpromptuActionsResponseDto>(
            "list-actions",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async start(reqData: StartImpromptuDto) {
        const res = await this.post<StartImpromptuResponseDto>("start", reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async get(reqData: GetImpromptuExecutionDto) {
        const res = await this.post<GetImpromptuExecutionResponseDto>("get", reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async completeSet(reqData: CompleteImpromptuSetDto) {
        const res = await this.post<CompleteImpromptuSetResponseDto>(
            "complete-set",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async finish(reqData: FinishImpromptuDto) {
        const res = await this.post<FinishImpromptuResponseDto>("finish", reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async addExtraSet(reqData: AddImpromptuExtraSetDto) {
        const res = await this.post<AddImpromptuExtraSetResponseDto>(
            "extra-content/add-extra-set",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async addExtraExercise(reqData: AddImpromptuExtraExerciseDto) {
        const res = await this.post<AddImpromptuExtraExerciseResponseDto>(
            "extra-content/add-extra-exercise",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async deleteExtraSet(reqData: DeleteImpromptuExtraSetDto) {
        const res = await this.post<DeleteImpromptuExtraSetResponseDto>(
            "extra-content/delete-extra-set",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async deleteExtraExercise(reqData: DeleteImpromptuExtraExerciseDto) {
        const res = await this.post<DeleteImpromptuExtraExerciseResponseDto>(
            "extra-content/delete-extra-exercise",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }
}

export const impromptuTrainingService = new ImpromptuTrainingService(
    "/api/impromptu",
);

