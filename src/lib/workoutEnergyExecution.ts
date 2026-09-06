import { estimateWorkoutEnergy, type WorkoutEnergyEstimate } from "@/lib/workoutEnergy";

export async function attachWorkoutEnergyEstimate(input: {
    db: any;
    userId: string;
    startedAt: string | null | undefined;
    completedAt: string;
    actionExecutions: any[];
}): Promise<{ actionExecutions: any[]; estimate: WorkoutEnergyEstimate | null }> {
    const actionExecutions = Array.isArray(input.actionExecutions)
        ? input.actionExecutions.map((action) => ({ ...action }))
        : [];
    const actionIds = Array.from(new Set(
        actionExecutions.map((action) => String(action?.action_id || "").trim()).filter(Boolean),
    ));

    const [profileResult, actionsResult] = await Promise.all([
        input.db
            .from("user_profiles")
            .select("weight")
            .eq("user_id", input.userId)
            .maybeSingle(),
        actionIds.length > 0
            ? input.db
                .from("student_actions")
                .select("id,name,type,attrs,item_schema,canonical_action_id")
                .eq("user_id", input.userId)
                .in("id", actionIds)
            : Promise.resolve({ data: [], error: null }),
    ]);
    if (profileResult.error) {
        console.warn("[workout-energy] load user weight failed:", profileResult.error);
    }
    if (actionsResult.error) {
        console.warn("[workout-energy] load action metadata failed:", actionsResult.error);
    }

    const rows = actionsResult.data || [];
    const canonicalIds = Array.from(new Set(rows.map((row: any) => row.canonical_action_id).filter(Boolean)));
    const canonicalMap = new Map<string, string | null>();
    if (canonicalIds.length > 0) {
        const { data, error } = await input.db
            .from("canonical_actions")
            .select("id,category")
            .in("id", canonicalIds);
        if (error) {
            console.warn("[workout-energy] load action categories failed:", error);
        } else {
            for (const row of data || []) canonicalMap.set(row.id, row.category ?? null);
        }
    }
    const actionMap = new Map(rows.map((row: any) => [String(row.id), row]));

    const eligible = actionExecutions.map((action, sourceIndex) => {
        const row = actionMap.get(String(action?.action_id || "")) as any;
        const type = String(action?.type || action?.item_type || row?.type || "STRENGTH").toUpperCase();
        if (type !== "STRENGTH" && type !== "CARDIO") return null;
        const sets = Array.isArray(action?.sets) ? action.sets : [];
        const completedSets = sets.filter((set: any) => set?.status === "completed");
        const actualDurationSeconds = completedSets.reduce(
            (sum: number, set: any) => sum + Math.max(0, Number(set?.actual_duration || 0)),
            0,
        );
        const actualDistanceMeters = completedSets.reduce(
            (sum: number, set: any) => sum + Math.max(0, Number(set?.actual_distance || 0)),
            0,
        );
        return {
            sourceIndex,
            action: {
                actionId: String(action?.action_id || "") || null,
                name: String(action?.action_name || row?.name || "动作"),
                type,
                attrs: Array.isArray(action?.attrs) ? action.attrs : row?.attrs || null,
                category: action?.category || (row?.canonical_action_id ? canonicalMap.get(row.canonical_action_id) : null) || null,
                itemSchema: action?.item_schema || row?.item_schema || null,
                completedSets: Math.max(Number(action?.completed_sets || 0), completedSets.length),
                actualDurationSeconds,
                actualDistanceMeters,
            },
        };
    }).filter((item): item is { sourceIndex: number; action: any } => (
        !!item && (item.action.completedSets > 0 || item.action.actualDurationSeconds > 0)
    ));

    const startedAt = input.startedAt ? new Date(input.startedAt).getTime() : NaN;
    const completedAt = new Date(input.completedAt).getTime();
    const elapsedMinutes = Number.isFinite(startedAt) && Number.isFinite(completedAt)
        ? Math.max(1 / 6, (completedAt - startedAt) / 60000)
        : 0;
    const estimate = await estimateWorkoutEnergy({
        bodyWeightKg: profileResult.data?.weight,
        elapsedMinutes,
        actions: eligible.map((item) => item.action),
    });

    if (!estimate) return { actionExecutions, estimate: null };
    const unusedEstimateIndexes = new Set(estimate.actions.map((_, index) => index));
    eligible.forEach((item) => {
        const actionEstimateIndex = estimate.actions.findIndex((candidate, index) => {
            if (!unusedEstimateIndexes.has(index)) return false;
            if (item.action.actionId && candidate.actionId) {
                return item.action.actionId === candidate.actionId;
            }
            return candidate.name === item.action.name && candidate.type === item.action.type;
        });
        if (actionEstimateIndex < 0) return;
        unusedEstimateIndexes.delete(actionEstimateIndex);
        const actionEstimate = estimate.actions[actionEstimateIndex];
        actionExecutions[item.sourceIndex] = {
            ...actionExecutions[item.sourceIndex],
            energy_estimate: actionEstimate,
        };
    });
    return { actionExecutions, estimate };
}
