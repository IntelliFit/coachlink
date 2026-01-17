'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { MultiSelect } from 'primereact/multiselect';
import { Dropdown } from 'primereact/dropdown';
import { InputSwitch } from 'primereact/inputswitch';
import { AutoComplete } from 'primereact/autocomplete';
import { CoachActionRow, ItemType } from '@/types';
import { CanonicalAction } from '@/types/canonical';
import { useToastContext } from '@/context/ToastContext';
import { actionLibService } from '@/app/service/actionLibService';

interface ActionEditDialogProps {
    visible: boolean;
    action?: CoachActionRow | null;
    onSave: (action: Partial<CoachActionRow>) => Promise<void>;
    onCancel: () => void;
}

const ActionEditDialog: React.FC<ActionEditDialogProps> = ({
    visible,
    action,
    onSave,
    onCancel
}) => {
    const { showToast } = useToastContext();
    // ... [保持所有 useState 逻辑不变] ...
    const [name, setName] = useState('');
    const [detail, setDetail] = useState('');
    const [url, setUrl] = useState('');
    const [positions, setPositions] = useState<string[]>([]);
    const [attrs, setAttrs] = useState<string[]>([]);
    const [itemType, setItemType] = useState<ItemType>('STRENGTH');
    const [suggestedTime, setSuggestedTime] = useState<string>('');
    const [calories, setCalories] = useState<number | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [duration, setDuration] = useState<number | null>(null);
    const [pace, setPace] = useState<number | null>(null);
    const [targetDuration, setTargetDuration] = useState<number | null>(null);
    const [enableAutoWeightCompute, setEnableAutoWeightCompute] = useState<boolean>(false);
    const [includesBodyWeight, setIncludesBodyWeight] = useState<boolean>(false);
    const [loading, setLoading] = useState(false);
    const [canonicalActionId, setCanonicalActionId] = useState<string | null>(null);
    const [canonicalActions, setCanonicalActions] = useState<CanonicalAction[]>([]);
    const [filteredCanonicalActions, setFilteredCanonicalActions] = useState<CanonicalAction[]>([]);
    const [selectedCanonical, setSelectedCanonical] = useState<CanonicalAction | null>(null);

    const [uploadingDemoVideo, setUploadingDemoVideo] = useState(false);
    const demoVideoInputRef = React.useRef<HTMLInputElement>(null);

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mql = window.matchMedia('(max-width: 640px)');
        const update = () => setIsMobile(mql.matches);
        update();
        mql.addEventListener?.('change', update);
        return () => mql.removeEventListener?.('change', update);
    }, []);

    const itemTypeOptions = [
        { label: '力量训练', value: 'STRENGTH', icon: 'pi-sliders-h', color: 'text-orange-500' },
        { label: '饮食管理', value: 'DIET', icon: 'pi-apple', color: 'text-green-500' },
        { label: '有氧运动', value: 'CARDIO', icon: 'pi-bolt', color: 'text-blue-500' },
        { label: '习惯打卡', value: 'HABIT', icon: 'pi-heart', color: 'text-purple-500' }
    ];

    const actionTypes = [
        { label: '胸部', value: '胸部' }, { label: '背部', value: '背部' },
        { label: '腿部', value: '腿部' }, { label: '肩部', value: '肩部' },
        { label: '手臂', value: '手臂' }, { label: '核心', value: '核心' },
        { label: '其他', value: '其他' }
    ];

    const actionAttrs = [
        { label: '组数(sets)', value: '组数' }, { label: '次数(reps)', value: '次数' },
        { label: '强度(RM)', value: '强度' }, { label: '持续时间', value: '持续时间' },
        { label: '休息时间', value: '休息时间' }
    ];

    useEffect(() => {
        if (action) {
            setName(action.name);
            setDetail(action.detail || '');
            setUrl(action.url || '');
            setPositions(action.positions || []);
            setAttrs(action.attrs || []);
            setItemType((action.type as ItemType) || 'STRENGTH');
            setEnableAutoWeightCompute(action.enableAutoWeightCompute || false);
            setIncludesBodyWeight(action.includesBodyWeight || false);
            setSuggestedTime(action.suggested_time || '');
            const schema = action.item_schema as any || {};
            setCalories(schema.calories || null);
            setDistance(schema.distance ? schema.distance / 1000 : null);
            setDuration(schema.duration ? schema.duration / 60 : null);
            setPace(schema.pace || null);
            setTargetDuration(schema.target_duration || null);
        } else {
            setName(''); setDetail(''); setUrl(''); setPositions([]);
            setAttrs(['组数', '次数', '强度', '休息时间']);
            setItemType('STRENGTH'); setEnableAutoWeightCompute(false); setIncludesBodyWeight(false);
            setSuggestedTime(''); setCalories(null); setDistance(null); setDuration(null); setPace(null); setTargetDuration(null);
        }
    }, [action, visible]);

    useEffect(() => {
        const fetchCanonicalActions = async () => {
            try {
                const res = await fetch('/api/canonical-actions/list');
                const data = await res.json();
                if (data.success) {
                    setCanonicalActions(data.data);
                    if (action?.canonical_action_id) {
                        const linked = data.data.find((c: CanonicalAction) => c.id === action.canonical_action_id);
                        setSelectedCanonical(linked || null);
                        setCanonicalActionId(action.canonical_action_id);
                    }
                }
            } catch (e) { }
        };
        if (visible) fetchCanonicalActions();
    }, [visible, action]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const itemSchema: any = {};
            if (itemType === 'DIET' && calories) itemSchema.calories = calories;
            else if (itemType === 'CARDIO') {
                if (distance) itemSchema.distance = distance * 1000;
                if (duration) itemSchema.duration = duration * 60;
                if (pace) itemSchema.pace = pace;
            } else if (itemType === 'HABIT' && targetDuration) itemSchema.target_duration = targetDuration;

            const actionData: Partial<CoachActionRow> = {
                id: action?.id,
                name, detail, url: url || undefined, positions, attrs, type: itemType,
                enableAutoWeightCompute: itemType === 'STRENGTH' ? enableAutoWeightCompute : false,
                includesBodyWeight: itemType === 'STRENGTH' && enableAutoWeightCompute ? includesBodyWeight : false,
                suggested_time: itemType === 'DIET' && suggestedTime ? suggestedTime : null,
                item_schema: Object.keys(itemSchema).length > 0 ? itemSchema : null,
                canonical_action_id: canonicalActionId
            };
            await onSave(actionData);
        } finally { setLoading(false); }
    };

    const handleUploadDemoVideo = async (file?: File) => {
        if (!file) return;
        try {
            setUploadingDemoVideo(true);
            const res = await actionLibService.uploadDemoVideo(file);
            if (res?.url) {
                setUrl(res.url);
                showToast({
                    severity: "success",
                    summary: "上传成功",
                    detail: "已自动回填演示视频链接",
                });
            } else {
                showToast({
                    severity: "error",
                    summary: "上传失败",
                    detail: "未获取到视频链接",
                });
            }
        } catch (e: any) {
            showToast({
                severity: "error",
                summary: "上传失败",
                detail: e?.message || "请稍后再试",
            });
        } finally {
            setUploadingDemoVideo(false);
        }
    };

    const footerContent = (
        <div className={`flex items-center gap-3 pt-4 border-t border-surface-100 ${isMobile ? 'justify-between w-full' : 'justify-end'}`}>
            <Button
                label="取消"
                text
                onClick={onCancel}
                className={`p-button-secondary font-bold ${isMobile ? 'flex-1' : ''}`}
                disabled={loading}
            />
            <Button
                label="确认保存"
                icon="pi pi-check"
                onClick={handleSave}
                loading={loading}
                className={`p-button-primary rounded-xl px-6 shadow-lg shadow-primary-100 ${isMobile ? 'flex-1' : ''}`}
            />
        </div>
    );

    const dialogPt = useMemo(() => {
        if (isMobile) {
            return {
                root: { className: 'm-0 p-0 rounded-none overflow-hidden' },
                header: { className: 'px-4 py-3 border-b border-surface-200 bg-surface sticky top-0 z-10' },
                content: { className: 'px-4 py-4 bg-surface overflow-auto' },
                footer: { className: 'px-4 py-3 border-t border-surface-200 bg-surface sticky bottom-0 z-10' },
            };
        }
        return {
            root: { className: 'rounded-2xl overflow-hidden' },
            header: { className: 'px-6 py-4 border-b border-surface-200 bg-surface' },
            content: { className: 'px-6 py-5 bg-surface' },
            footer: { className: 'px-6 py-4 border-t border-surface-200 bg-surface' },
        };
    }, [isMobile]);

    return (
        <Dialog
            header={<div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                    <i className={`pi ${action ? 'pi-pencil' : 'pi-plus'} text-primary-500 text-sm`} />
                </div>
                <span className="font-black text-xl tracking-tight text-surface-900">{action ? "编辑动作" : "添加动作"}</span>
            </div>}
            visible={visible}
            modal
            draggable={false}
            resizable={false}
            dismissableMask
            style={isMobile ? { width: '100vw', height: '100dvh', margin: 0 } : { width: '600px', maxWidth: '95vw' }}
            position={isMobile ? 'bottom' : 'center'}
            onHide={onCancel}
            footer={footerContent}
            className="aero-dialog p-fluid"
            maskClassName="backdrop-blur-sm"
            pt={dialogPt as any}
        >
            <div className="flex flex-col gap-6 py-2">

                {/* 1. 类型选择 - 视觉强调 */}
                <div className="flex flex-col gap-2.5">
                    <label className="text-[11px] font-black uppercase tracking-widest text-surface-400 ml-1">项目分类</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {itemTypeOptions.map((opt) => (
                            <div
                                key={opt.value}
                                onClick={() => setItemType(opt.value as ItemType)}
                                className={`flex flex-col items-center justify-center p-3 rounded-2xl border cursor-pointer transition-all duration-300
                                    ${itemType === opt.value
                                        ? 'bg-white border-primary-500 shadow-md ring-2 ring-primary-50'
                                        : 'bg-surface-50 border-transparent hover:bg-white hover:border-surface-200'}`}
                            >
                                <i className={`pi ${opt.icon} mb-2 text-lg ${itemType === opt.value ? opt.color : 'text-surface-400'}`} />
                                <span className={`text-[12px] font-bold ${itemType === opt.value ? 'text-surface-900' : 'text-surface-500'}`}>{opt.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. 基础名称 */}
                <div className="flex flex-col gap-2.5">
                    <label className="text-[11px] font-black uppercase tracking-widest text-surface-400 ml-1">
                        {itemType === 'DIET' ? '饮食名称' : itemType === 'HABIT' ? '习惯名称' : '动作名称'}
                    </label>
                    <InputText
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={itemType === 'DIET' ? '如：健康轻食午餐' : itemType === 'HABIT' ? '如：每日早起冥想' : '输入动作全称...'}
                        className="w-full rounded-xl border-surface-200 focus:border-primary-500 py-3"
                    />
                </div>

                {/* 3. 动态属性区域 - 使用阴影卡片区分 */}
                <div className="bg-surface-50/50 p-4 rounded-[24px] border border-surface-100 flex flex-col gap-5">

                    {/* 公共库 - 仅力量 */}
                    {itemType === 'STRENGTH' && (
                        <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-bold text-surface-500 ml-1">关联标准库</label>
                            <AutoComplete
                                value={selectedCanonical}
                                suggestions={filteredCanonicalActions}
                                completeMethod={(e) => {
                                    const query = e.query.toLowerCase();
                                    setFilteredCanonicalActions(canonicalActions.filter(c =>
                                        c.name.toLowerCase().includes(query) || c.aliases.some(a => a.toLowerCase().includes(query))
                                    ));
                                }}
                                field="name"
                                onChange={(e) => { setSelectedCanonical(e.value); setCanonicalActionId(e.value?.id || null); }}
                                dropdown
                                placeholder="搜索标准动作..."
                                className="w-full aero-autocomplete"
                            />
                        </div>
                    )}

                    {/* 饮食字段 */}
                    {itemType === 'DIET' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-300">
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-surface-500 ml-1">热量估算 (kcal)</label>
                                <InputText type="number" value={calories !== null ? String(calories) : ''}
                                    onChange={(e) => setCalories(Number(e.target.value))} className="rounded-xl" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-surface-500 ml-1">推荐进食时间</label>
                                <InputText type="time" value={suggestedTime}
                                    onChange={(e) => setSuggestedTime(e.target.value)} className="rounded-xl" />
                            </div>
                        </div>
                    )}

                    {/* 有氧字段 */}
                    {itemType === 'CARDIO' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-surface-500 ml-1 text-center">距离 (km)</label>
                                <InputText type="number" value={distance !== null ? String(distance) : ''} onChange={(e) => setDistance(Number(e.target.value))} className="rounded-xl text-center" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-surface-500 ml-1 text-center">时长 (min)</label>
                                <InputText type="number" value={duration !== null ? String(duration) : ''} onChange={(e) => setDuration(Number(e.target.value))} className="rounded-xl text-center" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-surface-500 ml-1 text-center">配速 (m/k)</label>
                                <InputText type="number" value={pace !== null ? String(pace) : ''} onChange={(e) => setPace(Number(e.target.value))} className="rounded-xl text-center" />
                            </div>
                        </div>
                    )}

                    {/* 习惯字段 */}
                    {itemType === 'HABIT' && (
                        <div className="flex flex-col gap-2 animate-in fade-in duration-300">
                            <label className="text-[11px] font-bold text-surface-500 ml-1">目标达成量 (分钟/次数)</label>
                            <InputText type="number" value={targetDuration !== null ? String(targetDuration) : ''}
                                onChange={(e) => setTargetDuration(Number(e.target.value))} className="rounded-xl" placeholder="例如: 10" />
                        </div>
                    )}

                    {/* 力量训练 - 特有开关与选择 */}
                    {itemType === 'STRENGTH' && (
                        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                            <div className={`p-4 rounded-2xl border transition-all ${enableAutoWeightCompute ? 'bg-primary-50 border-primary-200' : 'bg-white border-surface-100'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-surface-900">智能重量计算</span>
                                        <span className="text-[11px] text-surface-500">将会计入学员问卷并支持在计划生成中为该动作自动计算负重</span>
                                    </div>
                                    <InputSwitch checked={enableAutoWeightCompute} onChange={(e) => setEnableAutoWeightCompute(e.value || false)} />
                                </div>
                                {enableAutoWeightCompute && (
                                    <div className="mt-4 pt-4 border-t border-primary-100 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[12px] font-bold text-surface-900">是否包含自身体重</span>
                                            <span className="text-[11px] text-surface-500">如引体向上，将会影响自动计算结果</span>
                                        </div>

                                        <InputSwitch checked={includesBodyWeight} onChange={(e) => setIncludesBodyWeight(e.value || false)} />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-surface-500">训练部位</label>
                                <MultiSelect value={positions} options={actionTypes} onChange={(e) => setPositions(e.value)}
                                    placeholder="请选择" display={isMobile ? 'comma' : 'chip'} className="rounded-xl w-full" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-surface-500">动作属性</label>
                                <MultiSelect value={attrs} options={actionAttrs} onChange={(e) => setAttrs(e.value)}
                                    placeholder="请选择" display={isMobile ? 'comma' : 'chip'} className="rounded-xl w-full" />
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. 描述与链接 */}
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2.5">
                        <label className="text-[11px] font-black uppercase tracking-widest text-surface-400 ml-1">详细描述</label>
                        <InputTextarea
                            value={detail}
                            onChange={(e) => setDetail(e.target.value)}
                            rows={3}
                            placeholder="填写详细的操作要求、注意事项或习惯说明..."
                            className="rounded-xl border-surface-200"
                        />
                    </div>

                    <div className="flex flex-col gap-2.5">
                        <label className="text-[11px] font-black uppercase tracking-widest text-surface-400 ml-1">演示视频 URL</label>
                        <div className="p-inputgroup flex-1">
                            <span className="p-inputgroup-addon bg-surface-50 rounded-l-xl border-surface-200">
                                <i className="pi pi-video text-surface-400" />
                            </span>
                            <InputText
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://..."
                                className="rounded-r-xl border-surface-200"
                            />
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <input
                                ref={demoVideoInputRef}
                                type="file"
                                accept="video/*"
                                className="hidden"
                                onChange={(e) => handleUploadDemoVideo(e.target.files?.[0])}
                            />
                            <Button
                                type="button"
                                icon="pi pi-upload"
                                label={uploadingDemoVideo ? "上传中..." : "上传视频"}
                                disabled={uploadingDemoVideo}
                                loading={uploadingDemoVideo}
                                className="p-button-outlined rounded-xl"
                                onClick={() => demoVideoInputRef.current?.click()}
                            />
                            <Button
                                type="button"
                                icon="pi pi-times"
                                label="清空"
                                severity="secondary"
                                text
                                className="rounded-xl"
                                onClick={() => setUrl('')}
                                disabled={uploadingDemoVideo}
                            />
                            <span className="text-xs text-surface-500 hidden sm:inline">
                                支持 MP4/WEBM，≤100MB。上传后会自动回填到 URL。
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </Dialog>
    );
};

export default ActionEditDialog;