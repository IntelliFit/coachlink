// 学员动作库类型定义
export interface StudentActionRow {
    id: string;
    user_id: string;
    name: string;
    detail: string | null;
    positions: string[] | null;
    attrs: string[] | null;
    url: string | null;
    created_at: string;
    updated_at: string;
}

export interface StudentActionInsert {
    name: string;
    detail?: string | null;
    positions?: string[] | null;
    attrs?: string[] | null;
    url?: string | null;
}

// 学员常用计划类型定义
export interface StudentPlanFavoriteRow {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    training_days: any; // JSONB
    created_at: string;
    updated_at: string;
}

export interface StudentPlanFavoriteInsert {
    name: string;
    description?: string | null;
    training_days: any;
}
