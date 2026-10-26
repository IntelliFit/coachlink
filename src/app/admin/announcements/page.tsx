'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Tag } from 'primereact/tag';
import { ImagePlus, Megaphone, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useToastContext } from '@/context/ToastContext';
import { formatBeijingDate } from '@/lib/beijingTime';
import {
    ANNOUNCEMENT_MAX_IMAGES,
    type AnnouncementAudience,
    type AnnouncementStatus,
} from '@/lib/announcements';
import type { AdminAnnouncement } from '@/lib/announcementStore';
import type { ApiData } from '@/types/api';
import AnnouncementCard from '@/components/announcement/AnnouncementCard';

type Draft = {
    id: string | null;
    status: AnnouncementStatus;
    title: string;
    summary: string;
    content: string;
    cover_image_url: string;
    image_urls: string[];
    action_label: string;
    weapp_path: string;
    web_path: string;
    audience: AnnouncementAudience;
    popup: boolean;
    pinned: boolean;
    expires_at: string;
};

const EMPTY_DRAFT: Draft = {
    id: null,
    status: 'draft',
    title: '',
    summary: '',
    content: '',
    cover_image_url: '',
    image_urls: [],
    action_label: '',
    weapp_path: '',
    web_path: '',
    audience: 'all',
    popup: true,
    pinned: false,
    expires_at: '',
};

const AUDIENCE_OPTIONS: { label: string; value: AnnouncementAudience }[] = [
    { label: '全部用户', value: 'all' },
    { label: '仅教练', value: 'coach' },
    { label: '仅非教练用户（学员）', value: 'student' },
];

const FILTERS: { label: string; value: AnnouncementStatus | 'all' }[] = [
    { label: '全部', value: 'all' },
    { label: '已发布', value: 'published' },
    { label: '草稿', value: 'draft' },
    { label: '已下线', value: 'archived' },
];

const STATUS_TAG: Record<AnnouncementStatus, { label: string; severity: 'success' | 'warning' | 'secondary' }> = {
    published: { label: '已发布', severity: 'success' },
    draft: { label: '草稿', severity: 'warning' },
    archived: { label: '已下线', severity: 'secondary' },
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
};

/** ISO → datetime-local 输入框需要的本地时间字符串。 */
function toLocalInput(iso: string | null): string {
    if (!iso) return '';
    const date = new Date(iso);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toDraft(item: AdminAnnouncement): Draft {
    return {
        id: item.id,
        status: item.status,
        title: item.title,
        summary: item.summary,
        content: item.content,
        cover_image_url: item.cover_image_url || '',
        image_urls: Array.isArray(item.image_urls) ? (item.image_urls as string[]) : [],
        action_label: item.action_label,
        weapp_path: item.weapp_path,
        web_path: item.web_path,
        audience: item.audience,
        popup: item.popup,
        pinned: item.pinned,
        expires_at: toLocalInput(item.expires_at),
    };
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    const json = await res.json().catch(() => null) as ApiData<T> | null;
    if (!json?.success) throw new Error(json?.message || `请求失败（${res.status}）`);
    return json.data as T;
}

async function uploadImage(file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    const data = await api<{ url: string }>('/api/admin/announcements/upload-image', { method: 'POST', body: form });
    return data.url;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1 block text-sm font-semibold text-surface-700">{label}</span>
            {children}
            {hint && <span className="mt-1 block text-xs text-surface-400">{hint}</span>}
        </label>
    );
}

