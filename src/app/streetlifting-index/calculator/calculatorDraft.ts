import type { Gender, ExerciseType, CalcMode } from "@/app/streetlifting-index/_utils";
import { isUpperBodyExercise } from "@/app/streetlifting-index/_utils";

/** localStorage 键；若以后改结构可 bump 版本避免脏读 */
export const STREETLIFTING_CALC_STORAGE_KEY = "coachlink:streetlifting-calc:v1";

const VALID_EXERCISE: readonly ExerciseType[] = [
    "weighted_pullup",
    "weighted_dips",
    "strict_press",
    "barbell_curl",
    "squat",
    "bench",
    "deadlift",
] as const;

const VALID_MODE: readonly CalcMode[] = ["forward", "reverse_weight", "reverse_reps", "day_max"] as const;

export type StreetliftingCalculatorFormState = {
    gender: Gender | "";
    bodyweight: number | null;
    addedWeight: number | null;
    added1RM: number | null;
    workingAddedWeight: number | null;
    liftWeight: number | null;
    target1RM: number | null;
    workingLiftWeight: number | null;
    reps: number | null;
    sets: number | null;
    restCat: "short" | "moderate" | "long" | "very_long" | "";
    dayFirstType: "RIR" | "Achieved" | "";
    dayFirstValue: number | null;
    dayLastType: "RIR" | "Achieved" | "";
    dayLastValue: number | null;
    formQuality: "Competition" | "Minor_Cheat" | "Major_Cheat" | "Extreme_Cheat" | "";
    penaltyWeight: number;
};

export function getDefaultStreetliftingCalcForm(): StreetliftingCalculatorFormState {
    return {
        gender: "",
        bodyweight: null,
        addedWeight: null,
        added1RM: null,
        workingAddedWeight: null,
        liftWeight: null,
        target1RM: null,
        workingLiftWeight: null,
        reps: null,
        sets: null,
        restCat: "",
        dayFirstType: "",
        dayFirstValue: null,
        dayLastType: "",
        dayLastValue: null,
        formQuality: "Minor_Cheat",
        penaltyWeight: 3,
    };
}

function isFiniteNum(n: unknown): n is number {
    return typeof n === "number" && Number.isFinite(n);
}

function snapForm(raw: unknown): StreetliftingCalculatorFormState {
    const b = getDefaultStreetliftingCalcForm();
    if (!raw || typeof raw !== "object") return b;
    const s = raw as Record<string, unknown>;
    const merged: StreetliftingCalculatorFormState = {
        ...b,
        gender: s.gender === "Male" || s.gender === "Female" ? s.gender : b.gender,
        bodyweight: isFiniteNum(s.bodyweight) ? s.bodyweight : null,
        addedWeight: isFiniteNum(s.addedWeight) ? s.addedWeight : null,
        added1RM: isFiniteNum(s.added1RM) ? s.added1RM : null,
        workingAddedWeight: isFiniteNum(s.workingAddedWeight) ? s.workingAddedWeight : null,
        liftWeight: isFiniteNum(s.liftWeight) ? s.liftWeight : null,
        target1RM: isFiniteNum(s.target1RM) ? s.target1RM : null,
        workingLiftWeight: isFiniteNum(s.workingLiftWeight) ? s.workingLiftWeight : null,
        reps: isFiniteNum(s.reps) ? s.reps : null,
        sets: isFiniteNum(s.sets) ? s.sets : null,
        restCat:
            s.restCat === "short" || s.restCat === "moderate" || s.restCat === "long" || s.restCat === "very_long" || s.restCat === ""
                ? s.restCat
                : b.restCat,
        dayFirstType: s.dayFirstType === "RIR" || s.dayFirstType === "Achieved" || s.dayFirstType === "" ? s.dayFirstType : b.dayFirstType,
        dayFirstValue: isFiniteNum(s.dayFirstValue) ? s.dayFirstValue : null,
        dayLastType: s.dayLastType === "RIR" || s.dayLastType === "Achieved" || s.dayLastType === "" ? s.dayLastType : b.dayLastType,
        dayLastValue: isFiniteNum(s.dayLastValue) ? s.dayLastValue : null,
        formQuality:
            s.formQuality === "Competition" ||
            s.formQuality === "Minor_Cheat" ||
            s.formQuality === "Major_Cheat" ||
            s.formQuality === "Extreme_Cheat" ||
            s.formQuality === ""
                ? s.formQuality
                : b.formQuality,
        penaltyWeight: isFiniteNum(s.penaltyWeight) ? Math.max(0, s.penaltyWeight) : b.penaltyWeight,
    };
    return merged;
}

export type StreetliftingCalculatorDraft = {
    exerciseType: ExerciseType;
    mode: CalcMode;
    form: StreetliftingCalculatorFormState;
};

export function parseStreetliftingCalculatorDraft(raw: string | null): StreetliftingCalculatorDraft | null {
    if (typeof raw !== "string" || !raw.trim()) return null;
    try {
        const j = JSON.parse(raw) as unknown;
        if (!j || typeof j !== "object") return null;
        const o = j as Record<string, unknown>;
        const exerciseType = VALID_EXERCISE.includes(o.exerciseType as ExerciseType) ? (o.exerciseType as ExerciseType) : "weighted_pullup";
        let mode = VALID_MODE.includes(o.mode as CalcMode) ? (o.mode as CalcMode) : "forward";
        if (!isUpperBodyExercise(exerciseType) && mode === "day_max") mode = "forward";
        const form = snapForm(o.form);
        return { exerciseType, mode, form };
    } catch {
        return null;
    }
}

export function stringifyStreetliftingCalculatorDraft(draft: StreetliftingCalculatorDraft): string {
    return JSON.stringify(draft);
}
