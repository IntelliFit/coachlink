export interface QuestionMedia {
    id: string; // 稳定ID，便于编辑/删除
    type: "image" | "video";
    url: string; // 媒体 URL（通常来自 Supabase Storage 的 publicUrl 或签名URL）
    caption?: string;
    thumbnail?: string; // 视频缩略图（可选）
    storage_bucket?: string;
    storage_path?: string;
}

export interface QuestionBranching {
    /**
     * 选项 index -> 下一个问题 ID
     * - 未配置（undefined）：按问卷顺序进入下一个问题
     * - string：跳转到指定问题 id
     * - null：结束问卷
     */
    rules?: Record<number, string | null>;
    /**
     * 默认跳转（当 rules 未命中时）
     * - undefined：按顺序进入下一个问题
     * - string：跳转到指定问题 id
     * - null：结束问卷
     */
    defaultNext?: string | null;
}

interface BaseQuestion {
    /**
     * 问题稳定 ID（用于分支跳转/历史答案匹配）
     * 旧数据可能没有该字段；后端会自动补齐并持久化。
     */
    id?: string;
    /**
     * 可选：问题附加媒体（图片/视频示例）
     */
    media?: QuestionMedia[];
    /**
     * 可选：显式下一题（用于真正树状/流程图问卷）
     * - undefined：按“顺序下一题”（旧行为，兼容老数据）
     * - string：跳转到指定问题 id
     * - null：结束问卷
     */
    next?: string | null;
}

export interface TrainingTagsQuestion extends BaseQuestion {
    type: "tags";
    /**
     * Coach-configured options for this question.
     * This decouples questionnaire from plan templates (templates can be deleted).
     */
    options?: string[];
    userSelections?: string[];
}

export interface TrainingTimesQuestion extends BaseQuestion {
    type: "times";
    // 允许教练自定义题干（不填则使用默认文案）
    question?: string;
    // 允许教练配置可选项（例如 [3,4,5]）；不填则默认 1~7
    options?: number[];
    userSelection?: number;
    // 允许对 times 题做分支（可选）
    branching?: QuestionBranching;
}

export interface TrainingRmQuestion extends BaseQuestion {
    type: "rm";
    /**
     * Coach-selected action ids for RM input.
     * If omitted or empty, the student RM section will show empty / not required.
     */
    actionIds?: string[];
    userInputs?: Record<string, number>;
}

export interface TrainingOptionQuestion extends BaseQuestion {
    type: "option";
    question: string;
    options: string[];
    scope?: "global" | "action"; // 区分问题类型：global=全局匹配，action=动作选择，默认action
    userSelection?: number;
    // 条件分支逻辑（树状问卷）
    branching?: QuestionBranching;
}

export interface TrainingTextQuestion extends BaseQuestion {
    type: "text";
    question: string;
    userSelection?: string;
}

export type QuestionType = "tags" | "times" | "option" | "text" | "rm";

export type TrainingItem =
    | TrainingTagsQuestion
    | TrainingTimesQuestion
    | TrainingOptionQuestion
    | TrainingTextQuestion
    | TrainingRmQuestion;