export default function AdminAnnouncementsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();
    const [items, setItems] = useState<AdminAnnouncement[]>([]);
    const [filter, setFilter] = useState<AnnouncementStatus | 'all'>('all');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

    useEffect(() => {
        if (status === 'loading') return;
        if (!session?.user?.is_admin) router.push('/admin/login');
    }, [router, session?.user?.is_admin, status]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api<{ items: AdminAnnouncement[] }>(`/api/admin/announcements?status=${filter}`);
            setItems(data.items);
        } catch (error) {
            showToast({ severity: 'error', summary: '加载失败', detail: (error as Error).message });
        } finally {
            setLoading(false);
        }
    }, [filter, showToast]);

    useEffect(() => {
        if (session?.user?.is_admin) void load();
    }, [load, session?.user?.is_admin]);

    const patch = (fields: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...fields }));

    const payload = useMemo(() => ({
        ...draft,
        expires_at: draft.expires_at ? new Date(draft.expires_at).toISOString() : '',
    }), [draft]);

    const save = async (nextStatus?: AnnouncementStatus) => {
        if (nextStatus === 'published' && !window.confirm(
            `确认发布？发布后${draft.popup ? '用户下次打开时会立即弹窗，' : ''}所有${AUDIENCE_OPTIONS.find((o) => o.value === draft.audience)?.label}都能看到。`,
        )) return;
        setSaving(true);
        try {
            const body = JSON.stringify(payload);
            const headers = { 'Content-Type': 'application/json' };
            let saved = draft.id
                ? (await api<{ item: AdminAnnouncement }>(`/api/admin/announcements/${draft.id}`, { method: 'PUT', headers, body })).item
                : (await api<{ item: AdminAnnouncement }>('/api/admin/announcements', { method: 'POST', headers, body })).item;
            if (nextStatus && nextStatus !== saved.status) {
                saved = (await api<{ item: AdminAnnouncement }>(`/api/admin/announcements/${saved.id}/status`, {
                    method: 'POST', headers, body: JSON.stringify({ status: nextStatus }),
                })).item;
            }
            setDraft(toDraft({ ...saved, readCount: 0 }));
            showToast({ severity: 'success', summary: nextStatus === 'published' ? '已发布' : '已保存' });
            await load();
        } catch (error) {
            showToast({ severity: 'error', summary: '保存失败', detail: (error as Error).message });
        } finally {
            setSaving(false);
        }
    };

    const archive = async () => {
        if (!draft.id || !window.confirm('确认下线？下线后用户端不再显示这条通知。')) return;
        setSaving(true);
        try {
            const { item } = await api<{ item: AdminAnnouncement }>(`/api/admin/announcements/${draft.id}/status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'archived' }),
            });
            setDraft(toDraft({ ...item, readCount: 0 }));
            await load();
        } catch (error) {
            showToast({ severity: 'error', summary: '下线失败', detail: (error as Error).message });
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!draft.id || !window.confirm('确认删除？删除后无法恢复，阅读记录也会一并删除。')) return;
        setSaving(true);
        try {
            await api<null>(`/api/admin/announcements/${draft.id}`, { method: 'DELETE' });
            setDraft(EMPTY_DRAFT);
            await load();
        } catch (error) {
            showToast({ severity: 'error', summary: '删除失败', detail: (error as Error).message });
        } finally {
            setSaving(false);
        }
    };

    const onPickImages = async (files: FileList | null, target: 'cover' | 'body') => {
        if (!files || files.length === 0) return;
        setUploading(true);
        try {
            if (target === 'cover') {
                patch({ cover_image_url: await uploadImage(files[0]) });
            } else {
                const room = ANNOUNCEMENT_MAX_IMAGES - draft.image_urls.length;
                const urls = await Promise.all(Array.from(files).slice(0, room).map(uploadImage));
                setDraft((prev) => ({ ...prev, image_urls: [...prev.image_urls, ...urls] }));
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '上传失败', detail: (error as Error).message });
        } finally {
            setUploading(false);
        }
    };

    if (status === 'loading' || !session?.user?.is_admin) {
        return <div className="flex h-64 items-center justify-center"><ProgressSpinner /></div>;
    }

    return (
        <div className="mx-auto max-w-7xl pb-12 pt-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-surface-100 px-3 py-1 text-xs font-bold text-primary-600">
                        <Megaphone className="h-4 w-4" />
                        平台通知
                    </div>
                    <h1 className="text-2xl font-black text-surface-950">通知公告</h1>
                    <p className="mt-1 text-sm text-surface-600">
                        发布后，小程序和网页用户下次打开时会弹窗（每人只弹一次），首页通知入口显示未读红点。
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button label="刷新" outlined icon={<RefreshCw className="mr-2 h-4 w-4" />} onClick={() => void load()} />
                    <Button label="新建通知" icon={<Plus className="mr-2 h-4 w-4" />} onClick={() => setDraft(EMPTY_DRAFT)} />
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[320px_1fr_360px]">
                {/* 列表 */}
                <div className="rounded-lg border border-surface-200 bg-surface p-3">
                    <div className="mb-3 flex flex-wrap gap-1">
                        {FILTERS.map((f) => (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => setFilter(f.value)}
                                className={`rounded-md px-3 py-1 text-sm font-semibold ${filter === f.value ? 'bg-primary-500 text-white' : 'bg-surface-50 text-surface-600'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    {loading ? (
                        <div className="flex h-32 items-center justify-center"><ProgressSpinner style={{ width: 32, height: 32 }} /></div>
                    ) : items.length === 0 ? (
                        <p className="py-8 text-center text-sm text-surface-400">暂无通知</p>
                    ) : (
                        <ul className="space-y-2">
                            {items.map((item) => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        onClick={() => setDraft(toDraft(item))}
                                        className={`w-full rounded-md border p-3 text-left ${draft.id === item.id ? 'border-primary-300 bg-primary-50' : 'border-surface-100 hover:border-surface-300'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Tag value={STATUS_TAG[item.status].label} severity={STATUS_TAG[item.status].severity} />
                                            {item.pinned && <Tag value="置顶" />}
                                            <span className="truncate text-sm font-bold text-surface-900">{item.title}</span>
                                        </div>
                                        <div className="mt-1 text-xs text-surface-400">
                                            {item.published_at ? `发布 ${formatBeijingDate(item.published_at, 'zh-CN', DATE_OPTIONS)}` : '未发布'}
                                            {' · '}已读 {item.readCount} 人
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* 编辑 */}
                <div className="space-y-4 rounded-lg border border-surface-200 bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-black text-surface-900">{draft.id ? '编辑通知' : '新建通知'}</h2>
                        {draft.id && <Tag value={STATUS_TAG[draft.status].label} severity={STATUS_TAG[draft.status].severity} />}
                    </div>
                    <Field label="标题 *" hint="最多 60 字">
                        <InputText className="w-full" value={draft.title} maxLength={60} onChange={(e) => patch({ title: e.target.value })} />
                    </Field>
                    <Field label="摘要" hint="弹窗里显示，最多 200 字">
                        <InputTextarea className="w-full" rows={2} value={draft.summary} maxLength={200} onChange={(e) => patch({ summary: e.target.value })} />
                    </Field>
                    <Field label="正文" hint="详情页显示，支持换行，最多 5000 字">
                        <InputTextarea className="w-full" rows={6} value={draft.content} maxLength={5000} onChange={(e) => patch({ content: e.target.value })} />
                    </Field>

                    <Field label="封面图" hint="弹窗顶部大图，建议 4:3 或 1:1，≤5MB">
                        <div className="flex items-center gap-3">
                            {draft.cover_image_url && (
                                <div className="relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={draft.cover_image_url} alt="" className="h-20 w-20 rounded-md object-cover" />
                                    <button type="button" aria-label="移除封面" onClick={() => patch({ cover_image_url: '' })} className="absolute -right-2 -top-2 rounded-full bg-surface-900 p-0.5 text-white"><X className="h-3.5 w-3.5" /></button>
                                </div>
                            )}
                            <span className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-surface-200 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50">
                                <ImagePlus className="h-4 w-4" />{uploading ? '上传中…' : '选择图片'}
                                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={uploading}
                                    onChange={(e) => { void onPickImages(e.target.files, 'cover'); e.target.value = ''; }} />
                            </span>
                        </div>
                    </Field>

                    <Field label={`正文图片（${draft.image_urls.length}/${ANNOUNCEMENT_MAX_IMAGES}）`} hint="详情页正文下方依次展示">
                        <div className="flex flex-wrap items-center gap-3">
                            {draft.image_urls.map((url) => (
                                <div key={url} className="relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={url} alt="" className="h-16 w-16 rounded-md object-cover" />
                                    <button type="button" aria-label="移除图片" onClick={() => patch({ image_urls: draft.image_urls.filter((u) => u !== url) })} className="absolute -right-2 -top-2 rounded-full bg-surface-900 p-0.5 text-white"><X className="h-3.5 w-3.5" /></button>
                                </div>
                            ))}
                            {draft.image_urls.length < ANNOUNCEMENT_MAX_IMAGES && (
                                <span className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-surface-200 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50">
                                    <ImagePlus className="h-4 w-4" />添加
                                    <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={uploading}
                                        onChange={(e) => { void onPickImages(e.target.files, 'body'); e.target.value = ''; }} />
                                </span>
                            )}
                        </div>
                    </Field>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="受众">
                            <Dropdown className="w-full" value={draft.audience} options={AUDIENCE_OPTIONS} onChange={(e) => patch({ audience: e.value })} />
                        </Field>
                        <Field label="过期时间" hint="留空则一直显示，直到手动下线">
                            <input type="datetime-local" className="w-full rounded-md border border-surface-300 bg-surface px-3 py-2 text-sm" value={draft.expires_at} onChange={(e) => patch({ expires_at: e.target.value })} />
                        </Field>
                    </div>
                    <div className="flex flex-wrap gap-6">
                        <label className="flex items-center gap-2 text-sm text-surface-700">
                            <input type="checkbox" checked={draft.popup} onChange={(e) => patch({ popup: e.target.checked })} />
                            打开时弹窗（每人一次）
                        </label>
                        <label className="flex items-center gap-2 text-sm text-surface-700">
                            <input type="checkbox" checked={draft.pinned} onChange={(e) => patch({ pinned: e.target.checked })} />
                            列表置顶
                        </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <Field label="详情页按钮文字" hint="如「去体验」，可留空">
                            <InputText className="w-full" value={draft.action_label} maxLength={20} onChange={(e) => patch({ action_label: e.target.value })} />
                        </Field>
                        <Field label="小程序跳转路径" hint="如 /toolbox/index">
                            <InputText className="w-full" value={draft.weapp_path} onChange={(e) => patch({ weapp_path: e.target.value })} />
                        </Field>
                        <Field label="网页跳转路径" hint="如 /toolbox">
                            <InputText className="w-full" value={draft.web_path} onChange={(e) => patch({ web_path: e.target.value })} />
                        </Field>
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-surface-100 pt-4">
                        <Button label={draft.status === 'published' ? '保存修改' : '保存草稿'} outlined loading={saving} disabled={uploading} onClick={() => void save()} />
                        {draft.status !== 'published' && (
                            <Button label="保存并发布" icon={<Megaphone className="mr-2 h-4 w-4" />} loading={saving} disabled={uploading} onClick={() => void save('published')} />
                        )}
                        {draft.id && draft.status === 'published' && (
                            <Button label="下线" severity="secondary" outlined loading={saving} onClick={() => void archive()} />
                        )}
                        {draft.id && (
                            <Button label="删除" severity="danger" text icon={<Trash2 className="mr-1 h-4 w-4" />} loading={saving} onClick={() => void remove()} />
                        )}
                    </div>
                </div>

                {/* 预览 */}
                <div>
                    <p className="mb-2 text-sm font-semibold text-surface-500">弹窗预览</p>
                    <div className="overflow-hidden rounded-3xl border border-surface-200 bg-surface shadow-lg">
                        <AnnouncementCard data={{
                            title: draft.title,
                            summary: draft.summary,
                            content: draft.content,
                            coverImageUrl: draft.cover_image_url || null,
                        }} />
                        <div className="flex gap-3 px-6 pb-5 pt-3">
                            <span className="flex-1 rounded-2xl bg-primary-500 py-3 text-center text-sm font-bold text-white">查看详情</span>
                            <span className="flex-1 rounded-2xl border border-surface-200 py-3 text-center text-sm font-bold text-surface-700">知道了</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
