export interface StreetliftingListFormulasDto {
    exercise_type?: "weighted_pullup" | "weighted_dips";
}

export interface StreetliftingFormula {
    id: number;
    gender: "Male" | "Female";
    exercise_type: "weighted_pullup" | "weighted_dips";
    coeff_a: number;
    coeff_b: number;
    coeff_c: number;
    coeff_d: number;
    coeff_e: number;
    coeff_f: number;
    total_submissions_used: number;
    last_updated: string;
}

export interface StreetliftingListFormulasResponseDto {
    formulas: StreetliftingFormula[];
}
