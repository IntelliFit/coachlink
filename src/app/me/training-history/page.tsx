'use client';

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Skeleton } from "primereact/skeleton";
import { Tag } from "primereact/tag";
import { useToastContext } from "@/context/ToastContext";
import { trainingHistoryService } from "@/app/service/trainingHistoryService";

const getMonthKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
};

const getSourceLabel = (sourceType: string) => {
    if (sourceType === "IMPROMPTU") return "即兴";
    if (sourceType === "SELF_PLAN") return "我的计划";
    return "教练计划";
};

export default function TrainingHistoryPage() {
    const router = useRouter();
    const { showToast } = useToastContext();

    const [currentMonth, setCurrentMonth] = useState(() => new Date());
    const [calendarDays, setCalendarDays] = useState<Record<string, number>>({});
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [dayItems, setDayItems] = useState<any[]>([]);
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
    const [monthStats, setMonthStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [loadingDay, setLoadingDay] = useState(false);

    const monthKey = useMemo(() => getMonthKey(currentMonth), [currentMonth]);

    const monthGrid = useMemo(() => {
        const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const startWeekday = first.getDay();
        const daysInMonth = new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth() + 1,
            0,
        ).getDate();
        const cells: Array<{ day: number | null; dateKey: string | null }> = [];

        for (let i = 0; i < startWeekday; i++) {
            cells.push({ day: null, dateKey: null });
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const date = `${monthKey}-${String(day).padStart(2, "0")}`;
            cells.push({ day, dateKey: date });
        }
        return cells;
    }, [currentMonth, monthKey]);

    useEffect(() => {
        const loadMonth = async () => {
            setLoading(true);
            try {
                const [calendar, stats] = await Promise.all([
                    trainingHistoryService.getCalendar({ month: monthKey }),
                    trainingHistoryService.getMonthShare({ month: monthKey }),
                ]);
                const dayMap: Record<string, number> = {};
                for (const item of calendar?.days || []) {
                    dayMap[item.date] = item.sessions;
                }
                setCalendarDays(dayMap);
                setMonthStats(stats || null);
            } catch (error) {
                showToast({
                    severity: "error",
                    summary: "加载失败",
                    detail: "训练历史加载失败，请稍后重试",
                });
            } finally {
                setLoading(false);
            }
        };
        loadMonth();
    }, [monthKey, showToast]);

    const loadDay = async (date: string) => {
        setLoadingDay(true);
        try {
            const data = await trainingHistoryService.getDayHistory({ date });
            setDayItems(data?.items || []);
            setExpandedItemId(null);
            setSelectedDate(date);
        } catch (error) {
            showToast({
                severity: "error",
                summary: "加载失败",
                detail: "当天记录加载失败",
            });
        } finally {
            setLoadingDay(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        icon="pi pi-arrow-left"
                        text
                        onClick={() => router.back()}
                    />
                    <h1 className="text-2xl font-bold text-surface-900">训练记录</h1>
                </div>
                <Button
                    label="即兴锻炼"
                    icon="pi pi-bolt"
                    onClick={() => router.push("/impromptu-training")}
                />
            </div>

            {loading ? (
                <Card>
                    <Skeleton height="14rem" />
                </Card>
            ) : (
                <Card>
                    <div className="flex items-center justify-between mb-3">
                        <div className="font-semibold text-surface-900">{monthKey}</div>
                        <div className="flex gap-2">
                            <Button
                                icon="pi pi-angle-left"
                                text
                                onClick={() =>
                                    setCurrentMonth(
                                        (prev) =>
                                            new Date(
                                                prev.getFullYear(),
                                                prev.getMonth() - 1,
                                                1,
                                            ),
                                    )}
                            />
                            <Button
                                icon="pi pi-angle-right"
                                text
                                onClick={() =>
                                    setCurrentMonth(
                                        (prev) =>
                                            new Date(
                                                prev.getFullYear(),
                                                prev.getMonth() + 1,
                                                1,
                                            ),
                                    )}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                        {["日", "一", "二", "三", "四", "五", "六"].map((w) => (
                            <div key={w} className="text-xs text-surface-500 text-center">
                                {w}
                            </div>
                        ))}
                        {monthGrid.map((cell, idx) => (
                            <button
                                key={`${cell.dateKey || "blank"}-${idx}`}
                                disabled={!cell.dateKey}
                                onClick={() => cell.dateKey && loadDay(cell.dateKey)}
                                className={`h-12 rounded-xl border text-sm transition-all ${cell.dateKey
                                    ? "border-surface-100 hover:border-primary-300"
                                    : "border-transparent"
                                    } ${selectedDate === cell.dateKey ? "bg-primary-50 border-primary-300" : ""}`}
                            >
                                {cell.day && (
                                    <div className="flex flex-col items-center">
                                        <span>{cell.day}</span>
                                        {cell.dateKey && calendarDays[cell.dateKey] > 0 && (
                                            <span className="text-[10px] text-primary-600">
                                                {calendarDays[cell.dateKey]}次
                                            </span>
                                        )}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </Card>
            )}

            {monthStats && (
                <Card>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                            <div className="text-surface-500">训练天数</div>
                            <div className="font-bold text-surface-900">{monthStats.trainingDays}</div>
                        </div>
                        <div>
                            <div className="text-surface-500">训练次数</div>
                            <div className="font-bold text-surface-900">{monthStats.totalSessions}</div>
                        </div>
                        <div>
                            <div className="text-surface-500">完成组数</div>
                            <div className="font-bold text-surface-900">{monthStats.totalSets}</div>
                        </div>
                        <div>
                            <div className="text-surface-500">来源占比</div>
                            <div className="text-xs text-surface-700">
                                即兴 {monthStats.sourceBreakdown.impromptu} /
                                我的 {monthStats.sourceBreakdown.selfPlan} /
                                教练 {monthStats.sourceBreakdown.coachPlan}
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            <Card>
                <div className="font-semibold text-surface-900 mb-3">
                    {selectedDate ? `${selectedDate} 训练明细` : "选择日期查看训练明细"}
                </div>
                {loadingDay ? (
                    <Skeleton height="8rem" />
                ) : dayItems.length === 0 ? (
                    <div className="text-sm text-surface-500">暂无训练记录</div>
                ) : (
                    <div className="space-y-2">
                        {dayItems.map((item) => (
                            <div
                                key={`${item.sourceType}-${item.id}`}
                                className="rounded-xl border border-surface-100 p-3 cursor-pointer"
                                onClick={() =>
                                    setExpandedItemId((prev) =>
                                        prev === item.id ? null : item.id
                                    )}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-medium text-surface-900">{item.title}</div>
                                        <div className="text-xs text-surface-500">
                                            {new Date(item.startedAt).toLocaleTimeString("zh-CN", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Tag value={getSourceLabel(item.sourceType)} />
                                        <Tag value={`${item.completedSets}/${item.totalSets}组`} severity="info" />
                                    </div>
                                </div>
                                {expandedItemId === item.id && (
                                    <div className="mt-3 border-t border-surface-100 pt-3 space-y-2">
                                        {Array.isArray(item.actionSummaries) && item.actionSummaries.length > 0 ? (
                                            item.actionSummaries.map((action: any, idx: number) => (
                                                <div
                                                    key={`${item.id}-action-${idx}`}
                                                    className="flex items-center justify-between text-sm"
                                                >
                                                    <span className="text-surface-800">{action.actionName}</span>
                                                    <span className="text-surface-500">
                                                        {action.completedSets}/{action.totalSets}组
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-sm text-surface-500">暂无动作明细</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}

