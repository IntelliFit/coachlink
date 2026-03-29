"use client";

import { useMemo, useState } from "react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "primereact/card";
import { Skeleton } from "primereact/skeleton";

import type { StreetliftingLocationOverviewStats } from "@/app/api/streetlifting-index/stats/entity";
import { AERO_CARD } from "@/components/streetlifting-index/aero";

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
);

const EMERALD = "rgb(16, 185, 129)";
const EMERALD_FILL = "rgba(16, 185, 129, 0.12)";

function formatMonthShort(monthKey: string): string {
    const parts = monthKey.split("-");
    const m = parts[1] ? parseInt(parts[1], 10) : NaN;
    if (Number.isNaN(m)) return monthKey;
    return `${m}月`;
}

export interface StreetliftingLocationOverviewProps {
    loading: boolean;
    overview: StreetliftingLocationOverviewStats | null;
}

export function StreetliftingLocationOverview({ loading, overview }: StreetliftingLocationOverviewProps) {
    const [open, setOpen] = useState(false);

    const metrics = useMemo(() => {
        if (!overview || overview.totalCount <= 0) {
            return {
                imgPct: 0,
                descPct: 0,
                imgLine: "0 / 0 个有图",
                descLine: "0 / 0 个有描述",
            };
        }
        const t = overview.totalCount;
        const imgPct = Math.round((overview.withImagesCount / t) * 100);
        const descPct = Math.round((overview.withDescriptionCount / t) * 100);
        return {
            imgPct,
            descPct,
            imgLine: `${overview.withImagesCount} / ${t} 个有图`,
            descLine: `${overview.withDescriptionCount} / ${t} 个有描述`,
        };
    }, [overview]);

    const barData = useMemo(() => {
        const items = overview?.topProvinces || [];
        return {
            labels: items.map((x) => x.name),
            datasets: [
                {
                    label: "点位数",
                    data: items.map((x) => x.count),
                    backgroundColor: EMERALD,
                    borderRadius: 8,
                    maxBarThickness: 36,
                },
            ],
        };
    }, [overview]);

    const lineData = useMemo(() => {
        const items = overview?.recentMonths || [];
        return {
            labels: items.map((x) => formatMonthShort(x.month)),
            datasets: [
                {
                    label: "新增",
                    data: items.map((x) => x.count),
                    borderColor: EMERALD,
                    backgroundColor: EMERALD_FILL,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 4,
                    pointBackgroundColor: EMERALD,
                },
            ],
        };
    }, [overview]);

    const chartOpts = useMemo(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxRotation: 45, minRotation: 0, font: { size: 11 } },
                },
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    grid: { color: "rgba(0,0,0,0.06)" },
                },
            },
        }),
        [],
    );

    return (
        <Card className={AERO_CARD}>
            <div className="p-6 space-y-4">
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className="w-full text-left flex items-start justify-between gap-4 group"
                >
                    <div className="min-w-0">
                        <div className="text-lg font-black tracking-tight text-surface-900">单杠数据总体分析</div>
                        <div className="text-sm text-surface-500 mt-1">
                            {overview
                                ? `统计基于全部 ${overview.totalCount} 个点位（不受当前筛选影响），用于快速判断数据完整度与分布情况。`
                                : "加载后将展示全库点位覆盖率、分布与近月新增趋势。"}
                        </div>
                    </div>
                    <span className="shrink-0 mt-1 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-surface-200 bg-surface-50 text-surface-600 group-hover:border-emerald-200 group-hover:text-emerald-700 transition-colors">
                        {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </span>
                </button>

                {!open && !loading && overview && (
                    <div className="flex flex-wrap gap-2 text-xs text-surface-500">
                        <span className="rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">
                            图片 {metrics.imgPct}%
                        </span>
                        <span className="rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">
                            描述 {metrics.descPct}%
                        </span>
                        <span className="rounded-full bg-surface-50 border border-surface-100 px-2.5 py-1">
                            覆盖 {overview.provinceCount} 省
                        </span>
                    </div>
                )}

                {open && (
                    <>
                        {loading ? (
                            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="rounded-2xl border border-surface-100 bg-surface-50 p-4">
                                        <Skeleton width="50%" height="0.85rem" className="mb-3" />
                                        <Skeleton width="40%" height="2rem" />
                                    </div>
                                ))}
                            </div>
                        ) : !overview ? (
                            <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-6 text-sm text-surface-500">
                                暂无法加载单杠总览统计，请稍后重试。
                            </div>
                        ) : (
                            <>
                                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-surface-0 p-4">
                                        <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">图片覆盖率</div>
                                        <div className="text-3xl font-black text-emerald-600 mt-1">{metrics.imgPct}%</div>
                                        <div className="text-xs text-surface-500 mt-1">{metrics.imgLine}</div>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-surface-0 p-4">
                                        <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">描述覆盖率</div>
                                        <div className="text-3xl font-black text-emerald-600 mt-1">{metrics.descPct}%</div>
                                        <div className="text-xs text-surface-500 mt-1">{metrics.descLine}</div>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-surface-0 p-4">
                                        <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">平均图片数</div>
                                        <div className="text-3xl font-black text-emerald-600 mt-1">{overview.averageImageCount}</div>
                                        <div className="text-xs text-surface-500 mt-1">每个点位的平均照片数量</div>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-surface-0 p-4">
                                        <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">覆盖省份</div>
                                        <div className="text-3xl font-black text-emerald-600 mt-1">{overview.provinceCount}</div>
                                        <div className="text-xs text-surface-500 mt-1">省份字段去重后统计</div>
                                    </div>
                                </div>

                                <div className="grid lg:grid-cols-2 gap-4">
                                    <div className="rounded-2xl border border-surface-100 bg-surface-0 p-4">
                                        <div className="text-sm font-black text-surface-900 mb-3">省份点位分布（Top 8）</div>
                                        <div className="h-[220px]">
                                            {barData.labels.length > 0 ? (
                                                <Bar data={barData} options={chartOpts} />
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-sm text-surface-400">暂无省份分布数据</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-surface-100 bg-surface-0 p-4">
                                        <div className="text-sm font-black text-surface-900 mb-3">最近 6 个月新增趋势</div>
                                        <div className="h-[220px]">
                                            {lineData.labels.length > 0 ? (
                                                <Line data={lineData} options={chartOpts} />
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-sm text-surface-400">暂无趋势数据</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </Card>
    );
}
