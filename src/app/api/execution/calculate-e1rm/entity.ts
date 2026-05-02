// 请求参数的接口类型
export interface CalculateE1RMDto {
    weight: number; // 负重（不含自重）
    reps: number;
    bodyWeight?: number; // 自重（可选）
    includeBodyWeight?: boolean; // 是否将自重纳入计算
    actionName?: string; // 动作名称（用于自动判断是否需要自重）
}

// 返回参数的接口类型
export interface CalculateE1RMResponseDto {
    e1rm: number;
    epley: number;
    brzycki: number;
    formula: string;
    includesBodyWeight: boolean;
}
