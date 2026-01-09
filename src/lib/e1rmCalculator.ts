/**
 * e1RM Calculation Utility
 *
 * Uses the average of three classic formulas (Epley, Brzycki, Lombardi)
 * for more accurate one-rep max estimation.
 *
 * Supports body weight inclusion for exercises like Pull-ups and Dips.
 */

export interface E1RMResult {
    e1rm: number;
    epley: number;
    brzycki: number;
    lombardi: number;
}

export interface E1RMCalculationParams {
    weight: number; // External weight (不含自重)
    reps: number;
    bodyWeight?: number; // 自重（可选）
    includeBodyWeight?: boolean; // 是否将自重纳入计算
}

/**
 * Calculate estimated 1RM using the 3-formula average method
 *
 * Formulas:
 * - Epley: weight × (1 + 0.0333 × reps)
 * - Brzycki: weight × (36 / (37 - reps))
 * - Lombardi: weight × reps^0.1
 *
 * With body weight (for Pull-ups, Dips):
 * - Epley: ((bw + weight) × (1 + 0.0333 × reps)) - bw
 * - Brzycki: ((bw + weight) × (36 / (37 - reps))) - bw
 * - Lombardi: ((bw + weight) × reps^0.1) - bw
 *
 * @param params Calculation parameters
 * @returns e1RM result with individual formula values
 */
export function calculateE1RM(params: E1RMCalculationParams): E1RMResult {
    const { weight, reps, bodyWeight = 0, includeBodyWeight = false } = params;

    // Edge case: if reps = 1, e1RM = weight
    if (reps === 1) {
        return {
            e1rm: weight,
            epley: weight,
            brzycki: weight,
            lombardi: weight,
        };
    }

    // Edge case: if reps <= 0 or weight <= 0, return 0
    if (reps <= 0 || weight <= 0) {
        return { e1rm: 0, epley: 0, brzycki: 0, lombardi: 0 };
    }

    // Prevent Brzycki formula division by zero (reps >= 37)
    const safeReps = Math.min(reps, 36);

    let epley: number;
    let brzycki: number;
    let lombardi: number;

    if (includeBodyWeight && bodyWeight > 0) {
        // Include body weight in calculation (for Pull-ups, Dips)
        const totalWeight = weight + bodyWeight;
        epley = (totalWeight * (1 + 0.0333 * safeReps)) - bodyWeight;
        brzycki = (totalWeight * (36 / (37 - safeReps))) - bodyWeight;
        lombardi = (totalWeight * Math.pow(safeReps, 0.1)) - bodyWeight;
    } else {
        // Standard calculation (without body weight)
        epley = weight * (1 + 0.0333 * safeReps);
        brzycki = weight * (36 / (37 - safeReps));
        lombardi = weight * Math.pow(safeReps, 0.1);
    }

    // Average of three formulas
    const e1rm = (epley + brzycki + lombardi) / 3;

    // Round to 1 decimal place
    return {
        e1rm: Math.round(e1rm * 10) / 10,
        epley: Math.round(epley * 10) / 10,
        brzycki: Math.round(brzycki * 10) / 10,
        lombardi: Math.round(lombardi * 10) / 10,
    };
}

/**
 * Determine if an action requires body weight in calculation
 * Only Pull-ups and Dips commonly use added weight
 * @deprecated Should prefer database property 'includesBodyWeight'
 */
export function requiresBodyWeightFallback(actionName: string): boolean {
    if (!actionName) return false;
    const bodyWeightActions = [
        "引体向上",
        "pull-up",
        "pull up",
        "pullup",
        "chin-up",
        "chin up",
        "chinup",
        "双杠臂屈伸",
        "dip",
        "dips",
        "双杠",
    ];

    const lowerName = actionName.toLowerCase();
    return bodyWeightActions.some((action) =>
        lowerName.includes(action.toLowerCase())
    );
}

export const PR_THRESHOLD_KG = 2;

export function isNewPR(newE1RM: number, currentPR?: number): boolean {
    if (currentPR === undefined || currentPR === null) {
        return true; // No existing PR, so this is a new PR
    }
    return (newE1RM - currentPR) > PR_THRESHOLD_KG;
}
