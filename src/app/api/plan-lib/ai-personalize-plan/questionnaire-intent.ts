type FocusDomain = "pullup" | "dip";

export interface QuestionnaireIntent {
    preferredDomains: FocusDomain[];
    exclusiveFocusDomain: FocusDomain | null;
    weeklyTrainingDays: number | null;
    summaryLines: string[];
    hardRules: string[];
}

export function extractQuestionnaireIntent(questionnaireAnswers: any[]): QuestionnaireIntent {
    const preferredDomains = new Set<FocusDomain>();
    let explicitExclusiveDomain: FocusDomain | null = null;
    let sawBalancedPreference = false;
    let weeklyTrainingDays: number | null = null;
    const summaryLines: string[] = [];

    for (const item of questionnaireAnswers || []) {
        const weeklyTimes = extractWeeklyTrainingDaysFromQuestion(item);
        if (weeklyTimes !== null) {
            weeklyTrainingDays = weeklyTimes;
            summaryLines.push(`学员期望每周训练 ${weeklyTimes} 次。`);
        }

        const values = resolveQuestionValues(item);
        if (values.length === 0) continue;

        const joined = values.join(" / ");
        const domains = detectDomainsFromValues(values);
        const isPreference = isPreferenceQuestion(item, values);
        const isExclusive = isExclusiveExpression(values);

        if (isPreference) {
            if (domains.length > 0) {
                domains.forEach((domain) => preferredDomains.add(domain));
                summaryLines.push(`学员专项偏好：${joined}。`);
            } else if (isBalancedExpression(values)) {
                sawBalancedPreference = true;
                summaryLines.push(`学员专项偏好：${joined}。`);
            }
        }

        if (isPreference && isExclusive && domains.length === 1) {
            explicitExclusiveDomain = domains[0];
        }
    }

    const normalizedPreferredDomains = Array.from(preferredDomains);
    let exclusiveFocusDomain = explicitExclusiveDomain;

    if (!exclusiveFocusDomain && !sawBalancedPreference && normalizedPreferredDomains.length === 1) {
        exclusiveFocusDomain = normalizedPreferredDomains[0];
    }

    const hardRules = buildHardRules({
        exclusiveFocusDomain,
        weeklyTrainingDays,
    });

    if (exclusiveFocusDomain && !summaryLines.some((line) => line.includes("硬约束"))) {
        summaryLines.push(`硬约束：本次计划必须围绕${focusLabel(exclusiveFocusDomain)}专项，不要保留${oppositeFocusLabel(exclusiveFocusDomain)}专项主项。`);
    }
    if (weeklyTrainingDays) {
        summaryLines.push(`硬约束：每周必须严格安排 ${weeklyTrainingDays} 个训练日，其余补足为休息日。`);
    }

    return {
        preferredDomains: normalizedPreferredDomains,
        exclusiveFocusDomain,
        weeklyTrainingDays,
        summaryLines,
        hardRules,
    };
}

export function buildQuestionnaireIntentSection(intent: QuestionnaireIntent): string {
    if (intent.summaryLines.length === 0 && intent.hardRules.length === 0) {
        return "未识别到需要额外强调的专项偏好。";
    }

    const lines: string[] = [];
    if (intent.summaryLines.length > 0) {
        lines.push(...intent.summaryLines.map((line) => `- ${line}`));
    }
    if (intent.hardRules.length > 0) {
        lines.push(...intent.hardRules.map((rule) => `- ${rule}`));
    }

    return lines.join("\n");
}

