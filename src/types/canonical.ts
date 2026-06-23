export type CanonicalActionAuditStatus = "unreviewed" | "rejected" | "approved";

// 公共动作库类型定义

export interface CanonicalAction {
    id: string; // 如 "squat_low_bar"
    name: string; // 如 "低杠深蹲"
    aliases: string[]; // 别名数组
    category: string | null; // 分类：下肢、推、拉、核心
    reference_animation_url: string | null; // 标准动作缩略演示动画 URL
    reference_animation_audit_status: CanonicalActionAuditStatus; // 标准动作缩略演示动画审核状态
    reference_gif_url: string | null; // 标准动作参考动图 URL
    reference_image_url: string | null; // 标准动作参考图 URL
    reference_image_audit_status: CanonicalActionAuditStatus; // 标准动作参考图审核状态
    created_at: string;
}

export interface CanonicalActionInsert {
    id: string;
    name: string;
    aliases?: string[];
    category?: string | null;
    reference_animation_url?: string | null;
    reference_animation_audit_status?: CanonicalActionAuditStatus;
    reference_gif_url?: string | null;
    reference_image_url?: string | null;
    reference_image_audit_status?: CanonicalActionAuditStatus;
}
