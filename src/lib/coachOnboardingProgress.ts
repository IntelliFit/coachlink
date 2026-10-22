/**
 * 教练「开店」进度：审核通过后，教练要完成收款账户、套餐、问卷、计划模板四步才能真正接学员。
 * 运营后台用它找出卡在哪一步的教练，逐个回访。
 */

export type HuifuAccountState = "opened" | "reviewing" | "none";

export type CoachOnboardingStepKey =
    | "payment_account"
    | "pricing"
    | "questionnaire"
    | "plan_template";

export type CoachOnboardingStage = "setup" | "ready" | "serving";

export type CoachOnboardingStep = {
    key: CoachOnboardingStepKey;
    label: string;
    done: boolean;
};

export type CoachOnboardingInput = {
    huifuCardToken?: string | null;
    huifuId?: string | null;
    huifuApplyNo?: string | null;
    pricing?: { products?: unknown; pricings?: unknown } | null;
    questionnaireCount: number;
    templateCount: number;
    activeStudentCount: number;
};

export type CoachOnboardingProgress = {
    steps: CoachOnboardingStep[];
    completed: number;
    total: number;
    huifuAccount: HuifuAccountState;
    stage: CoachOnboardingStage;
};

export const COACH_ONBOARDING_STAGE_LABELS: Record<CoachOnboardingStage, string> = {
    setup: "开店中",
    ready: "可接单",
    serving: "带学员中",
};

export const HUIFU_ACCOUNT_STATE_LABELS: Record<HuifuAccountState, string> = {
    opened: "已开户",
    reviewing: "开户审核中",
    none: "未开户",
};

/** 只有拿到 token_no（huifu_card_token）才算开户完成；有 huifu_id / apply_no 说明已提交、还在审核。 */
export function resolveHuifuAccountState(input: Pick<CoachOnboardingInput, "huifuCardToken" | "huifuId" | "huifuApplyNo">): HuifuAccountState {
    if (hasText(input.huifuCardToken)) return "opened";
    if (hasText(input.huifuId) || hasText(input.huifuApplyNo)) return "reviewing";
    return "none";
}

/** 新版 products 或旧版 pricings 里至少有一个套餐。 */
export function hasCoachPackage(pricing: CoachOnboardingInput["pricing"]): boolean {
    if (!pricing) return false;
    return nonEmptyArray(pricing.products) || nonEmptyArray(pricing.pricings);
}

export function buildCoachOnboardingProgress(input: CoachOnboardingInput): CoachOnboardingProgress {
    const huifuAccount = resolveHuifuAccountState(input);
    const steps: CoachOnboardingStep[] = [
        { key: "payment_account", label: "收款账户", done: huifuAccount === "opened" },
        { key: "pricing", label: "套餐定价", done: hasCoachPackage(input.pricing) },
        { key: "questionnaire", label: "学员问卷", done: input.questionnaireCount > 0 },
        { key: "plan_template", label: "计划模板", done: input.templateCount > 0 },
    ];
    const completed = steps.filter((step) => step.done).length;
    const stage: CoachOnboardingStage = input.activeStudentCount > 0
        ? "serving"
        : completed === steps.length
            ? "ready"
            : "setup";

    return { steps, completed, total: steps.length, huifuAccount, stage };
}

function hasText(value: string | null | undefined): boolean {
    return typeof value === "string" && value.trim().length > 0;
}

function nonEmptyArray(value: unknown): boolean {
    return Array.isArray(value) && value.length > 0;
}
