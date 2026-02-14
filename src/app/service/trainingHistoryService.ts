import { BaseService } from "@/lib/baseService";
import type {
    GetTrainingCalendarDto,
    GetTrainingCalendarResponseDto,
} from "@/app/api/training-history/calendar/entity";
import type {
    GetTrainingDayHistoryDto,
    GetTrainingDayHistoryResponseDto,
} from "@/app/api/training-history/day/entity";
import type {
    GetTrainingMonthShareDto,
    GetTrainingMonthShareResponseDto,
} from "@/app/api/training-history/month-share/entity";

class TrainingHistoryService extends BaseService {
    async getCalendar(reqData: GetTrainingCalendarDto) {
        const res = await this.post<GetTrainingCalendarResponseDto>(
            "calendar",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async getDayHistory(reqData: GetTrainingDayHistoryDto) {
        const res = await this.post<GetTrainingDayHistoryResponseDto>(
            "day",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async getMonthShare(reqData: GetTrainingMonthShareDto) {
        const res = await this.post<GetTrainingMonthShareResponseDto>(
            "month-share",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }
}

export const trainingHistoryService = new TrainingHistoryService(
    "/api/training-history",
);