export function validateTrainingDaysAgainstIntent(params: {
    trainingDays: any[];
    actionNameById: Record<string, string>;
    intent: QuestionnaireIntent;
}): string[] {
    const { trainingDays, actionNameById, intent } = params;
    if (!intent.exclusiveFocusDomain && !intent.weeklyTrainingDays) return [];

    const violations: string[] = [];
    if (intent.exclusiveFocusDomain) {
        const actionNames = collectTrainingActionNames(trainingDays, actionNameById);
        const conflictingDomain = oppositeFocusDomain(intent.exclusiveFocusDomain);
        const conflictingActions = unique(
            actionNames.filter((name) => detectDomainFromText(name) === conflictingDomain),
        );
        const targetActions = unique(
            actionNames.filter((name) => detectDomainFromText(name) === intent.exclusiveFocusDomain),
        );

        if (conflictingActions.length > 0) {
            violations.push(
                `问卷明确优先${focusLabel(intent.exclusiveFocusDomain)}，但计划仍包含${focusLabel(conflictingDomain)}动作：${conflictingActions.join("、")}`,
            );
        }
        if (targetActions.length === 0) {
            violations.push(
                `问卷明确优先${focusLabel(intent.exclusiveFocusDomain)}，但计划里没有任何${focusLabel(intent.exclusiveFocusDomain)}专项动作`,
            );
        }
    }

    if (intent.weeklyTrainingDays) {
        const weeklyCounts = countTrainingDaysByWeek(trainingDays);
        for (const [week, count] of weeklyCounts.entries()) {
            if (count !== intent.weeklyTrainingDays) {
                violations.push(
                    `问卷明确每周训练 ${intent.weeklyTrainingDays} 次，但 W${week} 实际安排了 ${count} 个训练日`,
                );
            }
        }
    }

    return violations;
}

export function inferFocusDomainsFromTemplate(template: {
    name?: string | null;
    description?: string | null;
    training_days?: any[] | null;
}): FocusDomain[] {
    const domains = new Set<FocusDomain>();
    const text = [template?.name, template?.description]
        .filter(Boolean)
        .join("\n");

    detectDomainsFromValues([text]).forEach((domain) => domains.add(domain));

    for (const day of template?.training_days || []) {
        for (const actionSet of day?.actionSets || []) {
            const actionName = String(
                actionSet?.setName ||
                actionSet?.params?.action_name ||
                "",
            ).trim();
            const domain = detectDomainFromText(actionName);
            if (domain) domains.add(domain);
        }
    }

    return Array.from(domains);
}

function resolveQuestionValues(item: any): string[] {
    if (!item) return [];

    if (item.type === "tags") {
        return ensureStringArray(item.userSelections);
    }

    if (item.type === "option") {
        const options = ensureStringArray(item.options);
        if (typeof item.userSelection === "number" && Number.isInteger(item.userSelection)) {
            const selected = options[item.userSelection];
            return selected ? [selected] : [];
        }
        if (typeof item.userSelection === "string" && item.userSelection.trim()) {
            return [item.userSelection.trim()];
        }
        return [];
    }

    if (item.type === "text") {
        if (typeof item.userSelection === "string" && item.userSelection.trim()) {
            return [item.userSelection.trim()];
        }
        return [];
    }

    return [];
}

function extractWeeklyTrainingDaysFromQuestion(item: any): number | null {
    if (!item) return null;

    if (item?.type === "times") {
        const times = Number(item?.userSelection);
        return Number.isFinite(times) && times > 0 ? times : null;
    }

    const questionText = String(item?.question || "").trim();
    if (!/每周训练次数|每周训练天数|每周几练/.test(questionText)) {
        return null;
    }

    const values = resolveQuestionValues(item);
    for (const value of values) {
        const match = String(value).match(/(\d+)/);
        if (match) {
            const times = Number(match[1]);
            if (Number.isFinite(times) && times > 0) {
                return times;
            }
        }
    }

    return null;
}

function ensureStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => String(item || "").trim())
        .filter(Boolean);
}

function isPreferenceQuestion(item: any, values: string[]): boolean {
    if (item?.type === "tags") return true;

    const questionText = String(item?.question || "").trim();
    if (item?.type === "option") {
        return /偏好|优先|训练项目|更想提升|主攻|专项/.test(questionText) || values.some(isPreferenceValue);
    }

    if (item?.type === "text") {
        return values.some((value) => /只练|只想练|只想提高|优先|主攻|专项|想练/.test(value));
    }

    return false;
}

