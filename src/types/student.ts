// 学员动作库类型定义

// 项目类型：力量训练、饮食、有氧、习惯
export type ItemType = "STRENGTH" | "DIET" | "CARDIO" | "HABIT";

export interface StudentActionRow {
    id: string;
    user_id: string;
    name: string;
    detail: string | null;
    positions: string[] | null;
    attrs: string[] | null;
    url: string | null;
    type?: ItemType; // 项目类型，可选（迁移前默认为 STRENGTH）
    created_at: string;
    updated_at: string;
}

export interface StudentActionInsert {
    name: string;
    detail?: string | null;
    positions?: string[] | null;
    attrs?: string[] | null;
    url?: string | null;
    type?: ItemType; // 默认为 STRENGTH
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
