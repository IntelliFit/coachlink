/**
 * 计划项目类型定义 (Polymorphic Plan Item)
 * 支持力量训练、饮食、有氧、习惯等多种类型
 */

import { IntensityConfig } from "./intensity";

// 项目类型
export type { ItemType } from "./student";

/**
 * 饮食/有氧/习惯等非力量类型的自定义数据
 */
export interface PlanItemCustomData {
    // DIET 类型
    content?: string; // 食谱内容描述
    calories?: number; // 卡路里
    image_url?: string; // 食谱图片

    // CARDIO 类型
    distance?: number; // 距离 (米)
    duration?: number; // 时长 (秒)
    pace?: string; // 配速

    // HABIT 类型
    target_duration?: number; // 目标时长 (分钟)
}

/**
 * 计划中的单个项目 (用于 training_days.action_sets)
 * 支持多态：力量/饮食/有氧/习惯
 */
export interface PlanItem {
    // --- 通用字段 ---
    action_id: string; // 关联 coach_actions/student_actions
    action_name?: string; // 动作名称 (冗余，方便显示)
    group_title?: string; // 逻辑分组标题 (如 "早餐", "热身")
    note?: string; // 备注

    // --- 力量类型 (STRENGTH) ---
    sets?: number;
    reps?: number;
    weight?: number;
    rest_seconds?: number;
    intensityConfig?: IntensityConfig;

    // --- 非力量类型通用容器 ---
    custom_data?: PlanItemCustomData;
}

/**
 * 执行记录中的项目执行数据
 * 存储在 plan_instance_executions.action_executions
 */
export interface PlanItemExecution {
    action_id: string;

    // STRENGTH 执行数据
    sets?: Array<{
        set_index: number;
        executed_reps?: number;
        executed_weight?: number;
        is_completed?: boolean;
    }>;

    // DIET/HABIT 执行数据
    completed?: boolean;
    photo_url?: string;
    notes?: string;

    // CARDIO 执行数据
    actual_distance?: number;
    actual_duration?: number;
}
