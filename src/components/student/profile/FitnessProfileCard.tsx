'use client';

import React, { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { MultiSelect } from 'primereact/multiselect';
import { Dumbbell, Pencil } from 'lucide-react';
import { studentService } from '@/app/service/studentService';
import { useToastContext } from '@/context/ToastContext';

type ProfileFieldKey = 'avatar_url' | 'nickname' | 'gender' | 'height' | 'weight' | 'fitness_goal' | 'fitness_level';
type QuestionnaireFieldKey = 'target_body_parts' | 'interest_tags' | 'equipment' | 'session_duration';
type FieldKey = ProfileFieldKey | QuestionnaireFieldKey;

interface FitnessProfileCardProps {
    profile: Record<string, any> | null;
    questionnaire?: Record<string, any> | null;
    onUpdate: () => void;
}

const GENDER_OPTIONS = [
    { label: '男性', value: 'male' },
    { label: '女性', value: 'female' },
    { label: '暂时不填', value: 'unknown' },
];

const FITNESS_GOAL_OPTIONS = [
    { label: '减脂塑形', value: '减脂' },
    { label: '增肌强身', value: '增肌' },
    { label: '力量提升', value: '力量提升' },
    { label: '体能改善', value: '体能改善' },
    { label: '体态矫正', value: '体态矫正' },
    { label: '运动恢复', value: '运动恢复' },
    { label: '综合体适能', value: '综合体适能' },
    { label: '灵活柔韧', value: '灵活柔韧' },
];

const FITNESS_LEVEL_OPTIONS = [
    { label: '零基础', value: 'beginner' },
    { label: '入门', value: 'novice' },
    { label: '进阶', value: 'intermediate' },
    { label: '高阶', value: 'advanced' },
    { label: '精英 / 职业', value: 'elite' },
];

const TARGET_BODY_PART_OPTIONS = ['胸部', '背部', '肩部', '手臂', '腹部', '腰部', '臀部', '腿部', '全身'];
const INTEREST_OPTIONS = ['上肢', '下肢', '核心', '体态纠正', '减脂燃脂', '灵活性', '力量举', '心肺有氧'];
const EQUIPMENT_OPTIONS = ['徒手', '哑铃', '杠铃', '拉力器/弹力带', '器械区', '壶铃'];
const DURATION_OPTIONS = [15, 20, 30, 45, 60].map((value) => ({ label: `${value} 分钟`, value }));

const FIELD_LABELS: Record<FieldKey, string> = {
    avatar_url: '头像',
    nickname: '昵称',
    gender: '性别',
    height: '身高',
    weight: '体重',
    target_body_parts: '目标部位',
    fitness_goal: '健身目标',
    fitness_level: '训练水平',
    interest_tags: '训练方向',
    equipment: '常用器械',
    session_duration: '单次训练时长',
};

const fieldOrder: FieldKey[] = [
    'avatar_url',
    'nickname',
    'gender',
    'height',
    'weight',
    'target_body_parts',
    'fitness_goal',
    'fitness_level',
    'interest_tags',
    'equipment',
    'session_duration',
];

function normalizeArray(value: any): string[] {
    return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

function getOptionLabel(options: Array<{ label: string; value: any }>, value: any) {
    return options.find((item) => item.value === value)?.label || String(value || '');
}

function getFieldValue(profile: Record<string, any> | null, answers: Record<string, any>, field: FieldKey) {
    if (field === 'target_body_parts' || field === 'interest_tags' || field === 'equipment' || field === 'session_duration') {
        return answers[field];
    }
    return profile?.[field];
}

function formatFieldValue(profile: Record<string, any> | null, answers: Record<string, any>, field: FieldKey) {
    const value = getFieldValue(profile, answers, field);
    if (field === 'avatar_url') return value ? '已设置' : '未填写';
    if (field === 'gender') return getOptionLabel(GENDER_OPTIONS, value) || '未填写';
    if (field === 'fitness_goal') return getOptionLabel(FITNESS_GOAL_OPTIONS, value) || '未填写';
    if (field === 'fitness_level') return getOptionLabel(FITNESS_LEVEL_OPTIONS, value) || '未填写';
    if (field === 'height') return value ? `${value} cm` : '未填写';
    if (field === 'weight') return value ? `${value} kg` : '未填写';
    if (field === 'session_duration') return value ? `${value} 分钟` : '未填写';
    if (field === 'target_body_parts' || field === 'interest_tags' || field === 'equipment') {
        const list = normalizeArray(value);
        return list.length ? list.join('、') : '未填写';
    }
    return String(value || '').trim() || '未填写';
}

function isProfileField(field: FieldKey): field is ProfileFieldKey {
    return ['avatar_url', 'nickname', 'gender', 'height', 'weight', 'fitness_goal', 'fitness_level'].includes(field);
}

export function FitnessProfileCard({ profile, questionnaire, onUpdate }: FitnessProfileCardProps) {
    const { data: session, update: updateSession } = useSession();
    const { showToast } = useToastContext();
    const [editingField, setEditingField] = useState<FieldKey | null>(null);
    const [draftValue, setDraftValue] = useState<any>('');
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const answers = useMemo(() => (questionnaire?.answers || {}) as Record<string, any>, [questionnaire]);

    const openEditor = (field: FieldKey) => {
        const value = getFieldValue(profile, answers, field);
        if (field === 'target_body_parts' || field === 'interest_tags' || field === 'equipment') {
            setDraftValue(normalizeArray(value));
        } else if (field === 'session_duration') {
            setDraftValue(Number(value || 30));
        } else {
            setDraftValue(value ?? '');
        }
        setEditingField(field);
    };

    const closeEditor = () => {
        setEditingField(null);
        setDraftValue('');
    };

    const saveField = async () => {
        if (!editingField || !session?.user?.id) return;

        try {
            setSaving(true);
            if (isProfileField(editingField)) {
                const payload: Record<string, any> = {
                    [editingField]: draftValue === '' ? null : draftValue,
                };
                if (editingField === 'height' || editingField === 'weight') {
                    payload[editingField] = draftValue != null && Number(draftValue) > 0 ? Number(draftValue) : null;
                }
                const saved = await studentService.updateProfile(payload);
                if (!saved) throw new Error('资料保存失败');
                if (editingField === 'nickname' || editingField === 'avatar_url') {
                    await updateSession().catch(() => null);
                }
            } else {
                const nextAnswers = {
                    ...answers,
                    flow_version: 'miniapp_v1_aligned',
                    [editingField]: editingField === 'session_duration' ? Number(draftValue || 30) : normalizeArray(draftValue),
                };
                const saved = await studentService.submitOnboarding({
                    userId: session.user.id,
                    answers: nextAnswers,
                    baseline_video_urls: [],
                });
                if (!saved) throw new Error('资料保存失败');
            }

            showToast({ severity: 'success', summary: '已保存' });
            closeEditor();
            onUpdate();
        } catch (error: any) {
            showToast({ severity: 'error', summary: '保存失败', detail: error?.message || '请稍后再试' });
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        try {
            setUploadingAvatar(true);
            const form = new FormData();
            form.append('file', file);
            const res = await fetch('/api/upload/avatar', {
                method: 'POST',
                body: form,
            });
            const data = await res.json().catch(() => ({}));
            if (!data?.success || !data?.data?.url) {
                throw new Error(data?.message || '头像上传失败');
            }
            setDraftValue(data.data.url);
            showToast({ severity: 'success', summary: '头像已上传' });
        } catch (error: any) {
            showToast({ severity: 'error', summary: '头像上传失败', detail: error?.message || '请稍后再试' });
        } finally {
            setUploadingAvatar(false);
        }
    };

    const renderEditor = () => {
        if (!editingField) return null;
        if (editingField === 'gender') {
            return <Dropdown value={draftValue} options={GENDER_OPTIONS} onChange={(e) => setDraftValue(e.value)} className="w-full" />;
        }
        if (editingField === 'fitness_goal') {
            return <Dropdown value={draftValue} options={FITNESS_GOAL_OPTIONS} onChange={(e) => setDraftValue(e.value)} className="w-full" />;
        }
        if (editingField === 'fitness_level') {
            return <Dropdown value={draftValue} options={FITNESS_LEVEL_OPTIONS} onChange={(e) => setDraftValue(e.value)} className="w-full" />;
        }
        if (editingField === 'session_duration') {
            return <Dropdown value={draftValue} options={DURATION_OPTIONS} onChange={(e) => setDraftValue(e.value)} className="w-full" />;
        }
        if (editingField === 'target_body_parts') {
            return <MultiSelect value={draftValue} options={TARGET_BODY_PART_OPTIONS} onChange={(e) => setDraftValue(e.value)} className="w-full" display="chip" />;
        }
        if (editingField === 'interest_tags') {
            return <MultiSelect value={draftValue} options={INTEREST_OPTIONS} onChange={(e) => setDraftValue(e.value)} className="w-full" display="chip" />;
        }
        if (editingField === 'equipment') {
            return <MultiSelect value={draftValue} options={EQUIPMENT_OPTIONS} onChange={(e) => setDraftValue(e.value)} className="w-full" display="chip" />;
        }
        if (editingField === 'height' || editingField === 'weight') {
            return (
                <InputNumber
                    value={draftValue === '' ? null : Number(draftValue)}
                    onValueChange={(e) => setDraftValue(e.value)}
                    min={editingField === 'height' ? 100 : 30}
                    max={editingField === 'height' ? 250 : 200}
                    suffix={editingField === 'height' ? ' cm' : ' kg'}
                    className="w-full"
                />
            );
        }
        if (editingField === 'avatar_url') {
            return (
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-surface-100 border border-surface-200 flex items-center justify-center">
                            {draftValue ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={String(draftValue)} alt="avatar preview" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-xs text-surface-400">头像</span>
                            )}
                        </div>
                        <div className="flex-1">
                            <InputText value={String(draftValue || '')} onChange={(e) => setDraftValue(e.target.value)} className="w-full" placeholder="粘贴头像 URL，或上传本地图片" />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="inline-flex h-10 items-center justify-center rounded-xl border border-surface-200 bg-surface-50 px-4 text-sm font-medium cursor-pointer hover:bg-surface-100 transition-colors">
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                className="hidden"
                                onChange={handleAvatarFileChange}
                            />
                            选择头像
                        </label>
                        {uploadingAvatar ? <span className="text-xs text-surface-500">上传中...</span> : null}
                    </div>
                </div>
            );
        }
        return <InputText value={String(draftValue || '')} onChange={(e) => setDraftValue(e.target.value)} className="w-full" />;
    };

    return (
        <>
            <section className="rounded-2xl border border-surface-200 bg-surface shadow-sm p-4 sm:p-6">
                <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                        <div className="flex items-center gap-2 text-surface-900 font-black text-lg">
                            <Dumbbell size={20} className="text-primary-500" />
                            健身资料卡
                        </div>
                        <p className="mt-1 text-sm text-surface-500">
                            与注册引导保持同一套问题。点击任意字段即可单独修改。
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {fieldOrder.map((field) => {
                        const value = formatFieldValue(profile, answers, field);
                        return (
                            <button
                                key={field}
                                type="button"
                                onClick={() => openEditor(field)}
                                className="text-left rounded-2xl border border-surface-100 bg-surface-50 px-4 py-3 hover:border-primary-200 hover:bg-primary-50/40 transition-colors"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-xs font-bold text-surface-500">{FIELD_LABELS[field]}</span>
                                    <Pencil size={14} className="text-surface-400" />
                                </div>
                                <div className={`mt-1 text-sm font-black ${value === '未填写' ? 'text-surface-400' : 'text-surface-900'}`}>
                                    {value}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </section>

            <Dialog
                header={editingField ? `编辑${FIELD_LABELS[editingField]}` : ''}
                visible={!!editingField}
                onHide={closeEditor}
                style={{ width: 'min(520px, calc(100vw - 32px))' }}
                footer={(
                    <div className="flex gap-2 justify-end">
                        <Button label="取消" outlined onClick={closeEditor} />
                        <Button label="保存" loading={saving} onClick={saveField} />
                    </div>
                )}
            >
                <div className="pt-2">{renderEditor()}</div>
            </Dialog>
        </>
    );
}
