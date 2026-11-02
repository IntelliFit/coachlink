'use client';

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Message } from 'primereact/message';
import { SelectButton } from 'primereact/selectbutton';
import { Tag } from 'primereact/tag';
import { adminService } from '@/app/service/adminService';
import { useToastContext } from '@/context/ToastContext';
import { formatBeijingDate } from '@/lib/beijingTime';
import type { CoachFunnelResponse } from '@/app/api/admin/coach-funnel/route';
import type { FunnelCoachRow } from '@/lib/coachFunnelReport';

const DAY_OPTIONS = [
    { label: '7 天', value: 7 },
    { label: '14 天', value: 14 },
    { label: '30 天', value: 30 },
    { label: '90 天', value: 90 },
];

const DATE_FORMAT: Intl.DateTimeFormatOptions = { month: '2-digit', day: '2-digit' };

function percentOf(part: number, whole: number): string {
    return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—';
}

export default function CoachFunnelPanel() {
    const { showToast } = useToastContext();
    const [days, setDays] = useState(14);
    const [data, setData] = useState<CoachFunnelResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const load = async (nextDays: number) => {
        try {
            setLoading(true);
            const res = await adminService.getCoachFunnel({ days: nextDays });
            if (!res) throw new Error('empty response');
            setData(res);
        } catch (error) {
            console.error('[admin/coach-funnel] load failed:', error);
            showToast({ severity: 'error', summary: '加载失败', detail: '无法获取教练转化数据' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(days);
    }, [days]);

    const report = data?.report;
    const totals = report?.totals;
    const steps = totals
        ? [
            { label: '打开教练列表', value: totals.listVisitors, base: null },
            { label: '进入教练主页', value: totals.profileVisitors, base: totals.listVisitors },
            { label: '查看方案', value: totals.pricingVisitors, base: totals.profileVisitors },
            { label: '点击购买', value: totals.buyClickVisitors, base: totals.pricingVisitors },
            { label: '其中被挡住', value: totals.blockedVisitors, base: totals.buyClickVisitors },
            { label: '发起付款', value: totals.paymentStartVisitors, base: totals.buyClickVisitors },
            { label: '取消或失败', value: totals.paymentCancelVisitors, base: totals.paymentStartVisitors },
            { label: '成交订单（含续费）', value: totals.paidOrders, base: null },
        ]
        : [];
    const answered = report?.reasons.reduce((sum, row) => sum + row.count, 0) || 0;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <SelectButton value={days} options={DAY_OPTIONS} allowEmpty={false} onChange={(e) => e.value && setDays(e.value)} />
                <Button icon="pi pi-refresh" outlined severity="secondary" onClick={() => load(days)} disabled={loading} tooltip="刷新数据" />
            </div>

            {data?.migrationPending && (
                <Message severity="warn" text="数据表还没创建：请先执行迁移 20261102090000_coach_funnel_events.sql，之后才开始积累数据。" />
            )}
            {data?.truncated && <Message severity="warn" text="事件太多，只统计了最新的 10 万条。" />}

            {report && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {steps.map((step) => (
                            <div key={step.label} className="rounded-xl border border-surface-200 bg-white p-3">
                                <div className="text-sm text-surface-500">{step.label}</div>
                                <div className="text-2xl font-bold text-surface-900">{step.value}</div>
                                {step.base !== null && (
                                    <div className="text-xs text-surface-500">占上一步 {percentOf(step.value, step.base)}</div>
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-surface-500 m-0">
                        按访客去重，教练看自己的主页不计入；同一个人登录前后可能算两个访客。上线前的历史数据没有记录。
                    </p>

                    <section>
                        <h3 className="text-base font-bold text-surface-900 mt-0 mb-2">
                            为什么没订阅（回答 {totals?.answers ?? 0}，跳过 {totals?.skips ?? 0}）
                        </h3>
                        {report.reasons.length === 0 ? (
                            <p className="text-sm text-surface-500 m-0">还没有人回答。</p>
                        ) : (
                            <ul className="m-0 p-0 list-none flex flex-col gap-2">
                                {report.reasons.map((row) => (
                                    <li key={row.reason} className="flex items-center justify-between rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm">
                                        <span className="text-surface-800">{row.label}</span>
                                        <span className="font-semibold text-surface-900">{row.count}（{percentOf(row.count, answered)}）</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {report.notes.length > 0 && (
                        <section>
                            <h3 className="text-base font-bold text-surface-900 mt-0 mb-2">学员写的话</h3>
                            <ul className="m-0 p-0 list-none flex flex-col gap-2">
                                {report.notes.map((note) => (
                                    <li key={`${note.createdAt}-${note.note}`} className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm">
                                        <div className="text-surface-800">{note.note}</div>
                                        <div className="text-xs text-surface-500 mt-1">
                                            {note.coachName} · {formatBeijingDate(note.createdAt, 'zh-CN', DATE_FORMAT)}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <DataTable
                        value={report.coaches}
                        loading={loading}
                        dataKey="coachId"
                        className="p-datatable-sm shadow-1 border-round-xl overflow-hidden"
                        responsiveLayout="stack"
                        emptyMessage={<div className="p-5 text-center text-surface-400">这段时间还没有数据</div>}
                    >
                        <Column
                            header="教练"
                            body={(row: FunnelCoachRow) => (
                                <span className="flex items-center gap-2 font-bold text-surface-900">
                                    {row.name}
                                    <Tag severity={row.canSell ? 'success' : 'secondary'} value={row.canSell ? '可购买' : '买不了'} rounded />
                                </span>
                            )}
                            style={{ minWidth: '14rem' }}
                        />
                        <Column field="views" header="主页访客" sortable />
                        <Column field="pricingViews" header="看方案" sortable />
                        <Column field="buyClicks" header="点购买" sortable />
                        <Column field="blockedClicks" header="被挡住" sortable />
                        <Column field="paymentStarts" header="发起付款" sortable />
                        <Column field="paymentCancels" header="取消/失败" sortable />
                        <Column field="paidOrders" header="成交" sortable />
                        <Column field="reasons" header="答问卷" sortable />
                    </DataTable>
                </>
            )}
        </div>
    );
}
