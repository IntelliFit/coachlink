'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Paginator } from 'primereact/paginator';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Tag } from 'primereact/tag';
import {
    Camera,
    CheckCircle2,
    Copy,
    ExternalLink,
    ListChecks,
    MessageSquare,
    RefreshCw,
    RotateCcw,
    Search,
    Terminal,
    XCircle,
} from 'lucide-react';
import { formatBeijingDate } from '@/lib/beijingTime';
import { useToastContext } from '@/context/ToastContext';
import type { ApiData } from '@/types/api';
import type {
    AdminFeedbackCategory,
    AdminFeedbackItem,
    AdminFeedbackStatus,
    ListAdminFeedbackResponseDto,
    UpdateAdminFeedbackStatusResponseDto,
} from '@/app/api/admin/feedback/entity';

const CATEGORY_OPTIONS: { label: string; value: AdminFeedbackCategory | 'all' }[] = [
    { label: '全部类型', value: 'all' },
    { label: '问题反馈', value: 'bug' },
    { label: '功能建议', value: 'suggestion' },
    { label: '体验反馈', value: 'experience' },
    { label: '其他', value: 'other' },
];

const STATUS_OPTIONS: { label: string; value: AdminFeedbackStatus | 'all' }[] = [
    { label: '待处理', value: 'open' },
    { label: '已采纳', value: 'resolved' },
    { label: '不采纳', value: 'closed' },
    { label: '全部状态', value: 'all' },
];

function categoryLabel(value: string) {
    const found = CATEGORY_OPTIONS.find((item) => item.value === value);
    return found?.label || value || '其他';
}

function statusLabel(value: string) {
    if (value === 'resolved') return '已采纳';
    if (value === 'closed') return '不采纳';
    return '待处理';
}

function statusSeverity(status: AdminFeedbackStatus): 'success' | 'danger' | 'warning' {
    if (status === 'resolved') return 'success';
    if (status === 'closed') return 'danger';
    return 'warning';
}

function formatDate(value: string | null) {
    if (!value) return '—';
    return formatBeijingDate(value, 'zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function displayUser(item: AdminFeedbackItem) {
    return item.user_nickname || item.user_full_name || item.user_phone || item.user_email || item.user_id;
}

function toRecords(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)));
}

function clientInfoObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
}

function stringify(value: unknown) {
    try {
        return JSON.stringify(value ?? {}, null, 2);
    } catch {
        return String(value ?? '');
    }
}

function InfoRow(props: { label: string; value: React.ReactNode }) {
    return (
        <div className="grid gap-1 border-b border-surface-100 py-2 text-sm md:grid-cols-[120px_1fr]">
            <div className="font-semibold text-surface-500">{props.label}</div>
            <div className="min-w-0 break-words text-surface-800">{props.value || '—'}</div>
        </div>
    );
}

