"use client";

import React, { useEffect, useMemo, useState } from "react";
import { addBeijingDays, formatBeijingDate, toBeijingDateKey } from "@/lib/beijingTime";

// --- Types ---

type AnalyticsResponse = {
    success: boolean;
    message?: string;
    data?: any;
};

// --- Components ---

function MetricCard({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
    return (
        <div className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
            <div className="text-2xl font-semibold mt-1 text-slate-900 dark:text-white">{value}</div>
            {subValue && <div className="text-xs text-slate-500 mt-2">{subValue}</div>}
        </div>
    );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
    return (
        <div className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
                <div className="font-medium text-slate-900 dark:text-white">{title}</div>
                {action}
            </div>
            {children}
        </div>
    );
}

// --- Views ---

function DashboardView() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/admin/analytics/dashboard")
            .then((res) => res.json())
            .then((json) => {
                if (json.success) setData(json.data);
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div>加载中...</div>;
    if (!data) return <div>加载失败</div>;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="今日活跃用户 (DAU)" value={data.overview.active_users_today} />
                <MetricCard label="今日新增用户" value={data.overview.new_users_today} />
                <MetricCard label="今日完成训练" value={data.overview.completed_trainings_today} />
                <MetricCard label="活跃订阅" value={data.overview.active_subscriptions} />
            </div>
            {/* Future: Add trends charts here */}
            <Section title="活跃趋势 (近7天)">
                <div className="h-40 flex items-end gap-2 text-xs text-slate-500 justify-center">
                    {data.trends?.length > 0 ? data.trends.map((t: any) => (
                        <div key={t.date} className="flex-1 flex flex-col items-center gap-1">
                             <div className="w-full bg-blue-500/20 rounded-t relative group" style={{ height: `${Math.max(t.active_users * 5, 4)}px` }}>
                                <div className="absolute bottom-0 w-full bg-blue-500 rounded-t transition-all" style={{ height: '100%' }}></div>
                                <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white px-2 py-1 rounded z-10 whitespace-nowrap">
                                    {t.active_users} 人
                                </div>
                             </div>
                             <div>{formatBeijingDate(t.date, 'zh-CN', { month: 'numeric', day: 'numeric' })}</div>
                        </div>
                    )) : <div className="flex items-center h-full">暂无趋势数据</div>}
                </div>
            </Section>
        </div>
    );
}

function FeatureUsageView() {
    const [data, setData] = useState<any>(null);
    const [range, setRange] = useState("7d");

    useEffect(() => {
        fetch(`/api/admin/analytics/feature-usage?range=${range}`)
            .then((res) => res.json())
            .then((json) => {
                if (json.success) setData(json.data);
            });
    }, [range]);

    return (
        <div className="space-y-4">
            <div className="flex gap-2 mb-4">
                {[
                    { label: "7天", value: "7d" },
                    { label: "30天", value: "30d" },
                    { label: "90天", value: "90d" }
                ].map(item => (
                    <button
                        key={item.value}
                        onClick={() => setRange(item.value)}
                        className={`px-3 py-1 rounded border text-sm ${range === item.value ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Section title="热门功能排行">
                    {data ? (
                        <div className="space-y-2">
                             {data.topFeatures?.map((f: any, i: number) => (
                                 <div key={f.name} className="flex items-center gap-3 text-sm">
                                     <span className="w-6 text-center tabular-nums text-slate-400">{i + 1}</span>
                                     <div className="flex-1">
                                         <div className="flex justify-between mb-1 text-slate-800 dark:text-slate-200">
                                             <span>{f.name}</span>
                                             <span>{f.count} 次</span>
                                         </div>
                                         <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                             <div className="h-full bg-indigo-500" style={{ width: `${(f.count / (data.topFeatures[0]?.count || 1)) * 100}%` }} />
                                         </div>
                                     </div>
                                 </div>
                             ))}
                             {(!data.topFeatures || data.topFeatures.length === 0) && <div className="text-sm text-slate-500">暂无数据</div>}
                        </div>
                    ) : (
                        <div>加载中...</div>
                    )}
                </Section>
                 {/* Placeholder for Categorized Breakdown */}
                <Section title="分类占比">
                    <div className="text-slate-500 text-sm text-center py-10">开发中...</div>
                </Section>
            </div>
        </div>
    );
}

function RetentionView() {
     const [data, setData] = useState<any[]>([]);

     useEffect(() => {
        fetch("/api/admin/analytics/retention")
            .then(res => res.json())
            .then(json => {
                if (json.success) setData(json.data);
            });
     }, []);

    return (
        <Section title="用户留存">
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-center text-slate-800 dark:text-slate-200">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                            <th className="py-2 px-4 text-left">日期</th>
                            <th className="py-2 px-4">新增用户</th>
                            <th className="py-2 px-4">次日</th>
                            <th className="py-2 px-4">3日</th>
                            <th className="py-2 px-4">7日</th>
                            <th className="py-2 px-4">30日</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, i) => (
                            <tr key={i} className="border-b dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800">
                                <td className="py-2 px-4 text-left">{row.date}</td>
                                <td className="py-2 px-4">{row.newUsers}</td>
                                <td className="py-2 px-4 bg-blue-50/50 dark:bg-blue-900/30">{row.d1}</td>
                                <td className="py-2 px-4 bg-blue-50/30 dark:bg-blue-900/20">{row.d3}</td>
                                <td className="py-2 px-4 bg-blue-50/10 dark:bg-blue-900/10">{row.d7}</td>
                                <td className="py-2 px-4">{row.d30}</td>
                            </tr>
                        ))}
                        {data.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-4 text-slate-500">暂无数据，请先确保有用户注册和行为埋点</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Section>
    )
}

function ReleasesView() {
    const [releases, setReleases] = useState<any[]>([]);
    const [showForm, setShowForm] = useState(false);
    
    // Form state
    const [formData, setFormData] = useState({ name: "", release_date: toBeijingDateKey(new Date()), tracked_events: [] as string[] });

    const load = () => {
        fetch("/api/admin/analytics/feature-releases")
            .then(res => res.json())
            .then(json => {
                if (json.success) setReleases(json.data);
            })
    };

    useEffect(() => { load() }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await fetch("/api/admin/analytics/feature-releases", {
            method: "POST",
            body: JSON.stringify({ ...formData, tracked_events: ["example_event"] }), // Simplified
        });
        setShowForm(false);
        load();
    }

    return (
        <div className="space-y-4">
             <div className="flex justify-end">
                 <button onClick={() => setShowForm(!showForm)} className="px-3 py-1 bg-primary text-white bg-blue-600 rounded text-sm hover:bg-blue-700">
                     + 记录新功能发布
                 </button>
             </div>

             {showForm && (
                 <Section title="添加发布记录">
                     <form onSubmit={handleSubmit} className="space-y-3">
                         <div className="grid grid-cols-2 gap-3">
                             <div>
                                 <label className="block text-xs font-medium mb-1 text-slate-700 dark:text-slate-300">功能名称</label>
                                 <input className="w-full border rounded px-2 py-1 dark:bg-slate-800 dark:border-slate-600" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                             </div>
                             <div>
                                 <label className="block text-xs font-medium mb-1 text-slate-700 dark:text-slate-300">发布日期</label>
                                 <input type="date" className="w-full border rounded px-2 py-1 dark:bg-slate-800 dark:border-slate-600" value={formData.release_date} onChange={e => setFormData({...formData, release_date: e.target.value})} />
                             </div>
                         </div>
                         <div className="flex justify-end gap-2">
                             <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1 border rounded text-sm text-slate-700 dark:text-slate-300">取消</button>
                             <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded text-sm">保存</button>
                         </div>
                     </form>
                 </Section>
             )}

             <div className="space-y-2">
                 {releases.map(r => (
                     <div key={r.id} className="border border-slate-200 dark:border-slate-700 rounded p-3 bg-white dark:bg-slate-900 flex justify-between items-center">
                         <div>
                             <div className="font-medium text-slate-900 dark:text-white">{r.name}</div>
                             <div className="text-xs text-slate-500">发布于 {r.release_date}</div>
                         </div>
                         <div className="text-sm text-slate-500">
                             暂无追踪数据
                         </div>
                     </div>
                 ))}
                 {releases.length === 0 && <div className="text-center text-slate-500 py-8">暂无发布记录</div>}
             </div>
        </div>
    )
}

function TraceView() {
    const [range, setRange] = useState({ start: "", end: "" });
    const [includeDev, setIncludeDev] = useState(false);
    const [includeAdmin, setIncludeAdmin] = useState(false);
    const [data, setData] = useState<any>();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const end = new Date();
        const start = addBeijingDays(end, -6);
        setRange({ start: toBeijingDateKey(start), end: toBeijingDateKey(end) });
    }, []);

    const fetchData = () => {
        if (!range.start) return;
        setLoading(true);
        const params = new URLSearchParams({ start: range.start, end: range.end });
        if (includeDev) params.set("includeDev", "1");
        if (includeAdmin) params.set("includeAdmin", "1");
        fetch(`/api/trace/analytics?${params.toString()}`)
            .then(res => res.json())
            .then(json => {
                if (json.success) setData(json.data);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchData() }, [range.start, range.end, includeDev, includeAdmin]);

    const formatDuration = (ms: number | null) => {
        if (!ms) return "-";
        if (ms < 1000) return `${Math.round(ms)}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    return (
        <div className="space-y-4">
             <div className="flex flex-wrap items-center gap-3">
                 <input type="date" value={range.start} onChange={e => setRange({...range, start: e.target.value})} className="border rounded px-2 text-sm text-black" />
                 <span>-</span>
                 <input type="date" value={range.end} onChange={e => setRange({...range, end: e.target.value})} className="border rounded px-2 text-sm text-black" />
                 <div className="flex gap-2 text-xs">
                     <label className="flex items-center gap-1 text-slate-700 dark:text-slate-300"><input type="checkbox" checked={includeDev} onChange={e => setIncludeDev(e.target.checked)} /> 包含开发环境</label>
                     <label className="flex items-center gap-1 text-slate-700 dark:text-slate-300"><input type="checkbox" checked={includeAdmin} onChange={e => setIncludeAdmin(e.target.checked)} /> 包含管理员</label>
                 </div>
                 <button onClick={fetchData} className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded text-sm text-black dark:text-white hover:bg-slate-200">刷新</button>
             </div>

             {loading && <div>加载中...</div>}

             {data && (
                 <>
                    <div className="grid grid-cols-3 gap-3">
                        <MetricCard label="页面浏览量 (PV)" value={data.totals.page_views} />
                        <MetricCard label="会话数 (Sessions)" value={data.totals.unique_sessions} />
                        <MetricCard label="平均时长" value={formatDuration(data.totals.avg_duration_ms)} />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Section title="热门页面">
                            <table className="w-full text-sm">
                                <tbody>
                                    {data.top_paths.slice(0, 5).map((p: any) => (
                                        <tr key={p.path} className="border-b dark:border-slate-800 last:border-0"><td className="py-1 truncate text-slate-800 dark:text-slate-200">{p.path}</td><td className="text-right text-slate-800 dark:text-slate-200">{p.count}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </Section>
                        <Section title="热门来源">
                             <table className="w-full text-sm">
                                <tbody>
                                    {data.top_referrers.slice(0, 5).map((p: any) => (
                                        <tr key={p.referrer} className="border-b dark:border-slate-800 last:border-0"><td className="py-1 truncate text-slate-800 dark:text-slate-200">{p.referrer || "直接访问"}</td><td className="text-right text-slate-800 dark:text-slate-200">{p.count}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </Section>
                    </div>
                 </>
             )}
        </div>
    )
}

// --- Main Page ---

const TABS = [
    { id: "dashboard", label: "总览" },
    { id: "features", label: "功能分析" },
    { id: "retention", label: "留存分析" },
    { id: "releases", label: "功能发布" },
    { id: "trace", label: "流量日志" },
];

export default function AnalyticsPage() {
    const [activeTab, setActiveTab] = useState("dashboard");

    return (
        <div className="space-y-6 text-slate-900 dark:text-slate-100">
            <div>
                <h1 className="text-2xl font-bold mb-2">用户行为分析</h1>
                <p className="text-slate-500">洞察用户行为，驱动产品增长</p>
            </div>

            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="flex space-x-6">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? "border-blue-600 text-blue-600 dark:text-blue-500 dark:border-blue-500"
                                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="min-h-[500px]">
                {activeTab === "dashboard" && <DashboardView />}
                {activeTab === "features" && <FeatureUsageView />}
                {activeTab === "retention" && <RetentionView />}
                {activeTab === "releases" && <ReleasesView />}
                {activeTab === "trace" && <TraceView />}
            </div>
        </div>
    );
}
