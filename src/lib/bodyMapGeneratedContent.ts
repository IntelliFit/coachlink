export type BodyMapMode = "screening" | "training";

export interface GeneratedBodyMapContentItem {
    id: string;
    title: string;
    description: string;
    difficulty: number;
    is_free: boolean;
}

const SCREENING_TOPICS = [
    "常见不适识别",
    "诱发原因排查",
    "居家自测步骤",
    "训练前后注意事项",
    "需要就医的警示信号",
];

const TRAINING_TOPICS = [
    "激活训练建议",
    "基础强化动作",
    "稳定性提升重点",
    "动作代偿提醒",
    "恢复与放松建议",
];

function seededNumber(seed: string, offset: number, mod: number) {
    let value = 0;
    const text = `${seed}:${offset}`;
    for (let i = 0; i < text.length; i += 1) {
        value = (value * 31 + text.charCodeAt(i)) % 2147483647;
    }
    return value % mod;
}

export function buildGeneratedBodyMapContent(params: {
    mode: BodyMapMode;
    anatomyKey: string;
    anatomyLabel: string;
    regionLabel: string;
}): GeneratedBodyMapContentItem[] {
    const { mode, anatomyKey, anatomyLabel, regionLabel } = params;
    const topics = mode === "screening" ? SCREENING_TOPICS : TRAINING_TOPICS;

    return topics.slice(0, 3).map((topic, index) => {
        const difficulty = seededNumber(anatomyKey, index + 1, 3) + 1;
        const prefix = mode === "screening" ? "筛查" : "训练";
        const detail =
            mode === "screening"
                ? `围绕 ${anatomyLabel} 的常见紧张、疼痛和活动受限场景，给出简短判断思路、易忽略诱因以及下一步处理建议。`
                : `围绕 ${anatomyLabel} 的激活、稳定和强化目标，提供入门动作、执行要点以及常见代偿提醒。`;

        return {
            id: `generated:${mode}:${anatomyKey}:${index}`,
            title: `${anatomyLabel}${prefix}${topic}`,
            description: `${detail} 当前归属部位为 ${regionLabel}，这是一条自动生成的占位内容，可后续替换为正式知识库条目。`,
            difficulty,
            is_free: true,
        };
    });
}