export default function AdminFeedbackPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToastContext();

    const [items, setItems] = useState<AdminFeedbackItem[]>([]);
    const [selected, setSelected] = useState<AdminFeedbackItem | null>(null);
    const [stats, setStats] = useState({ open: 0, resolved: 0, closed: 0 });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [total, setTotal] = useState(0);
    const [searchInput, setSearchInput] = useState('');
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<AdminFeedbackCategory | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<AdminFeedbackStatus | 'all'>('open');
    const [resolutionMessage, setResolutionMessage] = useState('');
    const [rewardCredits, setRewardCredits] = useState('0');

    useEffect(() => {
        if (status === 'loading') return;
        if (!session?.user?.is_admin) {
            router.push('/admin/login');
        }
    }, [router, session?.user?.is_admin, status]);

    useEffect(() => {
        const directId = searchParams.get('feedback_id');
        if (!directId) return;
        setSearchInput(directId);
        setQuery(directId);
        setStatusFilter('all');
        setPage(1);
    }, [searchParams]);

    const loadFeedback = useCallback(async () => {
        if (!session?.user?.is_admin) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(limit),
                status: statusFilter,
                category,
            });
            if (query) params.set('q', query);

            const res = await fetch(`/api/admin/feedback?${params.toString()}`);
            const json = (await res.json()) as ApiData<ListAdminFeedbackResponseDto>;
            if (!res.ok || !json.success || !json.data) {
                throw new Error(json.message || '加载意见反馈失败');
            }
            setItems(json.data.items);
            setTotal(json.data.total);
            setStats(json.data.stats);
            setSelected((current) => {
                if (!json.data) return current;
                const next = current ? json.data.items.find((item) => item.id === current.id) : null;
                return next || json.data.items[0] || current || null;
            });
        } catch (err: any) {
            setError(err?.message || '加载意见反馈失败');
        } finally {
            setLoading(false);
        }
    }, [category, limit, page, query, session?.user?.is_admin, statusFilter]);

    useEffect(() => {
        void loadFeedback();
    }, [loadFeedback]);

    useEffect(() => {
        if (!selected) {
            setResolutionMessage('');
            setRewardCredits('0');
            return;
        }
        setResolutionMessage(selected.resolution_message || '');
        setRewardCredits(String(selected.reward_credits || 0));
    }, [selected?.id]);

    const submitSearch = () => {
        setPage(1);
        setQuery(searchInput.trim());
    };

    const updateStatus = async (nextStatus: AdminFeedbackStatus) => {
        if (!selected) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/feedback/${encodeURIComponent(selected.id)}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: nextStatus,
                    resolution_message: resolutionMessage,
                    reward_credits: Number(rewardCredits) || 0,
                }),
            });
            const json = (await res.json()) as ApiData<UpdateAdminFeedbackStatusResponseDto>;
            if (!res.ok || !json.success || !json.data?.item) {
                throw new Error(json.message || '保存失败');
            }
            setSelected(json.data.item);
            setItems((prev) => prev.map((item) => item.id === json.data!.item.id ? json.data!.item : item));
            showToast({ severity: 'success', summary: '已保存处理结果', detail: statusLabel(nextStatus) });
            await loadFeedback();
        } catch (err: any) {
            showToast({ severity: 'error', summary: '保存失败', detail: err?.message || '请稍后再试' });
        } finally {
            setSaving(false);
        }
    };

    const copyText = async (value: string, label: string) => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            showToast({ severity: 'success', summary: '已复制', detail: label });
        } catch {
            showToast({ severity: 'warn', summary: '复制失败', detail: '当前浏览器不支持剪贴板写入' });
        }
    };

    const consoleLogs = useMemo(() => {
        if (!selected) return [];
        const info = clientInfoObject(selected.client_info);
        return toRecords(info.console_logs);
    }, [selected]);

    const recentRequests = useMemo(() => {
        if (!selected) return [];
        return toRecords(selected.recent_requests);
    }, [selected]);

    if (status === 'loading' || (status === 'authenticated' && !session?.user?.is_admin)) {
        return (
            <div className="flex h-64 items-center justify-center">
                <ProgressSpinner />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl pb-12 pt-4">
            <div className="rounded-lg border border-surface-200 bg-surface p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-surface-100 px-3 py-1 text-xs font-bold text-primary-600">
                            <MessageSquare className="h-4 w-4" />
                            意见反馈
                        </div>
                        <h1 className="text-2xl font-black text-surface-950">反馈管理</h1>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-surface-600">
                            查看小程序一键反馈、截图、客户端信息和最近请求记录，并记录平台处理结果。
                        </p>
                    </div>
                    <Button
                        label="刷新"
                        outlined
                        icon={<RefreshCw className="mr-2 h-4 w-4" />}
                        onClick={() => void loadFeedback()}
                    />
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <div className="text-xl font-black text-amber-700">{stats.open}</div>
                        <div className="text-xs text-amber-800">待处理</div>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <div className="text-xl font-black text-emerald-700">{stats.resolved}</div>
                        <div className="text-xs text-emerald-800">已采纳</div>
                    </div>
                    <div className="rounded-lg border border-surface-200 bg-surface-50 p-3">
                        <div className="text-xl font-black text-surface-700">{stats.closed}</div>
                        <div className="text-xs text-surface-500">不采纳</div>
                    </div>
                </div>
            </div>

            <div className="mt-5 rounded-lg border border-surface-200 bg-surface p-4 shadow-sm">
                <div className="grid gap-3 lg:grid-cols-[1fr_160px_160px_auto]">
                    <span className="p-input-icon-left w-full">
                        <Search className="h-4 w-4" />
                        <InputText
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') submitSearch();
                            }}
                            placeholder="搜索内容、联系方式、反馈 ID、Trace ID"
                            className="w-full"
                        />
                    </span>
                    <Dropdown
                        value={category}
                        options={CATEGORY_OPTIONS}
                        onChange={(event) => {
                            setPage(1);
                            setCategory(event.value);
                        }}
                        className="w-full"
                    />
                    <Dropdown
                        value={statusFilter}
                        options={STATUS_OPTIONS}
                        onChange={(event) => {
                            setPage(1);
                            setStatusFilter(event.value);
                        }}
                        className="w-full"
                    />
                    <Button
                        label="搜索"
                        icon="pi pi-search"
                        className="border-none bg-[#CF6D4E]"
                        onClick={submitSearch}
                    />
                </div>
            </div>

            {error && (
                <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    {error}
                </div>
            )}

            <div className="mt-5 grid gap-5 lg:grid-cols-[400px_1fr]">
                <div className="rounded-lg border border-surface-200 bg-surface shadow-sm">
                    <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3">
                        <div className="text-sm font-bold text-surface-700">反馈队列</div>
                        <div className="text-xs text-surface-500">共 {total} 条</div>
                    </div>
                    {loading ? (
                        <div className="flex h-64 items-center justify-center">
                            <ProgressSpinner />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="p-8 text-center text-sm text-surface-500">没有匹配的反馈</div>
                    ) : (
                        <div className="max-h-[780px] overflow-y-auto">
                            {items.map((item) => {
                                const isSelected = selected?.id === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className={`w-full border-b border-surface-100 border-l-4 p-4 text-left transition ${
                                            isSelected
                                                ? 'border-l-[#CF6D4E] bg-[#241A18]'
                                                : 'border-l-transparent bg-surface hover:bg-surface-50'
                                        }`}
                                        onClick={() => setSelected(item)}
                                    >
                                        <div className="mb-2 flex flex-wrap items-center gap-2">
                                            <Tag value={statusLabel(item.status)} severity={statusSeverity(item.status)} />
                                            <Tag value={categoryLabel(item.category)} severity="info" />
                                            {item.image_urls.length > 0 && <Tag value={`${item.image_urls.length} 图`} />}
                                        </div>
                                        <div className={`line-clamp-2 text-sm font-semibold leading-6 ${isSelected ? 'text-[#FFF7ED]' : 'text-surface-900'}`}>
                                            {item.content}
                                        </div>
                                        <div
                                            className={`mt-2 flex items-center justify-between gap-3 text-xs ${
                                                isSelected ? 'text-[#F1D2C3]' : 'text-surface-500'
                                            }`}
                                        >
                                            <span className="truncate">{displayUser(item)}</span>
                                            <span>{formatDate(item.created_at)}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <div className="border-t border-surface-200 px-2 py-2">
                        <Paginator
                            first={(page - 1) * limit}
                            rows={limit}
                            totalRecords={total}
                            rowsPerPageOptions={[10, 20, 50, 100]}
                            onPageChange={(event) => {
                                setPage(Math.floor(event.first / event.rows) + 1);
                                setLimit(event.rows);
                            }}
                        />
                    </div>
                </div>

                <div className="rounded-lg border border-surface-200 bg-surface shadow-sm">
                    {!selected ? (
                        <div className="flex h-64 items-center justify-center text-sm text-surface-500">
                            选择一条反馈查看详情
                        </div>
                    ) : (
                        <div className="p-5">
                            <div className="flex flex-col gap-3 border-b border-surface-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <Tag value={statusLabel(selected.status)} severity={statusSeverity(selected.status)} />
                                        <Tag value={categoryLabel(selected.category)} severity="info" />
                                    </div>
                                    <h2 className="text-xl font-black text-surface-950">反馈详情</h2>
                                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-surface-500">
                                        <button
                                            type="button"
                                            className="font-mono hover:text-primary-600"
                                            onClick={() => void copyText(selected.id, '反馈 ID')}
                                        >
                                            {selected.id}
                                        </button>
                                        <span>{formatDate(selected.created_at)}</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        label="复制 ID"
                                        outlined
                                        icon={<Copy className="mr-2 h-4 w-4" />}
                                        onClick={() => void copyText(selected.id, '反馈 ID')}
                                    />
                                </div>
                            </div>

                            <div className="mt-5 rounded-lg border border-surface-200 bg-surface-50 p-4">
                                <div className="mb-2 text-xs font-bold text-surface-500">用户反馈</div>
                                <div className="whitespace-pre-wrap text-base leading-8 text-surface-900">{selected.content}</div>
                            </div>

                            {selected.image_urls.length > 0 && (
                                <div className="mt-5">
                                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-surface-700">
                                        <Camera className="h-4 w-4" />
                                        截图
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                        {selected.image_urls.map((url) => (
                                            <button
                                                key={url}
                                                type="button"
                                                className="group overflow-hidden rounded-lg border border-surface-200 bg-surface-50"
                                                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                                            >
                                                <img src={url} alt="反馈截图" className="h-44 w-full object-cover transition group-hover:scale-[1.02]" />
                                                <div className="flex items-center gap-1 px-3 py-2 text-xs text-surface-500">
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                    打开原图
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-5 grid gap-5 xl:grid-cols-2">
                                <div className="rounded-lg border border-surface-200 p-4">
                                    <div className="mb-2 text-sm font-bold text-surface-700">提交信息</div>
                                    <InfoRow label="用户" value={displayUser(selected)} />
                                    <InfoRow label="用户 ID" value={<code className="text-xs">{selected.user_id}</code>} />
                                    <InfoRow label="联系方式" value={selected.contact || selected.user_phone || selected.user_email || '—'} />
                                    <InfoRow label="页面路径" value={selected.page_path || '—'} />
                                    <InfoRow label="版本" value={selected.app_version || '—'} />
                                    <InfoRow label="Host" value={selected.submit_host_name || '—'} />
                                    <InfoRow label="Trace ID" value={selected.submit_trace_id || '—'} />
                                    <InfoRow label="Request ID" value={selected.submit_request_id || '—'} />
                                </div>

                                <div className="rounded-lg border border-surface-200 p-4">
                                    <div className="mb-2 text-sm font-bold text-surface-700">处理结果</div>
                                    <div className="grid gap-3">
                                        <Dropdown
                                            value={selected.status}
                                            options={STATUS_OPTIONS.filter((item) => item.value !== 'all')}
                                            disabled
                                            className="w-full"
                                        />
                                        <InputText
                                            value={rewardCredits}
                                            onChange={(event) => setRewardCredits(event.target.value.replace(/[^\d]/g, '').slice(0, 5))}
                                            placeholder="奖励积分"
                                            className="w-full"
                                        />
                                        <InputTextarea
                                            value={resolutionMessage}
                                            onChange={(event) => setResolutionMessage(event.target.value)}
                                            autoResize
                                            rows={4}
                                            maxLength={500}
                                            placeholder="处理说明，会保存在反馈记录中"
                                            className="w-full"
                                        />
                                        <div className="grid gap-2 md:grid-cols-3">
                                            <Button
                                                label="采纳"
                                                icon={<CheckCircle2 className="mr-2 h-4 w-4" />}
                                                className="border-none bg-[#CF6D4E]"
                                                loading={saving}
                                                onClick={() => void updateStatus('resolved')}
                                            />
                                            <Button
                                                label="不采纳"
                                                outlined
                                                severity="danger"
                                                icon={<XCircle className="mr-2 h-4 w-4" />}
                                                loading={saving}
                                                onClick={() => void updateStatus('closed')}
                                            />
                                            <Button
                                                label="重开"
                                                outlined
                                                icon={<RotateCcw className="mr-2 h-4 w-4" />}
                                                loading={saving}
                                                onClick={() => void updateStatus('open')}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5 rounded-lg border border-surface-200 p-4">
                                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-surface-700">
                                    <ListChecks className="h-4 w-4" />
                                    最近请求
                                </div>
                                {recentRequests.length === 0 ? (
                                    <div className="text-sm text-surface-500">没有附带请求记录</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[680px] text-left text-xs">
                                            <thead className="bg-surface-50 text-surface-500">
                                                <tr>
                                                    <th className="px-3 py-2">方法</th>
                                                    <th className="px-3 py-2">状态</th>
                                                    <th className="px-3 py-2">耗时</th>
                                                    <th className="px-3 py-2">URL</th>
                                                    <th className="px-3 py-2">Trace</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recentRequests.slice(0, 20).map((item, index) => (
                                                    <tr key={`${item.id || index}`} className="border-t border-surface-100">
                                                        <td className="px-3 py-2 font-mono">{String(item.method || 'GET')}</td>
                                                        <td className="px-3 py-2">{String(item.status ?? '—')}</td>
                                                        <td className="px-3 py-2">{item.duration_ms ? `${item.duration_ms}ms` : '—'}</td>
                                                        <td className="px-3 py-2 font-mono">{String(item.url || '—')}</td>
                                                        <td className="px-3 py-2 font-mono">{String(item.trace_id || item.request_id || '—')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="mt-5 grid gap-5 xl:grid-cols-2">
                                <div className="rounded-lg border border-surface-200 p-4">
                                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-surface-700">
                                        <Terminal className="h-4 w-4" />
                                        控制台日志
                                    </div>
                                    {consoleLogs.length === 0 ? (
                                        <div className="text-sm text-surface-500">没有附带控制台日志</div>
                                    ) : (
                                        <pre className="max-h-80 overflow-auto rounded-md bg-surface-950 p-3 text-xs leading-5 text-surface-50">
                                            {stringify(consoleLogs.slice(-30))}
                                        </pre>
                                    )}
                                </div>
                                <div className="rounded-lg border border-surface-200 p-4">
                                    <div className="mb-3 text-sm font-bold text-surface-700">客户端信息</div>
                                    <pre className="max-h-80 overflow-auto rounded-md bg-surface-950 p-3 text-xs leading-5 text-surface-50">
                                        {stringify(selected.client_info)}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
