'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputSwitch } from 'primereact/inputswitch';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Image as ImageIcon, Link as LinkIcon, Lock, Plus, Trash2, Upload, Video } from 'lucide-react';
import { coachService } from '@/app/service/coachService';
import { useToastContext } from '@/context/ToastContext';
import {
    COACH_APPLICATION_MATERIAL_CATEGORIES,
    type CoachApplicationMaterial,
    type CoachApplicationMaterialCategory,
    type CoachApplicationMaterialLink,
    type CoachApplicationMaterialMedia,
} from '@/lib/coachApplicationMaterials';

interface ApplicationMaterialEditorProps {
    materials: CoachApplicationMaterial[];
    onChange: (materials: CoachApplicationMaterial[]) => void;
    title?: string;
    helperText?: string;
}

const categoryIconMap: Record<CoachApplicationMaterialCategory, React.ReactNode> = {
    achievement: <Plus size={14} />,
    case: <ImageIcon size={14} />,
    credential: <Lock size={14} />,
    media: <Video size={14} />,
};

const makeId = (prefix: string) => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

function createEmptyMaterial(category: CoachApplicationMaterialCategory = 'achievement'): CoachApplicationMaterial {
    return {
        id: makeId('material'),
        category,
        title: '',
        summary: '',
        detail: '',
        isPublic: true,
        media: [],
        links: [],
    };
}

