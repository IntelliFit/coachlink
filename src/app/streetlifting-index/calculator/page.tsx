"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Calculator as CalcIcon, Info } from "lucide-react";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { Slider } from "primereact/slider";
import { Skeleton } from "primereact/skeleton";

import { useToastContext } from "@/context/ToastContext";
import { streetliftingIndexService } from "@/app/service/streetliftingIndexService";

import type { StreetliftingFormula } from "@/app/api/streetlifting-index/formulas/list/entity";
import type { Gender, ExerciseType, CalcMode } from "@/app/streetlifting-index/_utils";
import {
    BARBELL_CURL_MULTIPLIER,
    STRICT_PRESS_MULTIPLIER,
    computeCoefficient,
    computeDOTSCoefficient,
    generateRMTable,
    invertTotalWeightForTarget1RM,
    isBenchBasedExercise,
    isPowerliftingExercise,
    isUpperBodyExercise,
    estimateRepsForTarget1RMContinuous,
    estimateTotal1RMFromTotalWeightAndReps,
    getScoreLevel,
} from "@/app/streetlifting-index/_utils";
import { AERO_CARD, AERO_CONTAINER_4XL, AERO_SUBTITLE, AERO_TITLE } from "@/components/streetlifting-index/aero";

type CalcResult = {
    estimated_1rm: number;
    final_score: number;
    coefficient: number;
    computed_added_weight?: number;
    computed_reps?: number;
    adjusted_used_weight?: number;
};

