"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Filter, Plus, User, Video } from "lucide-react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Skeleton } from "primereact/skeleton";
import { Tag } from "primereact/tag";
import { Slider } from "primereact/slider";

import { useToastContext } from "@/context/ToastContext";
import { streetliftingIndexService } from "@/app/service/streetliftingIndexService";

import type { StreetliftingFormula } from "@/app/api/streetlifting-index/formulas/list/entity";
import type { StreetliftingSubmission } from "@/app/api/streetlifting-index/submissions/list/entity";
import type { StreetliftingCreateSubmissionDto } from "@/app/api/streetlifting-index/submissions/create/entity";
import { calculateAdded1RM, computeCoefficient } from "@/app/streetlifting-index/_utils";
import { AERO_CARD, AERO_CONTAINER_7XL, AERO_SUBTITLE, AERO_TITLE } from "@/components/streetlifting-index/aero";

type Filters = {
    exerciseType: "all" | "weighted_pullup" | "weighted_dips";
    gender: "all" | "Male" | "Female";
    pullupType: "all" | "Overhand" | "Underhand";
    formQuality: "all" | StreetliftingSubmission["form_quality"];
    hasVideo: "all" | "with_video" | "without_video";
    search: string;
};

type SortBy = "date" | "weight" | "score";

function qualityTag(quality: StreetliftingSubmission["form_quality"]) {
    switch (quality) {
        case "Competition":
            return { severity: "success" as const, label: "比赛级" };
        case "Minor_Cheat":
            return { severity: "warning" as const, label: "轻微借力" };
        case "Major_Cheat":
            return { severity: "danger" as const, label: "严重借力" };
        case "Extreme_Cheat":
            return { severity: "danger" as const, label: "超严重借力" };
        default:
            return { severity: "info" as const, label: quality };
    }
}

