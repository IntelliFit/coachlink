import { studentService } from "./studentService";
import type {
    GetE1RMHistoryDto,
    GetE1RMHistoryResponseDto,
} from "../api/student/get-e1rm-history/entity";

class E1RMService {
    /**
     * Get e1RM history for a specific action
     */
    async getHistory(
        params: GetE1RMHistoryDto,
    ): Promise<GetE1RMHistoryResponseDto | null> {
        return studentService.getE1RMHistory(params);
    }
}

export const e1rmService = new E1RMService();
