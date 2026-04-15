import type {
    CoachPlanAction,
    CoachPlanActionWithOneFilter,
    FormPlanTrainingDay,
} from "@/app/api/plan-lib/create-template/entity";

type ActionLookup = Record<string, string>;

interface ExportTemplateTextParams {
    description?: string | null;
    trainingDays: FormPlanTrainingDay[];
    actionNameById?: ActionLookup;
}

function readParam(params: Record<string, unknown> | undefined, ...keys: string[]) {
    if (!params) return null;
    for (const key of keys) {
        const value = params[key];
        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }
    return null;
}

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function formatIntensity(params: Record<string, unknown> | undefined): string | null {
    if (!params) return null;

    const intensityConfig = params.intensityConfig as
        | {
              relativeIntensity?: { type?: string; value?: number };
              fixedWeight?: { value?: number; unit?: string };
          }
        | null
        | undefined;

    const relative = intensityConfig?.relativeIntensity;
    if (relative?.type === "rm" && typeof relative.value === "number") {
        return `${relative.value}RM`;
    }
    if (relative?.type === "percentage" && typeof relative.value === "number") {
        return `${relative.value}%1RM`;
    }

    const fixedWeight = intensityConfig?.fixedWeight;
    if (
        typeof fixedWeight?.value === "number" &&
        Number.isFinite(fixedWeight.value)
    ) {
        return `${fixedWeight.value}${fixedWeight.unit || "kg"}`;
    }

    const load = toFiniteNumber(readParam(params, "load"));
    if (load !== null) return `${load}kg`;

    const strength = readParam(params, "强度", "intensity");
    if (strength === null) return null;
    if (typeof strength === "number" && Number.isFinite(strength)) {
        return `${strength}RM`;
    }
    if (typeof strength === "string" && strength.trim()) {
        return strength.trim();
    }

    return null;
}

function formatNoFilterAction(
    actionSet: CoachPlanAction,
    actionNameById: ActionLookup,
    prefix = "",
): string {
    const params = (actionSet.params || {}) as Record<string, unknown>;
    const name = actionNameById[actionSet.actionId] || actionSet.actionId || "未命名动作";
    const segments = [prefix ? `${prefix}${name}` : name];

    const sets = toFiniteNumber(readParam(params, "组数", "sets"));
    const reps = toFiniteNumber(readParam(params, "次数", "reps"));
    const durationSeconds = toFiniteNumber(
        readParam(params, "持续时间", "durationSeconds"),
    );
    const restSeconds = toFiniteNumber(
        readParam(params, "休息时间", "restSeconds"),
    );
    const intensity = formatIntensity(params);
    const note = readParam(params, "note", "备注");

    if (sets !== null) segments.push(`${sets}组`);
    if (reps !== null) segments.push(`${reps}次`);
    if (durationSeconds !== null) segments.push(`${durationSeconds}秒`);
    if (intensity) segments.push(intensity);
    if (restSeconds !== null) segments.push(`休息${restSeconds}秒`);
    if (typeof note === "string" && note.trim()) {
        segments.push(`备注：${note.trim()}`);
    }

    return segments.join(" ");
}

function formatActionSet(
    actionSet: CoachPlanAction | CoachPlanActionWithOneFilter,
    actionNameById: ActionLookup,
): string[] {
    if (actionSet.type === "no-filter") {
        return [formatNoFilterAction(actionSet, actionNameById)];
    }

    const lines = [`条件分支：${actionSet.question?.question || "未命名问题"}`];
    const options = Array.isArray(actionSet.question?.options)
        ? actionSet.question.options
        : [];
    const branchActions = Array.isArray((actionSet as any).actions)
        ? ((actionSet as any).actions as CoachPlanAction[])
        : [];

    branchActions.forEach((branchAction, index) => {
        const optionLabel =
            typeof options[index] === "string" && options[index].trim()
                ? options[index].trim()
                : `选项${index + 1}`;
        lines.push(
            formatNoFilterAction(branchAction, actionNameById, `如果「${optionLabel}」：`),
        );
    });

    return lines;
}

export function formatTemplateToText({
    description,
    trainingDays,
    actionNameById = {},
}: ExportTemplateTextParams): string {
    const sortedDays = [...(trainingDays || [])].sort(
        (a, b) => (a.dayIndex || 0) - (b.dayIndex || 0),
    );
    const totalWeeks = Math.max(
        1,
        Math.ceil((sortedDays[sortedDays.length - 1]?.dayIndex || 0) / 7),
    );

    const lines: string[] = [];

    if (description?.trim()) {
        lines.push(description.trim(), "");
    }

    for (let weekIndex = 1; weekIndex <= totalWeeks; weekIndex++) {
        lines.push(`第${weekIndex}周`);
        const weekDays = sortedDays.filter(
            (day) => Math.ceil((day.dayIndex || 0) / 7) === weekIndex,
        );

        for (const day of weekDays) {
            const dayOfWeek = ((day.dayIndex || 1) - 1) % 7 + 1;
            lines.push(`W${weekIndex}D${dayOfWeek}`);

            if (day.type === "rest") {
                lines.push("休息日");
                if (day.note?.trim() && day.note.trim() !== "休息日") {
                    lines.push(`日备注：${day.note.trim()}`);
                }
                lines.push("");
                continue;
            }

            if (day.note?.trim()) {
                lines.push(`日备注：${day.note.trim()}`);
            }

            const actionSets = Array.isArray(day.actionSets) ? day.actionSets : [];
            for (const actionSet of actionSets) {
                for (const line of formatActionSet(actionSet as any, actionNameById)) {
                    lines.push(line);
                }
            }

            lines.push("");
        }
    }

    return lines.join("\n").trim();
}

export function buildTemplateExportFilename(templateName: string): string {
    const base = (templateName || "训练计划").trim() || "训练计划";
    const safe = base.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "_");
    return `${safe}.txt`;
}
