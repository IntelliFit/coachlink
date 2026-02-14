export interface BootstrapStudentActionsFromProfileDto {
    /**
     * 最少保留动作数。若当前动作库已达到该数量，则不再导入。
     */
    minActions?: number;
    /**
     * 每次最多导入动作数。
     */
    importLimit?: number;
}

export interface BootstrapWorkoutDraftItemDto {
    actionId: string;
    actionName: string;
    itemType: "STRENGTH" | "CARDIO" | "DIET" | "HABIT";
    /**
     * 动态参数：由 AI 按动作类型与动作属性给出
     * 例如：
     * - STRENGTH: { 组数, 次数/持续时间, 休息时间, load, 强度 }
     * - CARDIO: { 距离, 持续时间, 配速 }
     * - DIET: { 食物清单, 热量 }
     * - HABIT: { 目标数值, 完成状态/目标时长 }
     */
    params: Record<string, unknown>;
    note?: string | null;
}

export interface BootstrapStudentActionsFromProfileResponseDto {
    existingCount: number;
    importedCount: number;
    totalCount: number;
    recommendedActionIds: string[];
    workoutDraft: BootstrapWorkoutDraftItemDto[];
    skipped: boolean;
}


