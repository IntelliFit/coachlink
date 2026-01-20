// 批量创建学员动作的请求参数
export interface BatchCreateStudentActionsDto {
    actions: {
        name: string;
        needsAutoCompute?: boolean;
        includesBodyWeight?: boolean;
        attrs?: string[];
        positions?: string[];
        detail?: string;
        url?: string;
    }[];
}

// 批量创建学员动作的响应
export interface BatchCreateStudentActionsResponseDto {
    createdActions: any[];
}
