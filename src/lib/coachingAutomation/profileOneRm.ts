/**
 * 学员档案「运动数据卡」里的 1RM 与体重，转换成计划生成可用的 1RM 输入。
 *
 * 只按动作名精确匹配主项（深蹲 / 卧推 / 硬拉 / 负重引体 / 负重臂屈伸 / 负重双力臂 / 抓举 / 挺举）。
 * 暂停、窄握等变式不套用主项 1RM，避免把重量算重；这些动作交给计划助理私信询问学员。
 */

type CardLift = {
    group: "powerlifting" | "streetlifting" | "weightlifting";
    field: string;
    label: string;
    aliases: string[];
};

const CARD_LIFTS: CardLift[] = [
    { group: "powerlifting", field: "squat", label: "深蹲", aliases: ["深蹲", "杠铃深蹲", "杠铃背蹲", "背蹲", "颈后深蹲", "高杠深蹲", "低杠深蹲", "backsquat", "squat"] },
    { group: "streetlifting", field: "squat", label: "深蹲", aliases: ["深蹲", "杠铃深蹲", "杠铃背蹲", "背蹲", "颈后深蹲", "高杠深蹲", "低杠深蹲", "backsquat", "squat"] },
    { group: "powerlifting", field: "bench", label: "卧推", aliases: ["卧推", "杠铃卧推", "平板卧推", "平板杠铃卧推", "benchpress", "bench"] },
    { group: "powerlifting", field: "deadlift", label: "硬拉", aliases: ["硬拉", "杠铃硬拉", "传统硬拉", "deadlift"] },
    { group: "streetlifting", field: "weightedPullup", label: "负重引体", aliases: ["负重引体", "负重引体向上", "weightedpullup", "weightedpull-up"] },
    { group: "streetlifting", field: "weightedDip", label: "负重臂屈伸", aliases: ["负重臂屈伸", "负重双杠臂屈伸", "负重双杠", "weighteddip", "weighteddips"] },
    { group: "streetlifting", field: "weightedMuscleUp", label: "负重双力臂", aliases: ["负重双力臂", "weightedmuscleup", "weightedmuscle-up"] },
    { group: "weightlifting", field: "snatch", label: "抓举", aliases: ["抓举", "snatch"] },
    { group: "weightlifting", field: "cleanAndJerk", label: "挺举", aliases: ["挺举", "cleanandjerk", "clean&jerk"] },
];

const MIN_BODY_WEIGHT_KG = 30;
const MAX_BODY_WEIGHT_KG = 250;
const MAX_CARD_ONE_RM_KG = 500;

export type ProfileActionRef = {
    id: string;
    name?: string | null;
    canonical_action_id?: string | null;
};

export type ProfileLiftMatch = {
    actionId: string;
    actionName: string;
    label: string;
    oneRm: number;
};

export function normalizeLiftName(name: string | null | undefined): string {
    return String(name || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");
}

function positiveNumber(value: unknown, max: number): number | null {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) && num > 0 && num <= max ? num : null;
}

/** user_profiles.weight 优先；没填时用健美卡里的体重。 */
export function resolveProfileBodyWeight(profile: { weight?: unknown; sport_cards?: any } | null | undefined): number | null {
    const direct = positiveNumber(profile?.weight, MAX_BODY_WEIGHT_KG);
    if (direct !== null && direct >= MIN_BODY_WEIGHT_KG) return direct;
    const fromCard = positiveNumber(profile?.sport_cards?.bodybuilding?.weight, MAX_BODY_WEIGHT_KG);
    return fromCard !== null && fromCard >= MIN_BODY_WEIGHT_KG ? fromCard : null;
}

/** 动作名能对上的运动卡主项（同一主项出现在两张卡时取较大值）。 */
export function findCardLiftForAction(sportCards: any, actionName: string | null | undefined): { label: string; oneRm: number } | null {
    const key = normalizeLiftName(actionName);
    if (!key || !sportCards || typeof sportCards !== "object") return null;

    let best: { label: string; oneRm: number } | null = null;
    for (const lift of CARD_LIFTS) {
        if (!lift.aliases.includes(key)) continue;
        const value = positiveNumber(sportCards?.[lift.group]?.[lift.field], MAX_CARD_ONE_RM_KG);
        if (value === null) continue;
        if (!best || value > best.oneRm) best = { label: lift.label, oneRm: value };
    }
    return best;
}

export function matchProfileLifts(sportCards: any, actions: ProfileActionRef[]): ProfileLiftMatch[] {
    const matches: ProfileLiftMatch[] = [];
    for (const action of actions || []) {
        if (!action?.id) continue;
        const lift = findCardLiftForAction(sportCards, action.name);
        if (!lift) continue;
        matches.push({
            actionId: action.id,
            actionName: String(action.name || "").trim(),
            label: lift.label,
            oneRm: lift.oneRm,
        });
    }
    return matches;
}

/**
 * fillTemplate 的 1RM 查找键是 canonical id / 动作名 / 动作 id，这里三个键都写上。
 * 作为最低优先级兜底：PR 历史、动作库和购买问卷里的值都会覆盖它。
 */
export function buildProfileOneRmInputs(sportCards: any, actions: ProfileActionRef[]): Record<string, number> {
    const inputs: Record<string, number> = {};
    for (const action of actions || []) {
        const match = matchProfileLifts(sportCards, [action])[0];
        if (!match) continue;
        inputs[match.actionId] = match.oneRm;
        if (match.actionName) inputs[match.actionName] = match.oneRm;
        const canonicalId = String(action.canonical_action_id || "").trim();
        if (canonicalId) inputs[canonicalId] = match.oneRm;
    }
    return inputs;
}