function isPreferenceValue(value: string): boolean {
    return /引体|臂屈伸|平衡发展|组合/.test(value);
}

function isExclusiveExpression(values: string[]): boolean {
    return values.some((value) => /只练|只想练|只做|只想提高|优先/.test(value));
}

function isBalancedExpression(values: string[]): boolean {
    return values.some((value) => /平衡发展|组合|都练|一起练|综合/.test(value));
}

function detectDomainsFromValues(values: string[]): FocusDomain[] {
    const domains = new Set<FocusDomain>();
    for (const value of values) {
        const domain = detectDomainFromText(value);
        if (domain) domains.add(domain);
        if (/平衡发展|组合|都练|一起练|综合/.test(value)) {
            domains.add("pullup");
            domains.add("dip");
        }
    }
    return Array.from(domains);
}

function detectDomainFromText(value: string): FocusDomain | null {
    const text = String(value || "");
    if (/臂屈伸|双杠臂屈伸|dips?/i.test(text)) {
        return "dip";
    }
    if (/引体|pull[\s-]?up/i.test(text)) {
        return "pullup";
    }
    return null;
}

function buildHardRules(params: {
    exclusiveFocusDomain: FocusDomain | null;
    weeklyTrainingDays: number | null;
}): string[] {
    const { exclusiveFocusDomain, weeklyTrainingDays } = params;
    const rules: string[] = [];

    if (exclusiveFocusDomain) {
        rules.push(
            `把“优先${focusLabel(exclusiveFocusDomain)}”视为硬约束，不要输出${focusLabel(oppositeFocusDomain(exclusiveFocusDomain))}专项主项。`,
            `如果借用了组合模板或历史骨架，必须删掉与${focusLabel(exclusiveFocusDomain)}无关的对立专项主项，只保留服务于${focusLabel(exclusiveFocusDomain)}的结构。`,
        );
    }
    if (weeklyTrainingDays) {
        rules.push(`把“每周训练 ${weeklyTrainingDays} 次”视为硬约束。每个 W 周块必须恰好有 ${weeklyTrainingDays} 个训练日，不能多也不能少。`);
    }

    return rules;
}

function collectTrainingActionNames(trainingDays: any[], actionNameById: Record<string, string>): string[] {
    const names: string[] = [];

    for (const day of trainingDays || []) {
        if (day?.type !== "training") continue;
        for (const actionSet of day?.actionSets || []) {
            const actionId = String(actionSet?.actionId || "").trim();
            const actionName = String(
                actionSet?.setName ||
                actionNameById[actionId] ||
                actionSet?.params?.action_name ||
                "",
            ).trim();
            if (actionName) names.push(actionName);
        }
    }

    return names;
}

function unique(values: string[]): string[] {
    return Array.from(new Set(values));
}

function countTrainingDaysByWeek(trainingDays: any[]): Map<number, number> {
    const counts = new Map<number, number>();

    for (const day of trainingDays || []) {
        const dayIndex = Number(day?.dayIndex || 0);
        if (!Number.isFinite(dayIndex) || dayIndex <= 0) continue;
        const week = Math.ceil(dayIndex / 7);
        const current = counts.get(week) || 0;
        if (day?.type === "training") {
            counts.set(week, current + 1);
        } else if (!counts.has(week)) {
            counts.set(week, current);
        }
    }

    return counts;
}

function focusLabel(domain: FocusDomain): string {
    return domain === "dip" ? "臂屈伸" : "引体";
}

function oppositeFocusDomain(domain: FocusDomain): FocusDomain {
    return domain === "dip" ? "pullup" : "dip";
}

function oppositeFocusLabel(domain: FocusDomain): string {
    return focusLabel(oppositeFocusDomain(domain));
}
