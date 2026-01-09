import {
    GetE1RMHistoryDto,
    GetE1RMHistoryResponseDto,
} from "../api/student/get-e1rm-history/route";
import {
    GetCurrent1RMDto,
    GetCurrent1RMResponseDto,
} from "../api/student/get-current-1rm/route";

class E1RMService {
    /**
     * 获取 e1RM 历史数据
     */
    async getHistory(
        dto: GetE1RMHistoryDto,
    ): Promise<GetE1RMHistoryResponseDto | null> {
        try {
            const response = await fetch("/api/student/get-e1rm-history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dto),
            });

            const result = await response.json();
            if (result.success) {
                return result.data;
            }
            return null;
        } catch (error) {
            console.error("Failed to fetch e1RM history:", error);
            return null;
        }
    }

    /**
     * 获取当前 1RM 数据
     */
    async getCurrent(
        dto: GetCurrent1RMDto,
    ): Promise<GetCurrent1RMResponseDto | null> {
        try {
            const response = await fetch("/api/student/get-current-1rm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dto),
            });

            const result = await response.json();
            if (result.success) {
                return result.data;
            }
            return null;
        } catch (error) {
            console.error("Failed to fetch current 1RM:", error);
            return null;
        }
    }
}

export const e1rmService = new E1RMService();