type FormState = {
    gender: Gender | "";
    bodyweight: number | null;

    // 上肢类
    addedWeight: number | null;
    added1RM: number | null;
    workingAddedWeight: number | null;

    // 三大项/实力推/弯举
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

const EXERCISE_OPTIONS: Array<{ label: string; value: ExerciseType }> = [
    { label: "💪 负重引体向上", value: "weighted_pullup" },
    { label: "💪 负重双杠臂屈伸", value: "weighted_dips" },
    { label: "🏋️ 实力推（满分500）", value: "strict_press" },
    { label: "🏋️ 杠铃弯举（满分500）", value: "barbell_curl" },
    { label: "🏋️ 深蹲（DOTS）", value: "squat" },
    { label: "🏋️ 卧推（DOTS）", value: "bench" },
    { label: "🏋️ 硬拉（DOTS）", value: "deadlift" },
];

const MODE_OPTIONS: Array<{ label: string; value: CalcMode }> = [
    { label: "正向计算", value: "forward" },
    { label: "反推做组重量", value: "reverse_weight" },
    { label: "反推次数", value: "reverse_reps" },
    { label: "做组极限估算（仅引体/臂屈伸）", value: "day_max" },
];

const QUALITY_OPTIONS: Array<{ label: string; value: FormState["formQuality"] }> = [
    { label: "比赛级（标准动作）", value: "Competition" },
    { label: "轻微借力（2-5kg）", value: "Minor_Cheat" },
    { label: "严重借力（5-20kg）", value: "Major_Cheat" },
    { label: "超严重借力（20-50kg）", value: "Extreme_Cheat" },
];

const REST_OPTIONS: Array<{ label: string; value: FormState["restCat"] }> = [
    { label: "≤90秒", value: "short" },
    { label: "90秒-3分钟", value: "moderate" },
    { label: "3-5分钟", value: "long" },
    { label: ">5分钟", value: "very_long" },
];

function restMultiplier(cat: NonNullable<FormState["restCat"]>) {
    switch (cat) {
        case "short":
            return 1.6;
        case "moderate":
            return 1.25;
        case "long":
            return 1.0;
        case "very_long":
            return 0.85;
        default:
            return 1.0;
    }
}

function intensityAvg(reps: number) {
    const r = Math.max(1, Math.min(36, Math.round(reps)));
    const e = 1 / (1 + 0.0333 * r);
    const b = (37 - r) / 36;
    const l = Math.pow(r, -0.1);
    return (e + b + l) / 3;
}

function estimateDayMaxFromSets(params: {
    bodyweight: number;
    addedWeight: number;
    penaltyWeight: number;
    sets: number;
    reps: number;
    restCat: NonNullable<FormState["restCat"]>;
    firstSet?: { type: "RIR" | "Achieved"; value: number };
    lastSet?: { type: "RIR" | "Achieved"; value: number };
    alphaPerRep?: number;
}) {
    const {
        bodyweight: W,
        addedWeight: A,
        penaltyWeight: P,
        sets: n,
        reps: r,
        restCat,
        firstSet,
        lastSet,
        alphaPerRep = 0.004,
    } = params;

    const adjustedAdded = A - P;
    const Tw = W + adjustedAdded;
    if (!Number.isFinite(Tw) || Tw <= 0) throw new Error("输入导致总重量无效");

    const rm = restMultiplier(restCat);
    const beta = alphaPerRep * r * rm;
    const lastAvail = Math.max(0.75, 1 - (n - 1) * beta);

    const effReps = (input?: { type: "RIR" | "Achieved"; value: number }) => {
        if (!input) return null;
        const v = input.type === "RIR" ? r + input.value : input.value;
        return Math.max(1, Math.min(36, v));
    };

    const r1 = effReps(firstSet);
    const rn = effReps(lastSet);
    let D_first: number | null = null;
    let D_last: number | null = null;

    if (r1 !== null) {
        const I1 = intensityAvg(r1);
        D_first = Tw / I1;
    }
    if (rn !== null) {
        const In = intensityAvg(rn);
        D_last = Tw / (In * lastAvail);
    }

    let D_day: number;
    if (D_first !== null && D_last !== null) {
        D_day = 0.8 * D_first + 0.2 * D_last;
    } else if (D_first !== null) {
        D_day = D_first;
    } else if (D_last !== null) {
        D_day = D_last;
    } else {
        throw new Error("请输入第一组或最后一组的RIR/实际次数信息");
    }

    return { total1RM: D_day, added1RM: D_day - W };
}

export default function StreetliftingCalculatorPage() {
    const { showToast } = useToastContext();
    const [exerciseType, setExerciseType] = useState<ExerciseType>("weighted_pullup");
    const [mode, setMode] = useState<CalcMode>("forward");
    const [loadingFormula, setLoadingFormula] = useState(true);
    const [formulaMap, setFormulaMap] = useState<Record<string, StreetliftingFormula>>({});

    const [form, setForm] = useState<FormState>({
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
        formQuality: "",
        penaltyWeight: 3,
    });

    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<CalcResult | null>(null);

    useEffect(() => {
        const run = async () => {
            setLoadingFormula(true);
            try {
                const data = await streetliftingIndexService.listFormulas();
                const next: Record<string, StreetliftingFormula> = {};
                (data?.formulas || []).forEach((f) => {
                    next[`${f.gender}:${f.exercise_type}`] = f;
                });
                setFormulaMap(next);
            } catch (e: any) {
                console.error("[streetlifting-index][calculator] listFormulas error:", e);
                showToast({ severity: "warn", summary: "提示", detail: "公式获取失败（可稍后重试）" });
            } finally {
                setLoadingFormula(false);
            }
        };
        run();
    }, [showToast]);

    useEffect(() => {
        // 动作质量切换时，自动把惩罚重量归到合理区间
        if (form.formQuality === "Minor_Cheat") {
            if (form.penaltyWeight < 2 || form.penaltyWeight > 5) setForm((p) => ({ ...p, penaltyWeight: 3 }));
        } else if (form.formQuality === "Major_Cheat") {
            if (form.penaltyWeight < 5 || form.penaltyWeight > 20) setForm((p) => ({ ...p, penaltyWeight: 10 }));
        } else if (form.formQuality === "Extreme_Cheat") {
            if (form.penaltyWeight < 20 || form.penaltyWeight > 50) setForm((p) => ({ ...p, penaltyWeight: 30 }));
        }
    }, [form.formQuality]);

    const penalty = useMemo(() => {
        return ["Minor_Cheat", "Major_Cheat", "Extreme_Cheat"].includes(form.formQuality)
            ? form.penaltyWeight
            : 0;
    }, [form.formQuality, form.penaltyWeight]);

    const currentFormula = useMemo(() => {
        if (!form.gender) return null;
        if (!isUpperBodyExercise(exerciseType)) return null;
        return formulaMap[`${form.gender}:${exerciseType}`] || null;
    }, [exerciseType, form.gender, formulaMap]);

    const canUseDayMax = isUpperBodyExercise(exerciseType);

    const handleCalculate = async () => {
        setSubmitting(true);
        setResult(null);

        try {
            const gender = form.gender;
            const bodyweight = form.bodyweight ?? NaN;
            const isMale = gender === "Male";

            if (!gender || !Number.isFinite(bodyweight) || bodyweight <= 0) {
                throw new Error("请完整填写性别与体重");
            }
            if (!form.formQuality) {
                throw new Error("请选择动作质量");
            }

            // === DOTS（三大项）===
            if (isPowerliftingExercise(exerciseType)) {
                const coeff = computeDOTSCoefficient(bodyweight, isMale);

                if (mode === "forward") {
                    const liftWeight = form.liftWeight ?? NaN;
                    const reps = form.reps ?? NaN;
                    if (!Number.isFinite(liftWeight) || liftWeight <= 0) throw new Error("请填写有效的做组重量");
                    if (!Number.isFinite(reps) || reps <= 0) throw new Error("请填写有效的完成次数");

                    const adjusted = liftWeight - penalty;
                    if (adjusted <= 0) throw new Error("惩罚重量过高，调整后的重量必须大于0");
                    const estimated1RM = estimateTotal1RMFromTotalWeightAndReps(adjusted, reps);
                    const score = estimated1RM * coeff;

                    setResult({
                        estimated_1rm: estimated1RM,
                        final_score: score,
                        coefficient: coeff,
                        adjusted_used_weight: adjusted,
                    });
                    return;
                }

                if (mode === "reverse_weight") {
                    const target1RM = form.target1RM ?? NaN;
                    const reps = form.reps ?? NaN;
                    if (!Number.isFinite(target1RM) || target1RM <= 0) throw new Error("请填写有效的目标1RM");
                    if (!Number.isFinite(reps) || reps <= 0) throw new Error("请填写有效的完成次数");
                    const computedWeight = invertTotalWeightForTarget1RM(target1RM, reps);
                    setResult({
                        estimated_1rm: target1RM,
                        final_score: target1RM * coeff,
                        coefficient: coeff,
                        computed_added_weight: computedWeight,
                    });
                    return;
                }

                if (mode === "reverse_reps") {
                    const target1RM = form.target1RM ?? NaN;
                    const workingWeight = form.workingLiftWeight ?? NaN;
                    if (!Number.isFinite(target1RM) || target1RM <= 0) throw new Error("请填写有效的目标1RM");
                    if (!Number.isFinite(workingWeight) || workingWeight <= 0) throw new Error("请填写有效的做组重量");
                    if (workingWeight >= target1RM) throw new Error("做组重量必须小于1RM");

                    const repsContinuous = estimateRepsForTarget1RMContinuous(target1RM, workingWeight);
                    setResult({
                        estimated_1rm: target1RM,
                        final_score: target1RM * coeff,
                        coefficient: coeff,
                        computed_reps: Number.parseFloat(repsContinuous.toFixed(1)),
                        adjusted_used_weight: workingWeight,
                    });
                    return;
                }

                throw new Error("三大项不支持“做组极限估算”");
            }

            // === 实力推/弯举：DOTS + 换算（满分500）===
            if (isBenchBasedExercise(exerciseType)) {
                const dots = computeDOTSCoefficient(bodyweight, isMale);
                const multiplier = exerciseType === "strict_press" ? STRICT_PRESS_MULTIPLIER : BARBELL_CURL_MULTIPLIER;

                if (mode === "forward") {
                    const liftWeight = form.liftWeight ?? NaN;
                    const reps = form.reps ?? NaN;
                    if (!Number.isFinite(liftWeight) || liftWeight <= 0) throw new Error("请填写有效的做组重量");
                    if (!Number.isFinite(reps) || reps <= 0) throw new Error("请填写有效的完成次数");
                    const adjusted = liftWeight - penalty;
                    if (adjusted <= 0) throw new Error("惩罚重量过高，调整后的重量必须大于0");
                    const estimated1RM = estimateTotal1RMFromTotalWeightAndReps(adjusted, reps);
                    const score = estimated1RM * dots * multiplier;
                    setResult({
                        estimated_1rm: estimated1RM,
                        final_score: score,
                        coefficient: dots,
                        adjusted_used_weight: adjusted,
                    });
                    return;
                }

                if (mode === "reverse_weight") {
                    const target1RM = form.target1RM ?? NaN;
                    const reps = form.reps ?? NaN;
                    if (!Number.isFinite(target1RM) || target1RM <= 0) throw new Error("请填写有效的目标1RM");
                    if (!Number.isFinite(reps) || reps <= 0) throw new Error("请填写有效的完成次数");
                    const computedWeight = invertTotalWeightForTarget1RM(target1RM, reps);
                    setResult({
                        estimated_1rm: target1RM,
                        final_score: target1RM * dots * multiplier,
                        coefficient: dots,
                        computed_added_weight: computedWeight,
                    });
                    return;
                }

                if (mode === "reverse_reps") {
                    const target1RM = form.target1RM ?? NaN;
                    const workingWeight = form.workingLiftWeight ?? NaN;
                    if (!Number.isFinite(target1RM) || target1RM <= 0) throw new Error("请填写有效的目标1RM");
                    if (!Number.isFinite(workingWeight) || workingWeight <= 0) throw new Error("请填写有效的做组重量");
                    if (workingWeight >= target1RM) throw new Error("做组重量必须小于1RM");
                    const repsContinuous = estimateRepsForTarget1RMContinuous(target1RM, workingWeight);
                    setResult({
                        estimated_1rm: target1RM,
                        final_score: target1RM * dots * multiplier,
                        coefficient: dots,
                        computed_reps: Number.parseFloat(repsContinuous.toFixed(1)),
                        adjusted_used_weight: workingWeight,
                    });
                    return;
                }

                throw new Error("该动作不支持“做组极限估算”");
            }

            // === 上肢（引体/臂屈伸）：枭马葛系数 ===
            if (!isUpperBodyExercise(exerciseType)) {
                throw new Error("未知运动类型");
            }
            if (loadingFormula) {
                throw new Error("公式加载中，请稍后再试");
            }
            if (!currentFormula) {
                throw new Error("未找到对应性别/动作的公式（请检查公式是否已初始化）");
            }

            const coefficient = computeCoefficient(bodyweight, currentFormula);

            if (mode === "forward") {
                const added = form.addedWeight ?? NaN;
                const reps = form.reps ?? NaN;
                if (!Number.isFinite(added)) throw new Error("请填写附加负重");
                if (!Number.isFinite(reps) || reps < 1 || reps > 36) throw new Error("完成次数必须在 1-36 之间");
                const adjustedAdded = added - penalty;
                const totalWeight = bodyweight + adjustedAdded;
                if (totalWeight <= 0) throw new Error("惩罚重量过高，导致总重量无效");

                const total1RM = estimateTotal1RMFromTotalWeightAndReps(totalWeight, reps);
                const added1RM = total1RM - bodyweight;
                const rawScore = total1RM * coefficient;
                const finalScore = exerciseType === "weighted_dips" ? rawScore / 1.3 : rawScore;

                setResult({
                    estimated_1rm: added1RM,
                    final_score: finalScore,
                    coefficient,
                    adjusted_used_weight: adjustedAdded,
                });
                return;
            }

            if (mode === "reverse_weight") {
                const added1RM = form.added1RM ?? NaN;
                const reps = form.reps ?? NaN;
                if (!Number.isFinite(added1RM)) throw new Error("请填写负重1RM");
                if (!Number.isFinite(reps) || reps < 1 || reps > 36) throw new Error("完成次数必须在 1-36 之间");
                const targetTotal1RM = bodyweight + added1RM;
                const totalWorkingWeight = invertTotalWeightForTarget1RM(targetTotal1RM, reps);
                const adjustedAdded = totalWorkingWeight - bodyweight;
                const computedAdded = adjustedAdded + penalty;

                const rawScore = targetTotal1RM * coefficient;
                const finalScore = exerciseType === "weighted_dips" ? rawScore / 1.3 : rawScore;

                setResult({
                    estimated_1rm: added1RM,
                    final_score: finalScore,
                    coefficient,
                    computed_added_weight: computedAdded,
                    adjusted_used_weight: adjustedAdded,
                });
                return;
            }

            if (mode === "reverse_reps") {
                const added1RM = form.added1RM ?? NaN;
                const workingAdded = form.workingAddedWeight ?? NaN;
                if (!Number.isFinite(added1RM)) throw new Error("请填写负重1RM");
                if (!Number.isFinite(workingAdded)) throw new Error("请填写做组重量（附加负重）");

                const targetTotal1RM = bodyweight + added1RM;
                const adjustedAdded = workingAdded - penalty;
                const totalWorkingWeight = bodyweight + adjustedAdded;
                if (totalWorkingWeight <= 0) throw new Error("输入导致总重量无效");

                const repsContinuous = estimateRepsForTarget1RMContinuous(targetTotal1RM, totalWorkingWeight);
                const rawScore = targetTotal1RM * coefficient;
                const finalScore = exerciseType === "weighted_dips" ? rawScore / 1.3 : rawScore;

                setResult({
                    estimated_1rm: added1RM,
                    final_score: finalScore,
                    coefficient,
                    computed_reps: Number.parseFloat(repsContinuous.toFixed(1)),
                    adjusted_used_weight: adjustedAdded,
                });
                return;
            }

            if (mode === "day_max") {
                const sets = form.sets ?? NaN;
                const reps = form.reps ?? NaN;
                const added = form.addedWeight ?? NaN;
                if (!Number.isFinite(sets) || sets <= 0) throw new Error("请填写有效的组数");
                if (!Number.isFinite(reps) || reps <= 0) throw new Error("请填写有效的每组次数");
                if (!Number.isFinite(added)) throw new Error("请填写做组重量（附加负重）");
                const restCat = (form.restCat || "long") as NonNullable<FormState["restCat"]>;

                const firstSet =
                    form.dayFirstType && Number.isFinite(form.dayFirstValue ?? NaN)
                        ? { type: form.dayFirstType, value: form.dayFirstValue as number }
                        : undefined;
                const lastSet =
                    form.dayLastType && Number.isFinite(form.dayLastValue ?? NaN)
                        ? { type: form.dayLastType, value: form.dayLastValue as number }
                        : undefined;
                if (!firstSet && !lastSet) throw new Error("请至少输入第一组或最后一组的信息");

                const { total1RM, added1RM } = estimateDayMaxFromSets({
                    bodyweight,
                    addedWeight: added,
                    penaltyWeight: penalty,
                    sets,
                    reps,
                    restCat,
                    firstSet,
                    lastSet,
                });

                const rawScore = total1RM * coefficient;
                const finalScore = exerciseType === "weighted_dips" ? rawScore / 1.3 : rawScore;

                setResult({
                    estimated_1rm: added1RM,
                    final_score: finalScore,
                    coefficient,
                    adjusted_used_weight: added - penalty,
                });
                return;
            }
        } catch (e: any) {
            showToast({ severity: "warn", summary: "无法计算", detail: e?.message || "请检查输入" });
        } finally {
            setSubmitting(false);
        }
    };

    const scoreLevel = result ? getScoreLevel(result.final_score, exerciseType) : null;
    const showPenalty = ["Minor_Cheat", "Major_Cheat", "Extreme_Cheat"].includes(form.formQuality);
    const penaltyRange =
        form.formQuality === "Minor_Cheat"
            ? [2, 5]
            : form.formQuality === "Major_Cheat"
                ? [5, 20]
                : [20, 50];

    const dropdownClassName = "w-full h-10 rounded-2xl bg-surface-0 border border-surface-200";
    const dropdownPanelClassName = "rounded-2xl border border-surface-100 bg-surface-0 shadow-xl";
    const dropdownIcon = () => <span className="pi pi-chevron-down text-surface-400" />;
    const dropdownPt = {
        input: { className: "py-2 px-3 text-sm font-semibold text-surface-800" },
        trigger: { className: "w-10" },
    } as const;

    const renderAeroDropdownValue = (option: any, props?: any) => {
        const label = option?.label ?? props?.placeholder ?? "请选择";
        const isPlaceholder = !option;
        return (
            <div className="min-w-0 flex items-center gap-2">
                <span className={`truncate text-sm font-semibold ${isPlaceholder ? "text-surface-500" : "text-surface-800"}`}>{label}</span>
            </div>
        );
    };

    const makeAeroDropdownItemTemplate =
        (currentValue: any) =>
        (option: any) => {
            const label = option?.label ?? String(option ?? "");
            const value = option?.value ?? option;
            const isActive = currentValue === value;
            return (
                <div
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl ${
                        isActive ? "bg-surface-100 text-surface-900" : "text-surface-700"
                    }`}
                >
                    <span className={`min-w-0 truncate text-sm ${isActive ? "font-bold" : "font-medium"}`}>{label}</span>
                    <span className={`shrink-0 text-[10px] font-black ${isActive ? "text-primary-600" : "text-surface-300"}`}>●</span>
                </div>
            );
        };

    const numberInputClassName =
        "w-full !h-10 rounded-2xl border border-surface-200 bg-surface-0 !px-3 !py-2 text-sm font-semibold text-surface-800 placeholder:text-surface-400 focus:shadow-none focus:border-primary-200";

    return (
        <div className={`${AERO_CONTAINER_4XL} py-6`}>
                <Card className={AERO_CARD}>
                    <div className="p-6 space-y-5">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <div className={AERO_TITLE}>在线力量分计算器</div>
                                <div className={AERO_SUBTITLE}>输入数据，获得力量评估（引体/臂屈伸满分500；三大项为DOTS分）。</div>
                            </div>
                            <Link href="/streetlifting-index/data" className="hidden md:block">
                                <Button
                                    outlined
                                    severity="secondary"
                                    size="small"
                                    label="去数据社区"
                                    className="h-10 rounded-2xl border-surface-200 text-surface-800 hover:bg-surface-0 hover:border-primary-200 active:scale-[0.98] transition-all"
                                />
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <div className="text-xs text-surface-500 mb-1.5">运动类型</div>
                                <Dropdown
                                    value={exerciseType}
                                    options={EXERCISE_OPTIONS}
                                    optionLabel="label"
                                    optionValue="value"
                                    className={dropdownClassName}
                                    panelClassName={dropdownPanelClassName}
                                    dropdownIcon={dropdownIcon}
                                    pt={dropdownPt}
                                    valueTemplate={renderAeroDropdownValue}
                                    itemTemplate={makeAeroDropdownItemTemplate(exerciseType)}
                                    onChange={(e) => {
                                        setExerciseType(e.value);
                                        setResult(null);
                                        if (e.value !== "weighted_pullup" && e.value !== "weighted_dips" && mode === "day_max") {
                                            setMode("forward");
                                        }
                                    }}
                                />
                                {isUpperBodyExercise(exerciseType) && (
                                    <div className="mt-2 flex items-start gap-2 text-xs text-surface-700 bg-surface-50 border border-surface-200 rounded-2xl p-3">
                                        <AlertTriangle className="h-4 w-4 mt-0.5 text-surface-500" />
                                        <div>提示：100kg以上体重样本较少，估算可能偏差更大。</div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="text-xs text-surface-500 mb-1.5">计算模式</div>
                                <Dropdown
                                    value={mode}
                                    options={MODE_OPTIONS.filter((m) => (m.value === "day_max" ? canUseDayMax : true))}
                                    optionLabel="label"
                                    optionValue="value"
                                    className={dropdownClassName}
                                    panelClassName={dropdownPanelClassName}
                                    dropdownIcon={dropdownIcon}
                                    pt={dropdownPt}
                                    valueTemplate={renderAeroDropdownValue}
                                    itemTemplate={makeAeroDropdownItemTemplate(mode)}
                                    onChange={(e) => {
                                        setMode(e.value);
                                        setResult(null);
                                    }}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <div className="text-xs text-surface-500 mb-1.5">性别</div>
                                <Dropdown
                                    value={form.gender}
                                    options={[
                                        { label: "男性", value: "Male" },
                                        { label: "女性", value: "Female" },
                                    ]}
                                    optionLabel="label"
                                    optionValue="value"
                                    className={dropdownClassName}
                                    panelClassName={dropdownPanelClassName}
                                    dropdownIcon={dropdownIcon}
                                    pt={dropdownPt}
                                    valueTemplate={renderAeroDropdownValue}
                                    itemTemplate={makeAeroDropdownItemTemplate(form.gender)}
                                    onChange={(e) => setForm((p) => ({ ...p, gender: e.value }))}
                                />
                            </div>
                            <div>
                                <div className="text-xs text-surface-500 mb-1.5">体重（kg）</div>
                                <InputNumber
                                    value={form.bodyweight}
                                    onValueChange={(e) => setForm((p) => ({ ...p, bodyweight: e.value ?? null }))}
                                    className="w-full"
                                    inputClassName={numberInputClassName}
                                    min={1}
                                    maxFractionDigits={1}
                                    placeholder="例如 70.5"
                                />
                            </div>
                        </div>

                        {/* 主要输入区 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* 上肢 forward：附加负重 */}
                            {isUpperBodyExercise(exerciseType) && mode === "forward" && (
                                <div>
                                    <div className="text-xs text-surface-500 mb-1.5">附加负重（kg）</div>
                                    <InputNumber
                                        value={form.addedWeight}
                                        onValueChange={(e) => setForm((p) => ({ ...p, addedWeight: e.value ?? null }))}
                                        className="w-full"
                                        inputClassName={numberInputClassName}
                                        maxFractionDigits={1}
                                        placeholder="例如 20"
                                    />
                                </div>
                            )}

                            {/* 上肢 reverse_weight：目标负重1RM */}
                            {isUpperBodyExercise(exerciseType) && mode === "reverse_weight" && (
                                <div>
                                    <div className="text-xs text-surface-500 mb-1.5">目标负重1RM（kg）</div>
                                    <InputNumber
                                        value={form.added1RM}
                                        onValueChange={(e) => setForm((p) => ({ ...p, added1RM: e.value ?? null }))}
                                        className="w-full"
                                        inputClassName={numberInputClassName}
                                        maxFractionDigits={1}
                                        placeholder="例如 50"
                                    />
                                </div>
                            )}

                            {/* 上肢 reverse_reps：目标负重1RM */}
                            {isUpperBodyExercise(exerciseType) && mode === "reverse_reps" && (
                                <div>
                                    <div className="text-xs text-surface-500 mb-1.5">目标负重1RM（kg）</div>
                                    <InputNumber
                                        value={form.added1RM}
                                        onValueChange={(e) => setForm((p) => ({ ...p, added1RM: e.value ?? null }))}
                                        className="w-full"
                                        inputClassName={numberInputClassName}
                                        maxFractionDigits={1}
                                        placeholder="例如 50"
                                    />
                                </div>
                            )}

                            {/* 三大项/实力推/弯举 forward：做组重量 */}
                            {(isPowerliftingExercise(exerciseType) || isBenchBasedExercise(exerciseType)) && mode === "forward" && (
                                <div>
                                    <div className="text-xs text-surface-500 mb-1.5">做组重量（kg）</div>
                                    <InputNumber
                                        value={form.liftWeight}
                                        onValueChange={(e) => setForm((p) => ({ ...p, liftWeight: e.value ?? null }))}
                                        className="w-full"
                                        inputClassName={numberInputClassName}
                                        maxFractionDigits={1}
                                        placeholder="例如 100"
                                    />
                                </div>
                            )}

                            {/* 三大项/实力推/弯举 reverse_weight：目标1RM */}
                            {(isPowerliftingExercise(exerciseType) || isBenchBasedExercise(exerciseType)) && mode === "reverse_weight" && (
                                <div>
                                    <div className="text-xs text-surface-500 mb-1.5">目标1RM（kg）</div>
                                    <InputNumber
                                        value={form.target1RM}
                                        onValueChange={(e) => setForm((p) => ({ ...p, target1RM: e.value ?? null }))}
                                        className="w-full"
                                        inputClassName={numberInputClassName}
                                        maxFractionDigits={1}
                                        placeholder="例如 200"
                                    />
                                </div>
                            )}

                            {/* 三大项/实力推/弯举 reverse_reps：目标1RM */}
                            {(isPowerliftingExercise(exerciseType) || isBenchBasedExercise(exerciseType)) && mode === "reverse_reps" && (
                                <div>
                                    <div className="text-xs text-surface-500 mb-1.5">目标1RM（kg）</div>
                                    <InputNumber
                                        value={form.target1RM}
                                        onValueChange={(e) => setForm((p) => ({ ...p, target1RM: e.value ?? null }))}
                                        className="w-full"
                                        inputClassName={numberInputClassName}
                                        maxFractionDigits={1}
                                        placeholder="例如 200"
                                    />
                                </div>
                            )}

                            {/* 三大项/实力推/弯举 reverse_reps：做组重量 */}
                            {(isPowerliftingExercise(exerciseType) || isBenchBasedExercise(exerciseType)) && mode === "reverse_reps" && (
                                <div>
                                    <div className="text-xs text-surface-500 mb-1.5">做组重量（kg）</div>
                                    <InputNumber
                                        value={form.workingLiftWeight}
                                        onValueChange={(e) => setForm((p) => ({ ...p, workingLiftWeight: e.value ?? null }))}
                                        className="w-full"
                                        inputClassName={numberInputClassName}
                                        maxFractionDigits={1}
                                        placeholder="例如 150"
                                    />
                                </div>
                            )}

                            {/* 上肢 reverse_reps：做组重量（附加负重） */}
                            {isUpperBodyExercise(exerciseType) && mode === "reverse_reps" && (
                                <div>
                                    <div className="text-xs text-surface-500 mb-1.5">做组重量（附加负重，kg）</div>
                                    <InputNumber
                                        value={form.workingAddedWeight}
                                        onValueChange={(e) => setForm((p) => ({ ...p, workingAddedWeight: e.value ?? null }))}
                                        className="w-full"
                                        inputClassName={numberInputClassName}
                                        maxFractionDigits={1}
                                        placeholder="例如 20"
                                    />
                                </div>
                            )}
                        </div>

                        {/* 次数输入（除 day_max 外都需要；day_max 里 reps 代表每组次数） */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <div className="text-xs text-surface-500 mb-1.5">
                                    {mode === "day_max" ? "每组次数" : "完成次数"}
                                </div>
                                <InputNumber
                                    value={form.reps}
                                    onValueChange={(e) => setForm((p) => ({ ...p, reps: e.value ?? null }))}
                                    className="w-full"
                                    inputClassName={numberInputClassName}
                                    min={1}
                                    max={36}
                                    placeholder="例如 5"
                                />
                                <div className="mt-1 text-[12px] text-surface-500">支持 1-36 次（更建议 ≤10）。</div>
                            </div>

                            <div>
                                <div className="text-xs text-surface-500 mb-1.5">动作质量</div>
                                <Dropdown
                                    value={form.formQuality}
                                    options={QUALITY_OPTIONS}
                                    optionLabel="label"
                                    optionValue="value"
                                    className={dropdownClassName}
                                    panelClassName={dropdownPanelClassName}
                                    dropdownIcon={dropdownIcon}
                                    pt={dropdownPt}
                                    valueTemplate={renderAeroDropdownValue}
                                    itemTemplate={makeAeroDropdownItemTemplate(form.formQuality)}
                                    onChange={(e) => setForm((p) => ({ ...p, formQuality: e.value }))}
                                />
                            </div>
                        </div>

                        {showPenalty && (
                            <div className="rounded-2xl border border-surface-100 bg-surface-50 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-medium text-surface-900">
                                        惩罚重量：{form.penaltyWeight} kg
                                    </div>
                                    <div className="text-xs text-surface-500">
                                        范围 {penaltyRange[0]} - {penaltyRange[1]} kg
                                    </div>
                                </div>
                                <Slider
                                    value={form.penaltyWeight}
                                    onChange={(e) => setForm((p) => ({ ...p, penaltyWeight: Number(e.value) }))}
                                    min={penaltyRange[0]}
                                    max={penaltyRange[1]}
                                    step={0.5}
                                />
                            </div>
                        )}

                        {/* day_max 补充输入 */}
                        {mode === "day_max" && isUpperBodyExercise(exerciseType) && (
                            <div className="rounded-2xl border border-surface-100 bg-surface-50 p-4 space-y-4">
                                <div className="flex items-start gap-2 text-xs text-surface-700">
                                    <Info className="h-4 w-4 mt-0.5 text-primary-600" />
                                    <div>
                                        做组极限估算：基于做组（组数/次数/休息）以及第一组或最后一组的完成情况估算当天极限。
                                        若两者都填，第一组权重更高（80%）。
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-xs text-surface-500 mb-1.5">做组重量（附加负重，kg）</div>
                                        <InputNumber
                                            value={form.addedWeight}
                                            onValueChange={(e) => setForm((p) => ({ ...p, addedWeight: e.value ?? null }))}
                                            className="w-full"
                                            inputClassName={numberInputClassName}
                                            maxFractionDigits={1}
                                        />
                                    </div>
                                    <div>
                                        <div className="text-xs text-surface-500 mb-1.5">组数</div>
                                        <InputNumber
                                            value={form.sets}
                                            onValueChange={(e) => setForm((p) => ({ ...p, sets: e.value ?? null }))}
                                            className="w-full"
                                            inputClassName={numberInputClassName}
                                            min={1}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-xs text-surface-500 mb-1.5">平均休息</div>
                                        <Dropdown
                                            value={form.restCat}
                                            options={REST_OPTIONS}
                                            optionLabel="label"
                                            optionValue="value"
                                            className={dropdownClassName}
                                            panelClassName={dropdownPanelClassName}
                                            dropdownIcon={dropdownIcon}
                                            pt={dropdownPt}
                                            valueTemplate={renderAeroDropdownValue}
                                            itemTemplate={makeAeroDropdownItemTemplate(form.restCat)}
                                            onChange={(e) => setForm((p) => ({ ...p, restCat: e.value }))}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-xs text-surface-500 mb-1.5">第一组信息（可选）</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Dropdown
                                                value={form.dayFirstType}
                                                options={[
                                                    { label: "RIR", value: "RIR" },
                                                    { label: "实际次数", value: "Achieved" },
                                                ]}
                                                optionLabel="label"
                                                optionValue="value"
                                                className={dropdownClassName}
                                                panelClassName={dropdownPanelClassName}
                                                dropdownIcon={dropdownIcon}
                                                pt={dropdownPt}
                                                valueTemplate={renderAeroDropdownValue}
                                                itemTemplate={makeAeroDropdownItemTemplate(form.dayFirstType)}
                                                onChange={(e) => setForm((p) => ({ ...p, dayFirstType: e.value }))}
                                                placeholder="类型"
                                            />
                                            <InputNumber
                                                value={form.dayFirstValue}
                                                onValueChange={(e) => setForm((p) => ({ ...p, dayFirstValue: e.value ?? null }))}
                                                className="w-full"
                                                inputClassName={numberInputClassName}
                                                placeholder="数值"
                                                maxFractionDigits={1}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-xs text-surface-500 mb-1.5">最后一组信息（可选）</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Dropdown
                                                value={form.dayLastType}
                                                options={[
                                                    { label: "RIR", value: "RIR" },
                                                    { label: "实际次数", value: "Achieved" },
                                                ]}
                                                optionLabel="label"
                                                optionValue="value"
                                                className={dropdownClassName}
                                                panelClassName={dropdownPanelClassName}
                                                dropdownIcon={dropdownIcon}
                                                pt={dropdownPt}
                                                valueTemplate={renderAeroDropdownValue}
                                                itemTemplate={makeAeroDropdownItemTemplate(form.dayLastType)}
                                                onChange={(e) => setForm((p) => ({ ...p, dayLastType: e.value }))}
                                                placeholder="类型"
                                            />
                                            <InputNumber
                                                value={form.dayLastValue}
                                                onValueChange={(e) => setForm((p) => ({ ...p, dayLastValue: e.value ?? null }))}
                                                className="w-full"
                                                inputClassName={numberInputClassName}
                                                placeholder="数值"
                                                maxFractionDigits={1}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col md:flex-row gap-3">
                            <Button
                                label={submitting ? "计算中..." : "开始计算"}
                                icon={<CalcIcon className="h-4 w-4" />}
                                disabled={submitting}
                                className="w-full md:w-auto h-10 rounded-2xl bg-surface-900 border-none text-surface-0 text-sm font-black hover:bg-surface-800 shadow-sm shadow-primary-100/60 hover:shadow-primary-100 active:scale-[0.98] transition-all"
                                onClick={handleCalculate}
                            />
                            <Link href="/streetlifting-index/methodology" className="w-full md:w-auto">
                                <Button
                                    outlined
                                    severity="secondary"
                                    size="small"
                                    className="w-full md:w-auto h-10 rounded-2xl border-surface-200 text-surface-800 hover:bg-surface-0 hover:border-primary-200 active:scale-[0.98] transition-all"
                                    label="查看方法论"
                                />
                            </Link>
                        </div>

                        {/* 公式加载提示（仅上肢需要） */}
                        {isUpperBodyExercise(exerciseType) && (
                            <div className="text-xs text-surface-500">
                                {loadingFormula ? (
                                    <div className="flex items-center gap-2">
                                        <Skeleton width="10rem" height="0.9rem" />
                                        <span>正在加载公式…</span>
                                    </div>
                                ) : currentFormula ? (
                                    <span>
                                        当前公式：{currentFormula.gender} · {currentFormula.exercise_type}（更新时间{" "}
                                        {new Date(currentFormula.last_updated).toLocaleDateString("zh-CN")}）
                                    </span>
                                ) : (
                                    <span className="text-surface-600">
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-500 mr-2 align-middle" />
                                        未找到对应公式（可联系管理员初始化公式表）
                                    </span>
                                )}
                            </div>
                        )}

                        {/* 结果 */}
                        {result && (
                            <div className="rounded-2xl border border-surface-100 bg-surface-50 p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-base font-semibold text-surface-900">计算结果</div>
                                    {scoreLevel && (
                                        <div className="flex items-center gap-2 text-xs font-black text-surface-700 bg-surface-0 border border-surface-200 rounded-full px-3 py-1">
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-500" />
                                            {scoreLevel.level}
                                        </div>
                                    )}
                                </div>

                                {showPenalty && (
                                    <div className="text-sm text-surface-700">
                                        惩罚重量：<span className="font-semibold text-surface-900">-{penalty} kg</span>
                                    </div>
                                )}

                                {result.adjusted_used_weight !== undefined && (
                                    <div className="text-sm text-surface-700">
                                        实际用于计算的重量：<span className="font-semibold text-surface-900">{result.adjusted_used_weight.toFixed(1)}</span>{" "}
                                        {isUpperBodyExercise(exerciseType) ? "kg（附加负重）" : "kg"}
                                    </div>
                                )}

                                {mode === "reverse_weight" && result.computed_added_weight !== undefined && (
                                    <div className="text-sm text-surface-700">
                                        反推做组重量：<span className="font-semibold text-surface-900">{result.computed_added_weight.toFixed(1)}</span> kg
                                    </div>
                                )}

                                {mode === "reverse_reps" && result.computed_reps !== undefined && (
                                    <div className="text-sm text-surface-700">
                                        反推可完成次数：<span className="font-semibold text-surface-900">{result.computed_reps.toFixed(1)}</span> 次
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="rounded-2xl border border-surface-100 bg-surface-0 p-4">
                                        <div className="text-xs text-surface-500">
                                            {isUpperBodyExercise(exerciseType) ? "估算负重1RM" : "估算1RM"}
                                        </div>
                                        <div className="text-2xl font-bold text-surface-900 mt-1">
                                            {result.estimated_1rm.toFixed(1)} kg
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-surface-100 bg-surface-0 p-4">
                                        <div className="text-xs text-surface-500">
                                            {isUpperBodyExercise(exerciseType) || isBenchBasedExercise(exerciseType) ? "力量分（/500）" : "DOTS 分"}
                                        </div>
                                        <div className="text-2xl font-bold text-primary-700 mt-1">
                                            {result.final_score.toFixed(isUpperBodyExercise(exerciseType) ? 0 : 1)}
                                        </div>
                                    </div>
                                </div>

                                {/* RM 表格（主要给上肢更有意义；三大项也可用） */}
                                <div className="pt-2">
                                    <div className="text-sm font-semibold text-surface-900 mb-2">RM 对照表</div>
                                    <div className="overflow-x-auto rounded-2xl border border-surface-100 bg-surface-0">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-surface-50">
                                                <tr className="text-left text-surface-600">
                                                    <th className="px-4 py-3">次数</th>
                                                    <th className="px-4 py-3">重量（kg）</th>
                                                    <th className="px-4 py-3">% 1RM</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {generateRMTable(isUpperBodyExercise(exerciseType) ? (form.bodyweight || 0) : 0, result.estimated_1rm).map((row) => (
                                                    <tr key={row.reps} className="border-t border-surface-100">
                                                        <td className="px-4 py-2 text-surface-700">{row.reps}</td>
                                                        <td className="px-4 py-2 font-semibold text-surface-900">{row.weight.toFixed(1)}</td>
                                                        <td className="px-4 py-2 text-surface-600">{row.percentage}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
        </div>
    );
}

