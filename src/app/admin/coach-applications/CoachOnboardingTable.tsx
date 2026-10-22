'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { SelectButton } from 'primereact/selectbutton';
import { adminService } from '@/app/service/adminService';
import { useToastContext } from '@/context/ToastContext';
import { formatBeijingDate } from '@/lib/beijingTime';
import { getCoachTrackShortLabel } from '@/lib/coachApplicationOptions';
import {
    COACH_ONBOARDING_STAGE_LABELS,
    HUIFU_ACCOUNT_STATE_LABELS,
    type CoachOnboardingStage,
} from '@/lib/coachOnboardingProgress';
import type { CoachOnboardingRow } from '@/app/api/admin/coach-onboarding/entity';

type StageFilter = 'all' | CoachOnboardingStage;

const DATE_FORMAT: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };

const STAGE_FILTERS: Array<{ label: string; value: StageFilter }> = [
    { label: '全部', value: 'all' },
    { label: '开店中', value: 'setup' },
    { label: '可接单', value: 'ready' },
    { label: '带学员中', value: 'serving' },
];

const STAGE_SEVERITY: Record<CoachOnboardingStage, 'warning' | 'info' | 'success'> = {
    setup: 'warning',
    ready: 'info',
    serving: 'success',
};

// 教练名称、昵称是用户自己填的：以 = + - @ 开头的值在 Excel 里会被当公式执行，前面补 ' 当文本
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function toCsvCell(value: unknown): string {
    const text = String(value ?? '');
    const safe = FORMULA_PREFIX.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
}

export default function CoachOnboardingTable() {
    const { showToast } = useToastContext();
    const [rows, setRows] = useState<CoachOnboardingRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [stage, setStage] = useState<StageFilter>('setup');

    const load = async () => {
        try {
            setLoading(true);
            const res = await adminService.listCoachOnboarding();
            if (!res) throw new Error('empty response');
            setRows(res.coaches);
        } catch (error) {
            console.error('[admin/coach-onboarding] load failed:', error);
            showToast({ severity: 'error', summary: '加载失败', detail: '无法获取教练开店进度' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const visibleRows = useMemo(
        () => (stage === 'all' ? rows : rows.filter((row) => row.progress.stage === stage)),
        [rows, stage],
    );

    const copyPhone = async (phone: string) => {
        try {
            await navigator.clipboard.writeText(phone);
            showToast({ severity: 'success', summary: '已复制手机号' });
        } catch {
            showToast({ severity: 'warn', summary: '复制失败，请手动复制' });
        }
    };

    const exportCsv = () => {
        const header = ['姓名', '昵称', '层级', '状态', '手机号', '邮箱', '城市', '收款账户', '已完成', '进行中学员', '通过日期'];
        const lines = visibleRows.map((row) => [
            row.name,
            row.nickname,
            getCoachTrackShortLabel(row.coachTrack as any),
            COACH_ONBOARDING_STAGE_LABELS[row.progress.stage],
            row.phone,
            row.email,
            row.city,
            HUIFU_ACCOUNT_STATE_LABELS[row.progress.huifuAccount],
            `${row.progress.completed}/${row.progress.total}`,
            row.activeStudentCount,
            row.approvedAt ? formatBeijingDate(row.approvedAt, 'zh-CN', DATE_FORMAT) : '',
        ].map(toCsvCell).join(','));
        const blob = new Blob(['﻿' + [header.map(toCsvCell).join(','), ...lines].join('\r\n')], {
            type: 'text/csv;charset=utf-8',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `教练开店进度-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const coachTemplate = (row: CoachOnboardingRow) => (
        <div className="flex flex-col">
            <span className="font-bold text-surface-900">
                {row.name}
                {row.status === 'suspended' && <Tag className="ml-2" severity="danger" value="已暂停" rounded />}
            </span>
            {row.nickname && row.nickname !== row.name && (
                <small className="text-surface-500">{row.nickname}</small>
            )}
        </div>
    );

    const contactTemplate = (row: CoachOnboardingRow) => (
        <div className="flex flex-col">
            {row.phone ? (
                <span className="flex items-center gap-1">
                    {row.phone}
                    <Button icon="pi pi-copy" rounded text size="small" tooltip="复制手机号" onClick={() => copyPhone(row.phone!)} />
                </span>
            ) : (
                <span className="text-surface-400">未留手机号</span>
            )}
            {row.email && <small className="text-surface-500">{row.email}</small>}
        </div>
    );

    const stepsTemplate = (row: CoachOnboardingRow) => (
        <div className="flex flex-wrap gap-1">
            {row.progress.steps.map((step) => (
                <Tag
                    key={step.key}
                    severity={step.done ? 'success' : 'secondary'}
                    icon={step.done ? 'pi pi-check' : undefined}
                    value={step.key === 'payment_account' && !step.done
                        ? HUIFU_ACCOUNT_STATE_LABELS[row.progress.huifuAccount]
                        : step.label}
                />
            ))}
        </div>
    );

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <SelectButton
                    value={stage}
                    options={STAGE_FILTERS}
                    onChange={(e) => e.value && setStage(e.value)}
                />
                <div className="flex gap-2">
                    <Button icon="pi pi-download" label="导出 CSV" outlined severity="secondary" onClick={exportCsv} disabled={loading || visibleRows.length === 0} />
                    <Button icon="pi pi-refresh" outlined severity="secondary" onClick={load} disabled={loading} tooltip="刷新数据" />
                </div>
            </div>
            <DataTable
                value={visibleRows}
                loading={loading}
                className="p-datatable-sm shadow-1 border-round-xl overflow-hidden"
                responsiveLayout="stack"
                sortField="approvedAt"
                sortOrder={-1}
                emptyMessage={<div className="p-5 text-center text-surface-400">没有符合条件的教练</div>}
            >
                <Column header="教练" body={coachTemplate} style={{ minWidth: '12rem' }} />
                <Column header="层级" body={(row: CoachOnboardingRow) => getCoachTrackShortLabel(row.coachTrack as any)} style={{ width: '6rem' }} />
                <Column header="联系方式" body={contactTemplate} style={{ minWidth: '12rem' }} />
                <Column header="开店 4 步" body={stepsTemplate} style={{ minWidth: '18rem' }} />
                <Column
                    header="阶段"
                    body={(row: CoachOnboardingRow) => (
                        <Tag severity={STAGE_SEVERITY[row.progress.stage]} value={COACH_ONBOARDING_STAGE_LABELS[row.progress.stage]} rounded />
                    )}
                    style={{ width: '7rem' }}
                />
                <Column field="activeStudentCount" header="进行中学员" sortable style={{ width: '7rem' }} />
                <Column
                    field="approvedAt"
                    header="通过日期"
                    sortable
                    body={(row: CoachOnboardingRow) => (row.approvedAt
                        ? formatBeijingDate(row.approvedAt, 'zh-CN', DATE_FORMAT)
                        : '—')}
                    style={{ width: '8rem' }}
                />
            </DataTable>
        </div>
    );
}
