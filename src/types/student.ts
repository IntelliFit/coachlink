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
    type?: ItemType; // 项目类型（数据库迁移后默认为 STRENGTH）
    item_schema?: Record<string, unknown> | null; // 类型特定的默认配置
    suggested_time?: string | null; // 建议执行时间
    enableAutoWeightCompute?: boolean; // 是否启用自动重量计算
    includesBodyWeight?: boolean; // 动作是否包含自身体重
    canonical_action_id?: string | null; // 关联的公共动作ID
    created_at: string;
    updated_at: string;
}

export interface StudentActionInsert {
    name: string;
    detail?: string | null;
    positions?: string[] | null;
    attrs?: string[] | null;
    url?: string | null;
    type?: ItemType;
    item_schema?: Record<string, unknown> | null;
    suggested_time?: string | null;
    enableAutoWeightCompute?: boolean;
    includesBodyWeight?: boolean;
    canonical_action_id?: string | null;
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
