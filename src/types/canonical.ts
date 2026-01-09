// 公共动作库类型定义

export interface CanonicalAction {
    id: string; // 如 "squat_low_bar"
    name: string; // 如 "低杠深蹲"
    aliases: string[]; // 别名数组
    category: string | null; // 分类：下肢、推、拉、核心
    created_at: string;
}

export interface CanonicalActionInsert {
    id: string;
    name: string;
    aliases?: string[];
    category?: string | null;
}
