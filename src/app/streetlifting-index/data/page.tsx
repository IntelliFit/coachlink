"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Filter, Plus, User, Video, Search, CheckCircle2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { IconField } from "primereact/iconfield";
import { AeroInputNumber } from "@/components/AeroInputNumber";
import { InputIcon } from "primereact/inputicon";
import { InputText } from "primereact/inputtext";
import { Skeleton } from "primereact/skeleton";
import { Slider } from "primereact/slider";

import { useToastContext } from "@/context/ToastContext";
import { streetliftingIndexService } from "@/app/service/streetliftingIndexService";
import { studentService } from "@/app/service/studentService";

import type { StreetliftingFormula } from "@/app/api/streetlifting-index/formulas/list/entity";
import type { StreetliftingSubmission } from "@/app/api/streetlifting-index/submissions/list/entity";
import type { StreetliftingCreateSubmissionDto } from "@/app/api/streetlifting-index/submissions/create/entity";
import { calculateAdded1RM, computeCoefficient } from "@/app/streetlifting-index/_utils";
import { AERO_CARD, AERO_CONTAINER_7XL, AERO_SUBTITLE, AERO_TITLE } from "@/components/streetlifting-index/aero";
import { validateStreetliftingSubmissionWeights } from "@/lib/streetliftingSubmissionLimits";

type Filters = {
    exerciseType: "all" | "weighted_pullup" | "weighted_dips";
    gender: "all" | "Male" | "Female";
    pullupType: "all" | "Overhand" | "Underhand";
    formQuality: "all" | StreetliftingSubmission["form_quality"];
    hasVideo: "all" | "with_video" | "without_video";
    search: string;
};

type SortBy = "date" | "weight" | "score";

function qualityLabel(quality: StreetliftingSubmission["form_quality"]) {
    switch (quality) {
        case "Competition":
            return "比赛级";
        case "Minor_Cheat":
            return "轻微借力";
        case "Major_Cheat":
            return "严重借力";
        case "Extreme_Cheat":
            return "超严重借力";
        default:
            return quality;
    }
}

