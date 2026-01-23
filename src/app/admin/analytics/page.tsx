"use client";

import React, { useEffect, useMemo, useState } from "react";

const DATE_FORMATTER = new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium" });

type AnalyticsResponse = {
    success: boolean;
    message?: string;
    data?: {
        totals: {
            page_views: number;
            unique_sessions: number;
            avg_duration_ms: number | null;
        };
        daily: { date: string; page_views: number; avg_duration_ms: number | null }[];
        top_paths: { path: string | null; count: number; avg_duration_ms: number | null }[];
        top_referrers: { referrer: string | null; count: number }[];
        top_from_paths: { from_path: string | null; count: number }[];
    };
};

type RangePreset = "7d" | "30d" | "90d";

function formatDuration(ms: number | null | undefined): string {
    if (ms == null) return "-";
    if (ms < 1000) return `${Math.round(ms)} ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)} s`;
    const minutes = Math.floor(seconds / 60);
    const remain = Math.round(seconds % 60);
    return `${minutes}m ${remain}s`;
}

function formatDateISO(d: Date): string {
    return d.toISOString().slice(0, 10);
}

const presetToRange = (preset: RangePreset): { start: string; end: string } => {
    const end = new Date();
    const start = new Date();
    if (preset === "7d") start.setDate(end.getDate() - 6);
    if (preset === "30d") start.setDate(end.getDate() - 29);
    if (preset === "90d") start.setDate(end.getDate() - 89);
    return { start: formatDateISO(start), end: formatDateISO(end) };
};

export default function AnalyticsPage() {
    const [{ start, end }, setRange] = useState(() => presetToRange("7d"));
    const [includeDev, setIncludeDev] = useState(false);
    const [includeAdmin, setIncludeAdmin] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<AnalyticsResponse["data"]>();

    const fetchData = async (
        range: { start: string; end: string },
        opts?: { includeDev?: boolean; includeAdmin?: boolean },
    ) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ start: range.start, end: range.end });
            if (opts?.includeDev) params.set("includeDev", "1");
            if (opts?.includeAdmin) params.set("includeAdmin", "1");
            const res = await fetch(`/api/trace/analytics?${params.toString()}`);
            const json: AnalyticsResponse = await res.json();
            if (!json.success) {
                setError(json.message || "加载失败");
                setData(undefined);
            } else {
                setData(json.data);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "未知错误");
            setData(undefined);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData({ start, end }, { includeDev, includeAdmin });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [start, end, includeDev, includeAdmin]);

    const presets: { key: RangePreset; label: string }[] = [
        { key: "7d", label: "近 7 天" },
        { key: "30d", label: "近 30 天" },
        { key: "90d", label: "近 90 天" },
    ];

    const dailySorted = useMemo(() => {
        if (!data?.daily) return [];
        return [...data.daily].sort((a, b) => a.date.localeCompare(b.date));
    }, [data]);

    return (
        <div className="space-y-4 text-slate-900 dark:text-slate-100">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-2">
                    {presets.map((p) => (
                        <button
                            key={p.key}
                            onClick={() => setRange(presetToRange(p.key))}
                            className={`px-3 py-2 rounded border text-sm transition-colors ${
                                presetToRange(p.key).start === start && presetToRange(p.key).end === end
                                    ? "bg-primary text-white border-primary"
                                    : "bg-white border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <input
                        type="date"
                        value={start}
                        onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
                        className="border rounded px-2 py-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                    />
                    <span>至</span>
                    <input
                        type="date"
                        value={end}
                        onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
                        className="border rounded px-2 py-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                    />
                    <button
                        onClick={() => fetchData({ start, end }, { includeDev, includeAdmin })}
                        className="px-3 py-2 border rounded text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-100"
                        disabled={loading}
                    >
                        刷新
                    </button>
                    <div className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
                        <label className="inline-flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={includeDev}
                                onChange={(e) => setIncludeDev(e.target.checked)}
                                className="accent-primary"
                            />
                            包含 development 环境
                        </label>
                        <label className="inline-flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={includeAdmin}
                                onChange={(e) => setIncludeAdmin(e.target.checked)}
                                className="accent-primary"
                            />
                            包含 admin 页面
                        </label>
                    </div>
                </div>
            </div>

            {loading && <div className="text-sm text-slate-500 dark:text-slate-400">加载中…</div>}
            {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

            {data && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <MetricCard label="页面访问量" value={data.totals.page_views.toLocaleString()} />
                        <MetricCard label="唯一会话" value={data.totals.unique_sessions.toLocaleString()} />
                        <MetricCard label="平均停留时间" value={formatDuration(data.totals.avg_duration_ms)} />
                    </div>

                    <Section title="每日趋势">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-2">日期</th>
                                    <th className="text-left py-2">页面访问量</th>
                                    <th className="text-left py-2">平均停留时间</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailySorted.map((row) => (
                                    <tr key={row.date} className="border-b last:border-0">
                                        <td className="py-2">{DATE_FORMATTER.format(new Date(row.date))}</td>
                                        <td className="py-2">{row.page_views.toLocaleString()}</td>
                                        <td className="py-2">{formatDuration(row.avg_duration_ms)}</td>
                                    </tr>
                                ))}
                                {dailySorted.length === 0 && (
                                    <tr>
                                        <td className="py-2 text-sm text-gray-500" colSpan={3}>
                                            暂无数据
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </Section>

                    <Section title="Top 页面 (to_path)">
                        <SimpleTable
                            rows={data.top_paths}
                            columns={[
                                { key: "path", label: "页面" },
                                { key: "count", label: "访问量" },
                                { key: "avg_duration_ms", label: "平均停留" },
                            ]}
                        />
                    </Section>

                    <Section title="Top 来源路径 (from_path)">
                        <SimpleTable
                            rows={data.top_from_paths}
                            columns={[
                                { key: "from_path", label: "来源页面" },
                                { key: "count", label: "次数" },
                            ]}
                        />
                    </Section>

                    <Section title="Top 外部来源">
                        <SimpleTable
                            rows={data.top_referrers}
                            columns={[
                                { key: "referrer", label: "来源地址" },
                                { key: "count", label: "次数" },
                            ]}
                        />
                    </Section>
                </div>
            )}
        </div>
    );
}

function MetricCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
            <div className="text-2xl font-semibold mt-1 text-slate-900 dark:text-white">{value}</div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div className="font-medium mb-3 text-slate-900 dark:text-white">{title}</div>
            {children}
        </div>
    );
}

type SimpleColumnKey = "path" | "count" | "avg_duration_ms" | "referrer" | "from_path";

function SimpleTable({
    rows,
    columns,
}: {
    rows: any[];
    columns: { key: SimpleColumnKey; label: string }[];
}) {
    return (
        <table className="min-w-full text-sm">
            <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                    {columns.map((col) => (
                        <th key={col.key} className="text-left py-2 text-slate-500 dark:text-slate-400 font-normal">
                            {col.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                        {columns.map((col) => (
                            <td key={col.key} className="py-2 pr-4 text-slate-900 dark:text-slate-100">
                                {col.key === "avg_duration_ms"
                                    ? formatDuration(row[col.key])
                                    : row[col.key] || "-"}
                            </td>
                        ))}
                    </tr>
                ))}
                {rows.length === 0 && (
                    <tr>
                        <td className="py-2 text-sm text-slate-500 dark:text-slate-400" colSpan={columns.length}>
                            暂无数据
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    );
}
