import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";

export interface PublicTrainingPlanTemplate {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    sport: string;
    goal: string;
    level: "beginner" | "intermediate" | "advanced";
    weeks: number;
    days_per_week: number;
    equipment: string[];
    tags: string[];
    suitable_for: string;
    audience: string | null;
    notes: string[];
    training_days: any[];
    template_kind: "fixed" | "parameterized";
    parameter_schema: Record<string, any>;
    action_slots: any[];
    sort_order: number;
}

export function normalizeBaseTrainingDays(value: unknown): any[] {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

export function expandTrainingDays(baseDays: any[], weeks: number) {
    const normalizedBaseDays = normalizeBaseTrainingDays(baseDays);
    const safeWeeks = Math.max(1, Number(weeks || 1));
    const expanded: any[] = [];

    for (let weekIndex = 0; weekIndex < safeWeeks; weekIndex += 1) {
        normalizedBaseDays.forEach((day, dayOffset) => {
            const dayIndex = weekIndex * 7 + dayOffset + 1;
            const actionSets = Array.isArray(day?.actionSets)
                ? day.actionSets
                : Array.isArray(day?.action_sets)
                    ? day.action_sets
                    : [];
            expanded.push({
                ...day,
                dayIndex,
                type: String(day?.type || "training") === "rest" ? "rest" : "training",
                note: weekIndex === 0
                    ? String(day?.note || "")
                    : `第 ${weekIndex + 1} 周 · ${String(day?.note || "")}`,
                actionSets,
                actionSetsCount: actionSets.length,
            });
        });
    }

    return expanded;
}

export function toTrainingPlanListItem(template: PublicTrainingPlanTemplate) {
    return {
        id: template.id,
        slug: template.slug,
        name: template.name,
        description: template.description,
        sport: template.sport,
        goal: template.goal,
        level: template.level,
        weeks: template.weeks,
        daysPerWeek: template.days_per_week,
        equipment: template.equipment || [],
        tags: template.tags || [],
        suitableFor: template.suitable_for,
        audience: template.audience,
        notes: template.notes || [],
        templateKind: template.template_kind,
        parameterSchema: template.parameter_schema || {},
        actionSlots: template.action_slots || [],
        trainingDayCount: Math.max(1, Number(template.weeks || 1)) *
            normalizeBaseTrainingDays(template.training_days).filter((day: any) =>
                String(day?.type || "training") !== "rest"
            ).length,
        sortOrder: template.sort_order,
    };
}

export function toTrainingPlanDetail(template: PublicTrainingPlanTemplate) {
    return {
        ...toTrainingPlanListItem(template),
        trainingDays: expandTrainingDays(template.training_days, template.weeks),
    };
}

export async function getPublishedTrainingPlanByIdOrSlug(idOrSlug: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(idOrSlug);

    let query = supabase
        .from("public_training_plan_templates")
        .select("*")
        .eq("status", "published")
        .limit(1);

    query = isUuid ? query.eq("id", idOrSlug) : query.eq("slug", idOrSlug);

    const { data, error } = await query.maybeSingle();
    if (error) {
        throw error;
    }
    return (data as PublicTrainingPlanTemplate | null) || null;
}