export default function StreetliftingDataPage() {
    const router = useRouter();
    const { showToast } = useToastContext();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

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
                    next[`${f.gender}:${f.exercise_type}`] = f;
                });
                setFormulaMap(next);
            } catch (e: any) {
                console.error("[streetlifting-index][data] init error:", e);
                showToast({ severity: "warn", summary: "提示", detail: "数据加载失败" });
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
        const f = formulaMap[`${s.gender}:${s.exercise_type}`];
        if (!f) return 0;
        const total1rm = s.bodyweight + calculateAdded1RM(s.bodyweight, s.added_weight, s.reps, s.penalty_weight);
        if (!Number.isFinite(total1rm) || total1rm <= 0) return 0;
        const coeff = computeCoefficient(s.bodyweight, f);
        const raw = total1rm * coeff;
        return s.exercise_type === "weighted_dips" ? raw / 1.3 : raw;
    };

    const compute1RM = (s: StreetliftingSubmission) => {
        return calculateAdded1RM(s.bodyweight, s.added_weight, s.reps, s.penalty_weight);
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

    const handleSubmit = async () => {
        try {
            setSubmitting(true);

            if (!form.gender) throw new Error("请选择性别");
            if (!Number.isFinite(form.bodyweight ?? NaN) || (form.bodyweight as number) <= 0) throw new Error("请填写有效体重");
            if (!Number.isFinite(form.added_weight ?? NaN)) throw new Error("请填写有效负重");
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
                                onClick={() => setFormOpen(true)}
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
                                        <div className="text-2xl font-bold text-primary-700">{stats.total}</div>
                                        <div className="text-xs text-surface-500 mt-1">筛选结果</div>
                                    </div>
                                    <div className="rounded-2xl border border-surface-100 bg-surface-50 p-4">
                                        <div className="text-2xl font-bold text-green-600">{stats.withVideo}</div>
                                        <div className="text-xs text-surface-500 mt-1">包含视频</div>
                                    </div>
                                    <div className="rounded-2xl border border-surface-100 bg-surface-50 p-4">
                                        <div className="text-2xl font-bold text-blue-600">{stats.pullup}</div>
                                        <div className="text-xs text-surface-500 mt-1">负重引体</div>
                                    </div>
                                    <div className="rounded-2xl border border-surface-100 bg-surface-50 p-4">
                                        <div className="text-2xl font-bold text-orange-600">{stats.dips}</div>
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
                                <Filter className="h-5 w-5 text-primary-600" />
                                筛选与排序
                            </div>
                            {activeFiltersCount > 0 && (
                                <Button
                                    text
                                    size="small"
                                    label={`重置（${activeFiltersCount}）`}
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
                                className="w-full"
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
                                className="w-full"
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
                                className="w-full"
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
                                className="w-full"
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
                                className="w-full"
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
                                className="w-full"
                                onChange={(e) => setSortBy(e.value)}
                                placeholder="排序"
                            />
                        </div>

                        <div className="flex gap-3 items-center">
                            <span className="p-input-icon-left flex-1">
                                <i className="pi pi-search" />
                                <InputText
                                    value={filters.search}
                                    onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                                    className="w-full"
                                    placeholder="搜索用户名（可选）"
                                />
                            </span>
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
                            const q = qualityTag(s.form_quality);
                            return (
                                <Card key={s.id} className={AERO_CARD}>
                                    <div className="p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-xs text-surface-600">
                                                <User className="h-4 w-4" />
                                                <span className="max-w-[160px] truncate text-surface-900 font-medium">
                                                    {s.user_name || "匿名"}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Tag severity={s.gender === "Male" ? "info" : "success"} value={s.gender === "Male" ? "男" : "女"} />
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Tag
                                                severity={s.exercise_type === "weighted_pullup" ? "info" : "warning"}
                                                value={s.exercise_type === "weighted_pullup" ? "负重引体" : "负重臂屈伸"}
                                            />
                                            {s.pullup_type && <Tag value={s.pullup_type === "Overhand" ? "正手" : "反手"} />}
                                            <Tag severity={q.severity} value={q.label} />
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

                                        <div className="rounded-2xl border border-surface-100 bg-primary-50 p-3 text-center">
                                            <div className="text-[11px] text-surface-600">力量分</div>
                                            <div className="text-xl font-bold text-primary-700">{score.toFixed(1)}</div>
                                        </div>

                                        {s.penalty_weight > 0 && (
                                            <div className="text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded-2xl p-2 text-center">
                                                惩罚：-{s.penalty_weight}kg
                                            </div>
                                        )}

                                        {s.video_url && (
                                            <Button
                                                outlined
                                                size="small"
                                                className="w-full"
                                                onClick={() => window.open(s.video_url || "", "_blank")}
                                            >
                                                <Video className="h-4 w-4 mr-2" />
                                                观看视频
                                                <ExternalLink className="h-4 w-4 ml-2" />
                                            </Button>
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
                className="md:hidden fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+6.25rem)] z-40 h-14 w-14 !rounded-full shadow-lg"
                icon="pi pi-plus"
                onClick={() => setFormOpen(true)}
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
                position="bottom"
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
                                className="w-full"
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
                                    className="w-full"
                                    onChange={(e) => setForm((p) => ({ ...p, gender: e.value }))}
                                />
                            </div>
                            <div>
                                <div className="text-xs text-surface-500 mb-1.5">体重（kg）</div>
                                <InputNumber
                                    value={form.bodyweight}
                                    onValueChange={(e) => setForm((p) => ({ ...p, bodyweight: e.value ?? null }))}
                                    className="w-full"
                                    min={1}
                                    maxFractionDigits={1}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-xs text-surface-500 mb-1.5">附加负重（kg）</div>
                                <InputNumber
                                    value={form.added_weight}
                                    onValueChange={(e) => setForm((p) => ({ ...p, added_weight: e.value ?? null }))}
                                    className="w-full"
                                    maxFractionDigits={1}
                                />
                            </div>
                            <div>
                                <div className="text-xs text-surface-500 mb-1.5">完成次数</div>
                                <InputNumber
                                    value={form.reps}
                                    onValueChange={(e) => setForm((p) => ({ ...p, reps: e.value ?? null }))}
                                    className="w-full"
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
                                className="w-full"
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
                                    className="w-full"
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
                                    className="w-full"
                                    placeholder="张三 或 @your_handle"
                                />
                            </div>
                            <div>
                                <div className="text-xs text-surface-500 mb-1.5">视频链接（选填）</div>
                                <InputText
                                    value={form.video_url}
                                    onChange={(e) => setForm((p) => ({ ...p, video_url: e.target.value }))}
                                    className="w-full"
                                    placeholder="https://..."
                                />
                            </div>
                        </div>

                        <Button
                            label={submitting ? "提交中..." : "提交数据"}
                            className="w-full"
                            onClick={handleSubmit}
                            loading={submitting}
                        />
                    </div>
                </div>
            </Dialog>
        </div>
    );
}