export default function StreetliftingDataPage() {
    const router = useRouter();
    const { showToast } = useToastContext();
    const { data: session } = useSession();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [claimingIds, setClaimingIds] = useState<Set<string>>(new Set());

    const [submissions, setSubmissions] = useState<StreetliftingSubmission[]>([]);
    const [formulaMap, setFormulaMap] = useState<Record<string, StreetliftingFormula>>({});

    const [filters, setFilters] = useState<Filters>({
        exerciseType: "all",
        gender: "all",
        pullupType: "all",
        formQuality: "all",
        hasVideo: "all",
        search: "",
    });
    const [sortBy, setSortBy] = useState<SortBy>("weight");

    const [formOpen, setFormOpen] = useState(false);
    const [profileLocked, setProfileLocked] = useState(false);
    const [claimDialogOpen, setClaimDialogOpen] = useState(false);
    const [claimingSubmissionId, setClaimingSubmissionId] = useState<string | null>(null);
    const [existingSubmission, setExistingSubmission] = useState<{
        id: string;
        created_at: string;
        exercise_type: string;
        bodyweight: number;
        added_weight: number;
        reps: number;
    } | null>(null);
    const [form, setForm] = useState<{
        exercise_type: "weighted_pullup" | "weighted_dips";
        gender: "" | "Male" | "Female";
        bodyweight: number | null;
        added_weight: number | null;
        reps: number | null;
        form_quality: "" | StreetliftingCreateSubmissionDto["form_quality"];
        penalty_weight: number;
        user_name: string;
        video_url: string;
        pullup_type: "" | "Overhand" | "Underhand";
    }>({
        exercise_type: "weighted_pullup",
        gender: "",
        bodyweight: null,
        added_weight: null,
        reps: null,
        form_quality: "",
        penalty_weight: 3,
        user_name: "",
        video_url: "",
        pullup_type: "",
    });

    const showPenalty = ["Minor_Cheat", "Major_Cheat", "Extreme_Cheat"].includes(form.form_quality);
    const penaltyRange =
        form.form_quality === "Minor_Cheat"
            ? [2, 5]
            : form.form_quality === "Major_Cheat"
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
    const textInputClassName =
        "w-full h-10 rounded-2xl border border-surface-200 bg-surface-0 px-3 text-sm font-semibold text-surface-800 placeholder:text-surface-400 focus:outline-none focus:border-primary-200";

    useEffect(() => {
        const run = async () => {
            setLoading(true);
            try {
                const [subData, formulaData] = await Promise.all([
                    streetliftingIndexService.listSubmissions(),
                    streetliftingIndexService.listFormulas(),
                ]);
                setSubmissions(subData?.submissions || []);
                const next: Record<string, StreetliftingFormula> = {};
                (formulaData?.formulas || []).forEach((f) => {
                    next[`${f.gender}`] = f;
                });
                setFormulaMap(next);
            } catch (e: any) {
                console.error("[streetlifting-index][data] init error:", e);
                showToast({ severity: "warn", summary: "提示", detail: e?.message || "数据加载失败" });
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [showToast]);

    useEffect(() => {
        // 惩罚重量自动归位
        if (form.form_quality === "Minor_Cheat") {
            if (form.penalty_weight < 2 || form.penalty_weight > 5) setForm((p) => ({ ...p, penalty_weight: 3 }));
        } else if (form.form_quality === "Major_Cheat") {
            if (form.penalty_weight < 5 || form.penalty_weight > 20) setForm((p) => ({ ...p, penalty_weight: 10 }));
        } else if (form.form_quality === "Extreme_Cheat") {
            if (form.penalty_weight < 20 || form.penalty_weight > 50) setForm((p) => ({ ...p, penalty_weight: 30 }));
        }
    }, [form.form_quality]);

    const computeScore = (s: StreetliftingSubmission) => {
        const f = formulaMap[`${s.gender}`];
        if (!f) return 0;
        // 兼容：后端可能返回 string（避免 `70 + 30` 变成 "7030" 导致 isFinite 失败）
        const bodyweight = Number((s as any).bodyweight);
        const addedWeight = Number((s as any).added_weight);
        const reps = Number((s as any).reps);
        const penaltyWeight = Number((s as any).penalty_weight ?? 0);

        if (!Number.isFinite(bodyweight) || bodyweight <= 0) return 0;
        if (!Number.isFinite(addedWeight)) return 0;
        if (!Number.isFinite(reps) || reps < 1 || reps > 36) return 0;
        if (!Number.isFinite(penaltyWeight) || penaltyWeight < 0) return 0;

        const total1rm = bodyweight + calculateAdded1RM(bodyweight, addedWeight, reps, penaltyWeight);
        if (!Number.isFinite(total1rm) || total1rm <= 0) return 0;

        const coeff = computeCoefficient(bodyweight, f);
        if (!Number.isFinite(coeff) || coeff <= 0) return 0;
        const raw = total1rm * coeff;
        return s.exercise_type === "weighted_dips" ? raw / 1.3 : raw;
    };

    const compute1RM = (s: StreetliftingSubmission) => {
        const bodyweight = Number((s as any).bodyweight);
        const addedWeight = Number((s as any).added_weight);
        const reps = Number((s as any).reps);
        const penaltyWeight = Number((s as any).penalty_weight ?? 0);
        if (!Number.isFinite(bodyweight) || !Number.isFinite(addedWeight) || !Number.isFinite(reps) || !Number.isFinite(penaltyWeight)) return 0;
        return calculateAdded1RM(bodyweight, addedWeight, reps, penaltyWeight);
    };

    const filtered = useMemo(() => {
        let arr = [...submissions];
        if (filters.exerciseType !== "all") arr = arr.filter((s) => s.exercise_type === filters.exerciseType);
        if (filters.gender !== "all") arr = arr.filter((s) => s.gender === filters.gender);
        if (filters.pullupType !== "all") arr = arr.filter((s) => s.pullup_type === filters.pullupType);
        if (filters.formQuality !== "all") arr = arr.filter((s) => s.form_quality === filters.formQuality);
        if (filters.hasVideo !== "all") {
            arr = arr.filter((s) => {
                const has = !!(s.video_url && s.video_url.trim());
                return filters.hasVideo === "with_video" ? has : !has;
            });
        }
        if (filters.search.trim()) {
            const q = filters.search.trim().toLowerCase();
            arr = arr.filter((s) => (s.user_name || "").toLowerCase().includes(q));
        }

        if (sortBy === "date") {
            arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } else if (sortBy === "weight") {
            arr.sort((a, b) => compute1RM(b) - compute1RM(a));
        } else {
            arr.sort((a, b) => computeScore(b) - computeScore(a));
        }
        return arr;
    }, [filters, sortBy, submissions]);

    const stats = useMemo(() => {
        return {
            total: filtered.length,
            withVideo: filtered.filter((s) => !!s.video_url).length,
            pullup: filtered.filter((s) => s.exercise_type === "weighted_pullup").length,
            dips: filtered.filter((s) => s.exercise_type === "weighted_dips").length,
        };
    }, [filtered]);

    const resetForm = () => {
        setProfileLocked(false);
        setForm({
            exercise_type: "weighted_pullup",
            gender: "",
            bodyweight: null,
            added_weight: null,
            reps: null,
            form_quality: "",
            penalty_weight: 3,
            user_name: "",
            video_url: "",
            pullup_type: "",
        });
    };

    const normalizeGender = (raw: any): "" | "Male" | "Female" => {
        const s = String(raw || "").toLowerCase();
        if (!s) return "";
        if (s.includes("male") || s.includes("man") || s.includes("男")) return "Male";
        if (s.includes("female") || s.includes("woman") || s.includes("女")) return "Female";
        return "";
    };

    const openSubmitDialog = async () => {
        if (!session?.user?.id) {
            showToast({ severity: "warn", summary: "请先登录", detail: "登录后才能提交数据" });
            return;
        }
        try {
            const profileData = await studentService.getStudentProfile();
            const profile = (profileData as any)?.profile || null;
            const gender = normalizeGender(profile?.gender);
            const weight = typeof profile?.weight === "number" && Number.isFinite(profile.weight) ? profile.weight : null;

            if (!gender || !weight) {
                showToast({
                    severity: "warn",
                    summary: "请先完善个人档案",
                    detail: "需要从档案读取性别与体重后才能提交数据",
                });
                return;
            }

            setProfileLocked(true);
            setForm((p) => ({
                ...p,
                user_name: p.user_name || (session?.user?.name as any) || "",
                gender,
                bodyweight: weight,
            }));
            setFormOpen(true);
        } catch (e: any) {
            showToast({ severity: "warn", summary: "读取档案失败", detail: e?.message || "请稍后重试" });
        }
    };

    const handleSubmit = async () => {
        try {
            if (!session?.user?.id) {
                showToast({ severity: "warn", summary: "请先登录", detail: "登录后才能提交数据" });
                return;
            }
            setSubmitting(true);

            if (!form.gender) throw new Error("请选择性别");
            if (!Number.isFinite(form.bodyweight ?? NaN) || (form.bodyweight as number) <= 0) throw new Error("请填写有效体重");
            if (!Number.isFinite(form.added_weight ?? NaN)) throw new Error("请填写有效负重");
            const weightCheck = validateStreetliftingSubmissionWeights(
                form.bodyweight as number,
                form.added_weight as number,
            );
            if (!weightCheck.ok) throw new Error(weightCheck.message);
            if (!Number.isFinite(form.reps ?? NaN) || (form.reps as number) < 1 || (form.reps as number) > 36) throw new Error("次数必须在1-36之间");
            if (!form.form_quality) throw new Error("请选择动作质量");
            if (form.exercise_type === "weighted_pullup" && !form.pullup_type) throw new Error("负重引体需要选择引体类型");

            const dto: StreetliftingCreateSubmissionDto = {
                gender: form.gender,
                bodyweight: form.bodyweight as number,
                added_weight: form.added_weight as number,
                reps: form.reps as number,
                form_quality: form.form_quality,
                penalty_weight: showPenalty ? form.penalty_weight : 0,
                user_name: form.user_name?.trim() || null,
                video_url: form.video_url?.trim() || null,
                pullup_type: form.exercise_type === "weighted_pullup" ? (form.pullup_type as any) : null,
                exercise_type: form.exercise_type,
            };

            await streetliftingIndexService.createSubmission(dto);

            showToast({ severity: "success", summary: "提交成功", detail: "感谢你的贡献！" });
            setFormOpen(false);
            resetForm();

            const data = await streetliftingIndexService.listSubmissions();
            setSubmissions(data?.submissions || []);

            router.push("/streetlifting-index/submit/success");
        } catch (e: any) {
            showToast({ severity: "warn", summary: "提交失败", detail: e?.message || "请稍后重试" });
        } finally {
            setSubmitting(false);
        }
    };

    const activeFiltersCount = useMemo(() => {
        return Object.entries(filters).filter(([k, v]) => k !== "search" && v !== "all" && v !== "").length;
    }, [filters]);

    const handleClaimClick = async (submissionId: string) => {
        if (!session?.user?.id) {
            showToast({ severity: "warn", summary: "请先登录", detail: "登录后才能认领数据" });
            return;
        }

        // 检查用户是否已有数据
        try {
            const checkResult = await streetliftingIndexService.checkExistingSubmission();
            if (checkResult?.hasExisting && checkResult.existingSubmission) {
                setExistingSubmission(checkResult.existingSubmission);
                setClaimingSubmissionId(submissionId);
                setClaimDialogOpen(true);
            } else {
                // 没有已有数据，直接认领
                await handleClaim(submissionId);
            }
        } catch (e: any) {
            console.error("[streetlifting-index][data] check-existing error:", e);
            // 如果检查失败，仍然尝试认领
            await handleClaim(submissionId);
        }
    };

    const handleClaim = async (submissionId: string) => {
        if (!session?.user?.id) {
            showToast({ severity: "warn", summary: "请先登录", detail: "登录后才能认领数据" });
            return;
        }

        setClaimDialogOpen(false);
        setClaimingIds((prev) => new Set(prev).add(submissionId));
        try {
            await streetliftingIndexService.claimSubmission({ submission_id: submissionId });
            showToast({ severity: "success", summary: "认领成功", detail: "数据已成功认领到你的账户" });

            // 刷新数据
            const data = await streetliftingIndexService.listSubmissions();
            setSubmissions(data?.submissions || []);
        } catch (e: any) {
            console.error("[streetlifting-index][data] claim error:", e);
            showToast({ severity: "warn", summary: "认领失败", detail: e?.message || "请稍后重试" });
        } finally {
            setClaimingIds((prev) => {
                const next = new Set(prev);
                next.delete(submissionId);
                return next;
            });
            setClaimingSubmissionId(null);
            setExistingSubmission(null);
        }
    };

    return (
        <div className={`${AERO_CONTAINER_7XL} py-6 space-y-6`}>
                <Card className={AERO_CARD}>
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <div className={AERO_TITLE}>数据提交与社区排行</div>
                                <div className={AERO_SUBTITLE}>提交你的训练数据，或浏览社区数据（按 1RM / 力量分排序）。</div>
                            </div>
                            <Button
                                label="提交我的数据"
                                icon="pi pi-plus"
                                className="h-10 rounded-2xl bg-surface-900 border-none text-surface-0 text-sm font-black hover:bg-surface-800 shadow-sm shadow-primary-100/60 hover:shadow-primary-100 active:scale-[0.98] transition-all"
                                onClick={openSubmitDialog}
                            />
                        </div>

                        {/* 统计条 */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="rounded-2xl border border-surface-100 bg-surface-50 p-4">
                                        <Skeleton width="50%" height="1.4rem" />
                                        <Skeleton width="70%" height="0.9rem" className="mt-2" />
                                    </div>
                                ))
                            ) : (
                                <>
                                    <div className="rounded-2xl border border-surface-100 bg-surface-50 p-4">
                                        <div className="flex items-baseline justify-between">
                                            <div className="text-2xl font-black text-surface-900">{stats.total}</div>
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-500" />
                                        </div>
                                        <div className="text-xs text-surface-500 mt-1">筛选结果</div>
                                    </div>
                                    <div className="rounded-2xl border border-surface-100 bg-surface-50 p-4">
                                        <div className="text-2xl font-black text-surface-900">{stats.withVideo}</div>
                                        <div className="text-xs text-surface-500 mt-1">包含视频</div>
                                    </div>
                                    <div className="rounded-2xl border border-surface-100 bg-surface-50 p-4">
                                        <div className="text-2xl font-black text-surface-900">{stats.pullup}</div>
                                        <div className="text-xs text-surface-500 mt-1">负重引体</div>
                                    </div>
                                    <div className="rounded-2xl border border-surface-100 bg-surface-50 p-4">
                                        <div className="text-2xl font-black text-surface-900">{stats.dips}</div>
                                        <div className="text-xs text-surface-500 mt-1">负重臂屈伸</div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </Card>

                {/* 筛选 */}
                <Card className={AERO_CARD}>
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-surface-900 font-semibold">
                                <Filter className="h-5 w-5 text-surface-500" />
                                筛选与排序
                            </div>
                            {activeFiltersCount > 0 && (
                                <Button
                                    text
                                    severity="secondary"
                                    size="small"
                                    label={`重置（${activeFiltersCount}）`}
                                    className="rounded-2xl text-surface-600 hover:text-surface-900 active:scale-[0.98] transition-all"
                                    onClick={() =>
                                        setFilters({
                                            exerciseType: "all",
                                            gender: "all",
                                            pullupType: "all",
                                            formQuality: "all",
                                            hasVideo: "all",
                                            search: "",
                                        })
                                    }
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
                            <Dropdown
                                value={filters.exerciseType}
                                options={[
                                    { label: "全部动作", value: "all" },
                                    { label: "负重引体", value: "weighted_pullup" },
                                    { label: "负重臂屈伸", value: "weighted_dips" },
                                ]}
                                optionLabel="label"
                                optionValue="value"
                                className={dropdownClassName}
                                panelClassName={dropdownPanelClassName}
                                dropdownIcon={dropdownIcon}
                                pt={dropdownPt}
                                valueTemplate={renderAeroDropdownValue}
                                itemTemplate={makeAeroDropdownItemTemplate(filters.exerciseType)}
                                onChange={(e) => setFilters((p) => ({ ...p, exerciseType: e.value }))}
                                placeholder="动作"
                            />
                            <Dropdown
                                value={filters.gender}
                                options={[
                                    { label: "全部性别", value: "all" },
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
                                itemTemplate={makeAeroDropdownItemTemplate(filters.gender)}
                                onChange={(e) => setFilters((p) => ({ ...p, gender: e.value }))}
                                placeholder="性别"
                            />
                            <Dropdown
                                value={filters.pullupType}
                                options={[
                                    { label: "全部握法", value: "all" },
                                    { label: "正手", value: "Overhand" },
                                    { label: "反手", value: "Underhand" },
                                ]}
                                optionLabel="label"
                                optionValue="value"
                                className={dropdownClassName}
                                panelClassName={dropdownPanelClassName}
                                dropdownIcon={dropdownIcon}
                                pt={dropdownPt}
                                valueTemplate={renderAeroDropdownValue}
                                itemTemplate={makeAeroDropdownItemTemplate(filters.pullupType)}
                                onChange={(e) => setFilters((p) => ({ ...p, pullupType: e.value }))}
                                placeholder="握法"
                            />
                            <Dropdown
                                value={filters.formQuality}
                                options={[
                                    { label: "全部质量", value: "all" },
                                    { label: "比赛级", value: "Competition" },
                                    { label: "轻微借力", value: "Minor_Cheat" },
                                    { label: "严重借力", value: "Major_Cheat" },
                                    { label: "超严重借力", value: "Extreme_Cheat" },
                                ]}
                                optionLabel="label"
                                optionValue="value"
                                className={dropdownClassName}
                                panelClassName={dropdownPanelClassName}
                                dropdownIcon={dropdownIcon}
                                pt={dropdownPt}
                                valueTemplate={renderAeroDropdownValue}
                                itemTemplate={makeAeroDropdownItemTemplate(filters.formQuality)}
                                onChange={(e) => setFilters((p) => ({ ...p, formQuality: e.value }))}
                                placeholder="质量"
                            />
                            <Dropdown
                                value={filters.hasVideo}
                                options={[
                                    { label: "全部视频", value: "all" },
                                    { label: "有视频", value: "with_video" },
                                    { label: "无视频", value: "without_video" },
                                ]}
                                optionLabel="label"
                                optionValue="value"
                                className={dropdownClassName}
                                panelClassName={dropdownPanelClassName}
                                dropdownIcon={dropdownIcon}
                                pt={dropdownPt}
                                valueTemplate={renderAeroDropdownValue}
                                itemTemplate={makeAeroDropdownItemTemplate(filters.hasVideo)}
                                onChange={(e) => setFilters((p) => ({ ...p, hasVideo: e.value }))}
                                placeholder="视频"
                            />
                            <Dropdown
                                value={sortBy}
                                options={[
                                    { label: "按 1RM", value: "weight" },
                                    { label: "按 力量分", value: "score" },
                                    { label: "按 时间", value: "date" },
                                ]}
                                optionLabel="label"
                                optionValue="value"
                                className={dropdownClassName}
                                panelClassName={dropdownPanelClassName}
                                dropdownIcon={dropdownIcon}
                                pt={dropdownPt}
                                valueTemplate={renderAeroDropdownValue}
                                itemTemplate={makeAeroDropdownItemTemplate(sortBy)}
                                onChange={(e) => setSortBy(e.value)}
                                placeholder="排序"
                            />
                        </div>

                        <div className="flex gap-3 items-center">
                            <IconField iconPosition="left" className="w-full group">
                                <InputIcon className="z-10 text-surface-400 group-focus-within:text-primary-500 transition-colors">
                                    <Search size={18} strokeWidth={2.5} />
                                </InputIcon>
                                <InputText
                                    value={filters.search}
                                    onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                                    className={`${textInputClassName} pl-11`}
                                    placeholder="搜索用户名（可选）"
                                />
                            </IconField>
                        </div>
                    </div>
                </Card>

                {/* 列表 */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: 9 }).map((_, i) => (
                            <Card key={i} className={AERO_CARD}>
                                <div className="p-4 space-y-3">
                                    <Skeleton width="45%" height="1rem" />
                                    <Skeleton width="70%" height="0.8rem" />
                                    <Skeleton width="100%" height="3.5rem" />
                                    <Skeleton width="60%" height="1.2rem" />
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="rounded-2xl border border-surface-100 bg-surface-0 p-10 text-center text-surface-500">
                        <div className="text-base font-semibold text-surface-900 mb-2">没有找到符合条件的数据</div>
                        <div className="text-sm">你可以调整筛选，或提交一条新数据。</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((s) => {
                            const rm = compute1RM(s);
                            const score = computeScore(s);
                            const q = qualityLabel(s.form_quality);
                            return (
                                <Card key={s.id} className={AERO_CARD}>
                                    <div className="p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2 text-xs text-surface-600 min-w-0 flex-1">
                                                <User className="h-4 w-4 shrink-0" />
                                                <span className="max-w-[160px] truncate text-surface-900 font-medium">
                                                    {s.user_name || "匿名"}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {!s.user_id && (
                                                    <Button
                                                        text
                                                        size="small"
                                                        className="!h-8 !px-2 rounded-xl text-surface-600 hover:text-primary-600 hover:bg-primary-50 active:scale-[0.95] transition-all flex items-center gap-1.5"
                                                        onClick={() => handleClaimClick(s.id)}
                                                        disabled={claimingIds.has(s.id)}
                                                        tooltip="数据认领"
                                                    >
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        <span className="text-xs font-medium hidden sm:inline">认领</span>
                                                    </Button>
                                                )}
                                                {s.video_url && (
                                                    <Button
                                                        text
                                                        size="small"
                                                        className="!h-8 !px-2 rounded-xl text-surface-600 hover:text-primary-600 hover:bg-primary-50 active:scale-[0.95] transition-all flex items-center gap-1.5"
                                                        onClick={() => window.open(s.video_url || "", "_blank")}
                                                        tooltip="观看视频"
                                                    >
                                                        <Video className="h-4 w-4" />
                                                        <span className="text-xs font-medium hidden sm:inline">视频</span>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <span className="inline-flex items-center rounded-full bg-surface-50 border border-surface-100 px-2.5 py-1 text-[11px] font-bold text-surface-600">
                                                {s.gender === "Male" ? "男" : "女"}
                                            </span>
                                            <span className="inline-flex items-center rounded-full bg-surface-50 border border-surface-100 px-2.5 py-1 text-[11px] font-bold text-surface-600">
                                                {s.exercise_type === "weighted_pullup" ? "负重引体" : "负重臂屈伸"}
                                            </span>
                                            {s.pullup_type && (
                                                <span className="inline-flex items-center rounded-full bg-surface-50 border border-surface-100 px-2.5 py-1 text-[11px] font-bold text-surface-600">
                                                    {s.pullup_type === "Overhand" ? "正手" : "反手"}
                                                </span>
                                            )}
                                            <span className="inline-flex items-center rounded-full bg-surface-0 border border-surface-200 px-2.5 py-1 text-[11px] font-bold text-surface-700">
                                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-500 mr-2" />
                                                {q}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-4 gap-2 text-center">
                                            {[
                                                { k: "体重", v: `${s.bodyweight}kg` },
                                                { k: "负重", v: `${s.added_weight}kg` },
                                                { k: "次数", v: `${s.reps}` },
                                                { k: "1RM", v: `${rm.toFixed(1)}` },
                                            ].map((x) => (
                                                <div key={x.k} className="rounded-2xl border border-surface-100 bg-surface-50 p-2">
                                                    <div className="text-[11px] text-surface-500">{x.k}</div>
                                                    <div className="text-sm font-semibold text-surface-900">{x.v}</div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="rounded-2xl border border-primary-200/60 bg-surface-0 p-3 text-center">
                                            <div className="text-[11px] text-surface-600">力量分</div>
                                            <div className="text-xl font-black text-primary-700">{score.toFixed(1)}</div>
                                        </div>

                                        {s.penalty_weight > 0 && (
                                            <div className="text-xs text-surface-700 bg-surface-50 border border-surface-200 rounded-2xl p-2 text-center">
                                                惩罚：<span className="font-bold text-surface-900">-{s.penalty_weight}kg</span>
                                            </div>
                                        )}

                                        <div className="text-[11px] text-surface-400 text-center">
                                            {new Date(s.created_at).toLocaleDateString("zh-CN", {
                                                month: "short",
                                                day: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}

            {/* 移动端浮动按钮 */}
            <Button
                className="md:hidden fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+6.25rem)] z-40 h-14 w-14 !rounded-full bg-surface-900 border-none text-surface-0 shadow-lg shadow-primary-100/60 active:scale-[0.98] transition-all"
                icon="pi pi-plus"
                onClick={openSubmitDialog}
            />

            {/* 提交表单 */}
            <Dialog
                header="提交我的数据"
                visible={formOpen}
                onHide={() => {
                    setFormOpen(false);
                    resetForm();
                }}
                className="aero-dialog w-[95vw] md:w-[32rem]"
                draggable={false}
                style={{ maxHeight: "90vh" }}
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                        <div>
                            <div className="text-xs text-surface-500 mb-1.5">运动类型</div>
                            <Dropdown
                                value={form.exercise_type}
                                options={[
                                    { label: "💪 负重引体向上", value: "weighted_pullup" },
                                    { label: "💪 负重双杠臂屈伸", value: "weighted_dips" },
                                ]}
                                optionLabel="label"
                                optionValue="value"
                                className={dropdownClassName}
                                panelClassName={dropdownPanelClassName}
                                dropdownIcon={dropdownIcon}
                                pt={dropdownPt}
                                valueTemplate={renderAeroDropdownValue}
                                itemTemplate={makeAeroDropdownItemTemplate(form.exercise_type)}
                                onChange={(e) => setForm((p) => ({ ...p, exercise_type: e.value, pullup_type: "" }))}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
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
                                    disabled={profileLocked}
                                    onChange={(e) => setForm((p) => ({ ...p, gender: e.value }))}
                                />
                                {profileLocked && (
                                    <div className="mt-1 text-[12px] text-surface-500/50">已从登录用户档案自动读取</div>
                                )}
                            </div>
                            <div>
                                <div className="text-xs text-surface-500 mb-1.5">体重（kg）</div>
                                <AeroInputNumber
                                    value={form.bodyweight}
                                    onValueChange={(e) => setForm((p) => ({ ...p, bodyweight: e.value ?? null }))}
                                    className="w-full"
                                    inputClassName={numberInputClassName}
                                    disabled={profileLocked}
                                    min={1}
                                    maxFractionDigits={1}
                                />
                                {profileLocked && (
                                    <div className="mt-1 text-[12px] text-surface-500/50">已从登录用户档案自动读取</div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-xs text-surface-500 mb-1.5">附加负重（kg）</div>
                                <AeroInputNumber
                                    value={form.added_weight}
                                    onValueChange={(e) => setForm((p) => ({ ...p, added_weight: e.value ?? null }))}
                                    className="w-full"
                                    inputClassName={numberInputClassName}
                                    maxFractionDigits={1}
                                />
                            </div>
                            <div>
                                <div className="text-xs text-surface-500 mb-1.5">完成次数</div>
                                <AeroInputNumber
                                    value={form.reps}
                                    onValueChange={(e) => setForm((p) => ({ ...p, reps: e.value ?? null }))}
                                    className="w-full"
                                    inputClassName={numberInputClassName}
                                    min={1}
                                    max={36}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="text-xs text-surface-500 mb-1.5">动作质量</div>
                            <Dropdown
                                value={form.form_quality}
                                options={[
                                    { label: "比赛级标准", value: "Competition" },
                                    { label: "轻微借力（2-5kg）", value: "Minor_Cheat" },
                                    { label: "严重借力（5-20kg）", value: "Major_Cheat" },
                                    { label: "超严重借力（20-50kg）", value: "Extreme_Cheat" },
                                ]}
                                optionLabel="label"
                                optionValue="value"
                                className={dropdownClassName}
                                panelClassName={dropdownPanelClassName}
                                dropdownIcon={dropdownIcon}
                                pt={dropdownPt}
                                valueTemplate={renderAeroDropdownValue}
                                itemTemplate={makeAeroDropdownItemTemplate(form.form_quality)}
                                onChange={(e) => setForm((p) => ({ ...p, form_quality: e.value }))}
                            />
                        </div>

                        {form.exercise_type === "weighted_pullup" && (
                            <div>
                                <div className="text-xs text-surface-500 mb-1.5">引体类型</div>
                                <Dropdown
                                    value={form.pullup_type}
                                    options={[
                                        { label: "正手", value: "Overhand" },
                                        { label: "反手", value: "Underhand" },
                                    ]}
                                    optionLabel="label"
                                    optionValue="value"
                                    className={dropdownClassName}
                                    panelClassName={dropdownPanelClassName}
                                    dropdownIcon={dropdownIcon}
                                    pt={dropdownPt}
                                    valueTemplate={renderAeroDropdownValue}
                                    itemTemplate={makeAeroDropdownItemTemplate(form.pullup_type)}
                                    onChange={(e) => setForm((p) => ({ ...p, pullup_type: e.value }))}
                                />
                            </div>
                        )}

                        {showPenalty && (
                            <div className="rounded-2xl border border-surface-100 bg-surface-50 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-medium text-surface-900">
                                        惩罚重量：{form.penalty_weight} kg
                                    </div>
                                    <div className="text-xs text-surface-500">
                                        {penaltyRange[0]} - {penaltyRange[1]} kg
                                    </div>
                                </div>
                                <Slider
                                    value={form.penalty_weight}
                                    onChange={(e) => setForm((p) => ({ ...p, penalty_weight: Number(e.value) }))}
                                    min={penaltyRange[0]}
                                    max={penaltyRange[1]}
                                    step={0.5}
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-3">
                            <div>
                                <div className="text-xs text-surface-500 mb-1.5">姓名/社媒账号（选填）</div>
                                <InputText
                                    value={form.user_name}
                                    onChange={(e) => setForm((p) => ({ ...p, user_name: e.target.value }))}
                                    className={textInputClassName}
                                    placeholder="张三 或 @your_handle"
                                />
                            </div>
                            <div>
                                <div className="text-xs text-surface-500 mb-1.5">视频链接（选填）</div>
                                <InputText
                                    value={form.video_url}
                                    onChange={(e) => setForm((p) => ({ ...p, video_url: e.target.value }))}
                                    className={textInputClassName}
                                    placeholder="https://..."
                                />
                            </div>
                        </div>

                        <Button
                            label={submitting ? "提交中..." : "提交数据"}
                            disabled={submitting}
                            className="w-full h-10 rounded-2xl bg-surface-900 border-none text-surface-0 text-sm font-black hover:bg-surface-800 shadow-sm shadow-primary-100/60 hover:shadow-primary-100 active:scale-[0.98] transition-all"
                            onClick={handleSubmit}
                        />
                    </div>
                </div>
            </Dialog>

            {/* 认领确认对话框 */}
            <Dialog
                header="确认认领数据"
                visible={claimDialogOpen}
                onHide={() => {
                    setClaimDialogOpen(false);
                    setClaimingSubmissionId(null);
                    setExistingSubmission(null);
                }}
                className="aero-dialog w-[95vw] md:w-[28rem]"
                draggable={false}
            >
                <div className="space-y-4">
                    <div className="text-sm text-surface-700">
                        {existingSubmission ? (
                            <>
                                <p className="mb-3 font-semibold text-surface-900">⚠️ 你已有认领的数据，认领新数据将覆盖现有数据：</p>
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-3">
                                    <div className="text-xs text-amber-800 space-y-1">
                                        <div>动作：{existingSubmission.exercise_type === "weighted_pullup" ? "负重引体" : "负重臂屈伸"}</div>
                                        <div>体重：{existingSubmission.bodyweight}kg</div>
                                        <div>负重：{existingSubmission.added_weight}kg</div>
                                        <div>次数：{existingSubmission.reps}</div>
                                        <div className="text-amber-600 mt-2">
                                            提交时间：{new Date(existingSubmission.created_at).toLocaleDateString("zh-CN")}
                                        </div>
                                    </div>
                                </div>
                                <p className="text-surface-600">确定要用新数据替换现有数据吗？此操作不可撤销。</p>
                            </>
                        ) : (
                            <p>确定要认领这条数据吗？</p>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button
                            label="取消"
                            outlined
                            severity="secondary"
                            className="flex-1 h-10 rounded-2xl"
                            onClick={() => {
                                setClaimDialogOpen(false);
                                setClaimingSubmissionId(null);
                                setExistingSubmission(null);
                            }}
                        />
                        <Button
                            label="确认认领"
                            className="flex-1 h-10 rounded-2xl bg-surface-900 border-none text-surface-0 text-sm font-black hover:bg-surface-800 active:scale-[0.98] transition-all"
                            onClick={() => {
                                if (claimingSubmissionId) {
                                    handleClaim(claimingSubmissionId);
                                }
                            }}
                            disabled={!claimingSubmissionId || claimingIds.has(claimingSubmissionId)}
                        />
                    </div>
                </div>
            </Dialog>
        </div>
    );
}