export default function ApplicationMaterialEditor({
    materials,
    onChange,
    title = '证明材料',
    helperText = '把成就、案例、证书和图片/视频整理成可审核、可展示的材料卡。关闭公开后仅审核后台和本人可见。',
}: ApplicationMaterialEditorProps) {
    const { showToast } = useToastContext();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [draft, setDraft] = useState<CoachApplicationMaterial>(createEmptyMaterial());
    const [linkDraft, setLinkDraft] = useState({ label: '', url: '' });
    const [uploading, setUploading] = useState(false);

    const categoryLabelMap = useMemo(
        () => Object.fromEntries(COACH_APPLICATION_MATERIAL_CATEGORIES.map((item) => [item.value, item.label])),
        [],
    ) as Record<CoachApplicationMaterialCategory, string>;

    const openCreate = (category: CoachApplicationMaterialCategory) => {
        setEditingIndex(null);
        setDraft(createEmptyMaterial(category));
        setLinkDraft({ label: '', url: '' });
        setDialogVisible(true);
    };

    const openEdit = (index: number) => {
        setEditingIndex(index);
        setDraft({
            ...materials[index],
            media: Array.isArray(materials[index].media) ? materials[index].media : [],
            links: Array.isArray(materials[index].links) ? materials[index].links : [],
        });
        setLinkDraft({ label: '', url: '' });
        setDialogVisible(true);
    };

    const removeMaterial = (index: number) => {
        onChange(materials.filter((_, idx) => idx !== index));
    };

    const saveDraft = () => {
        const titleValue = draft.title.trim();
        if (!titleValue) {
            showToast({ severity: 'warn', summary: '请填写材料标题' });
            return;
        }

        const normalizedDraft: CoachApplicationMaterial = {
            ...draft,
            title: titleValue,
            summary: draft.summary?.trim() || null,
            detail: draft.detail?.trim() || null,
            media: draft.media || [],
            links: draft.links || [],
        };

        if (editingIndex === null) {
            onChange([...materials, normalizedDraft]);
        } else {
            onChange(materials.map((item, idx) => (idx === editingIndex ? normalizedDraft : item)));
        }
        setDialogVisible(false);
    };

    const addLink = () => {
        const url = linkDraft.url.trim();
        if (!url) return;
        const link: CoachApplicationMaterialLink = {
            id: makeId('link'),
            label: linkDraft.label.trim() || '相关链接',
            url,
        };
        setDraft((prev) => ({ ...prev, links: [...prev.links, link] }));
        setLinkDraft({ label: '', url: '' });
    };

    const removeLink = (id: string) => {
        setDraft((prev) => ({ ...prev, links: prev.links.filter((item) => item.id !== id) }));
    };

    const removeMedia = (id: string) => {
        setDraft((prev) => ({ ...prev, media: prev.media.filter((item) => item.id !== id) }));
    };

    const handleUpload = async (file?: File) => {
        if (!file) return;
        setUploading(true);
        try {
            const uploaded = await coachService.uploadApplicationMedia(file);
            if (!uploaded) throw new Error('上传失败');
            const media: CoachApplicationMaterialMedia = {
                id: makeId('media'),
                type: uploaded.type,
                url: uploaded.url,
                thumbnailUrl: uploaded.thumbnailUrl || null,
                storageBucket: uploaded.storageBucket,
                storagePath: uploaded.storagePath,
                fileName: uploaded.fileName,
                fileSizeBytes: uploaded.fileSizeBytes,
                contentType: uploaded.contentType,
            };
            setDraft((prev) => ({ ...prev, media: [...prev.media, media] }));
            showToast({ severity: 'success', summary: '上传成功' });
        } catch (err: any) {
            showToast({ severity: 'error', summary: '上传失败', detail: err?.message || '请稍后重试' });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="md:col-span-2">
            <div className="flex flex-col gap-3">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                    <div>
                        <label className="block text-sm font-semibold text-surface-900">{title}</label>
                        <p className="mt-1 text-xs text-surface-500 leading-relaxed">{helperText}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {COACH_APPLICATION_MATERIAL_CATEGORIES.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => openCreate(item.value)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-600 transition-colors"
                            >
                                {categoryIconMap[item.value]}
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                {materials.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-surface-300 bg-surface-50 px-4 py-6 text-sm text-surface-500">
                        还没有添加证明材料。建议至少补充 1 个代表案例、1 个资质或视频/图片材料。
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {materials.map((item, index) => (
                            <div key={item.id || index} className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <Tag value={categoryLabelMap[item.category] || '材料'} severity="info" />
                                            {!item.isPublic && <Tag value="仅审核可见" severity="warning" />}
                                        </div>
                                        <h4 className="font-bold text-surface-900 break-words">{item.title}</h4>
                                        {item.summary && <p className="mt-1 text-sm text-surface-600 break-words">{item.summary}</p>}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeMaterial(index)}
                                        className="p-2 rounded-lg text-surface-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                        aria-label="删除材料"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-surface-500">
                                    {item.media?.length > 0 && <span>{item.media.length} 个媒体</span>}
                                    {item.links?.length > 0 && <span>{item.links.length} 个链接</span>}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => openEdit(index)}
                                    className="mt-4 w-full px-3 py-2 rounded-lg border border-surface-200 bg-white text-sm font-bold text-surface-700 hover:border-primary hover:text-primary transition-colors"
                                >
                                    编辑材料
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Dialog
                header={editingIndex === null ? '添加证明材料' : '编辑证明材料'}
                visible={dialogVisible}
                onHide={() => setDialogVisible(false)}
                style={{ width: 'min(720px, 92vw)' }}
                modal
            >
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-surface-600 mb-1">材料类型</label>
                            <Dropdown
                                value={draft.category}
                                options={COACH_APPLICATION_MATERIAL_CATEGORIES}
                                optionLabel="label"
                                optionValue="value"
                                onChange={(e) => setDraft((prev) => ({ ...prev, category: e.value }))}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-surface-600 mb-1">标题</label>
                            <InputText
                                value={draft.title}
                                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                                placeholder="例如：NSCA-CPT / 力量提升案例"
                                className="w-full"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-surface-600 mb-1">一句话摘要</label>
                        <InputText
                            value={draft.summary || ''}
                            onChange={(e) => setDraft((prev) => ({ ...prev, summary: e.target.value }))}
                            placeholder="例如：12周帮助学员卧推从 80kg 提升到 100kg"
                            className="w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-surface-600 mb-1">详细说明</label>
                        <InputTextarea
                            value={draft.detail || ''}
                            onChange={(e) => setDraft((prev) => ({ ...prev, detail: e.target.value }))}
                            rows={5}
                            autoResize
                            placeholder="补充背景、方法、结果或证书说明"
                            className="w-full"
                        />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-surface-200 px-3 py-2">
                        <div>
                            <div className="text-sm font-bold text-surface-800">公开展示到教练主页</div>
                            <div className="text-xs text-surface-500">关闭后仅审核后台和本人可见。</div>
                        </div>
                        <InputSwitch
                            checked={draft.isPublic}
                            onChange={(e) => setDraft((prev) => ({ ...prev, isPublic: Boolean(e.value) }))}
                        />
                    </div>
                    <div className="rounded-lg border border-surface-200 p-3">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="text-sm font-bold text-surface-800">图片 / 视频</div>
                            <Button
                                type="button"
                                icon="pi pi-upload"
                                label={uploading ? '上传中' : '上传素材'}
                                loading={uploading}
                                onClick={() => fileInputRef.current?.click()}
                                size="small"
                            />
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,video/*"
                                className="hidden"
                                onChange={(e) => handleUpload(e.target.files?.[0])}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {draft.media.map((item) => (
                                <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-50 p-2">
                                    <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="min-w-0 flex items-center gap-2 text-sm font-bold text-surface-700 hover:text-primary"
                                    >
                                        {item.type === 'video' ? <Video size={16} /> : <ImageIcon size={16} />}
                                        <span className="truncate">{item.fileName || item.type}</span>
                                    </a>
                                    <button type="button" onClick={() => removeMedia(item.id)} className="text-surface-400 hover:text-red-600">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                            {draft.media.length === 0 && <div className="text-xs text-surface-400">暂无媒体素材</div>}
                        </div>
                    </div>
                    <div className="rounded-lg border border-surface-200 p-3">
                        <div className="text-sm font-bold text-surface-800 mb-3">外部链接</div>
                        <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-2">
                            <InputText
                                value={linkDraft.label}
                                onChange={(e) => setLinkDraft((prev) => ({ ...prev, label: e.target.value }))}
                                placeholder="链接名称"
                            />
                            <InputText
                                value={linkDraft.url}
                                onChange={(e) => setLinkDraft((prev) => ({ ...prev, url: e.target.value }))}
                                placeholder="https://..."
                            />
                            <Button type="button" icon="pi pi-plus" onClick={addLink} disabled={!linkDraft.url.trim()} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {draft.links.map((item) => (
                                <span key={item.id} className="inline-flex items-center gap-1.5 rounded-lg bg-surface-100 px-2 py-1 text-xs font-bold text-surface-700">
                                    <LinkIcon size={12} />
                                    {item.label || item.url}
                                    <button type="button" onClick={() => removeLink(item.id)} className="text-surface-400 hover:text-red-600">×</button>
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" label="取消" severity="secondary" outlined onClick={() => setDialogVisible(false)} />
                        <Button type="button" label="保存材料" onClick={saveDraft} />
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
