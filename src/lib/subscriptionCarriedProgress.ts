import { normalizeEntitlementConsumptionPolicy } from "@/lib/subscriptionEntitlement";

type CarriedProgressInstance = {
    id?: string | null;
    created_at?: string | null;
    status?: string | null;
    start_execution_day?: number | null;
    training_days?: any[] | null;
    entitlement_consumption_policy?: string | null;
};

type CarriedProgressExecution = {
    instance_id?: string | null;
    day_index?: number | string | null;
    status?: string | null;
};

const CHARGED_STATUSES = new Set(["active", "paused", "completed", "scheduled", "archived"]);

const dayIndexOf = (day: any) => Number(day?.dayIndex ?? day?.day_index ?? 0);

/**
 * Before 2026-08-20 a plan revision stayed chargeable while the next version
 * also counted the same days as carried progress (< start_execution_day), so
 * one workout could be charged two or three times. For each chargeable plan
 * version, return carried days that an earlier chargeable version of the same
 * subscription already completed for real.
 */
export function findDoubleChargedCarriedDays(params: {
    instances: CarriedProgressInstance[] | null | undefined;
    executions: CarriedProgressExecution[] | null | undefined;
}): Array<{ instanceId: string; dayIndexes: number[] }> {
    const charged = (params.instances || [])
        .filter((instance) =>
            CHARGED_STATUSES.has(String(instance?.status || "").toLowerCase()) &&
            normalizeEntitlementConsumptionPolicy(instance?.entitlement_consumption_policy) !== "no_charge" &&
            Array.isArray(instance?.training_days)
        )
        .sort((left, right) => String(left.created_at || "").localeCompare(String(right.created_at || "")));

    const completedDaysOf = (instanceId: string) => new Set(
        (params.executions || [])
            .filter((execution) => execution?.instance_id === instanceId && execution?.status === "completed")
            .map((execution) => Number(execution?.day_index || 0))
            .filter((dayIndex) => dayIndex > 0),
    );

    const findings: Array<{ instanceId: string; dayIndexes: number[] }> = [];
    // Days an earlier chargeable version already paid for: real completions
    // and its own carried (pre-start) days.
    const chargedInEarlierVersions = new Set<number>();
    for (const instance of charged) {
        const instanceId = String(instance.id || "");
        const ownCompleted = completedDaysOf(instanceId);
        const startExecutionDay = Math.max(1, Number(instance.start_execution_day || 1));
        const carried = (instance.training_days || [])
            .filter((day) => String(day?.type || "training").toLowerCase() !== "rest")
            .map(dayIndexOf)
            .filter((dayIndex) => dayIndex >= 1 && dayIndex < startExecutionDay && !ownCompleted.has(dayIndex));
        const doubleCharged = carried.filter((dayIndex) => chargedInEarlierVersions.has(dayIndex));
        if (doubleCharged.length > 0) {
            findings.push({ instanceId, dayIndexes: doubleCharged.sort((left, right) => left - right) });
        }
        ownCompleted.forEach((dayIndex) => chargedInEarlierVersions.add(dayIndex));
        carried.forEach((dayIndex) => chargedInEarlierVersions.add(dayIndex));
    }
    return findings;
}
