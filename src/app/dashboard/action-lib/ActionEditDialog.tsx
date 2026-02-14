'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { MultiSelect } from 'primereact/multiselect';
import { Dropdown } from 'primereact/dropdown';
import { InputSwitch } from 'primereact/inputswitch';
import { ProgressBar } from 'primereact/progressbar';
import { CoachActionRow, ItemType } from '@/types';
import { useToastContext } from '@/context/ToastContext';
import { actionLibService } from '@/app/service/actionLibService';
import { useAnalytics } from '@/hooks/useAnalytics';

interface ActionEditDialogProps {
    visible: boolean;
    action?: CoachActionRow | null;
    onSave: (action: Partial<CoachActionRow>) => Promise<void>;
    onCancel: () => void;
}

type AttrPreset = {
    key: string;
    name: string;
    attrs: string[];
    examples: string;
};

const ATTR_PRESETS: Record<ItemType, AttrPreset[]> = {
    STRENGTH: [
        { key: "strength_reps", name: "力量-次数型", attrs: ["组数", "次数", "强度", "休息时间"], examples: "俯卧撑/引体向上/深蹲/卧推" },
        { key: "strength_duration", name: "力量-时长型", attrs: ["组数", "持续时间", "强度", "休息时间"], examples: "平板支撑/L-sit/单手悬垂" },
        { key: "strength_recovery_rep", name: "力量-恢复型(次数)", attrs: ["组数", "次数", "休息时间"], examples: "康复训练/弹力带激活" },
        { key: "strength_recovery_duration", name: "力量-恢复型(时长)", attrs: ["组数", "持续时间", "休息时间"], examples: "泡沫轴/拉伸保持" },
    ],
    CARDIO: [
        { key: "cardio_distance", name: "有氧-距离型", attrs: ["距离", "配速", "持续时间"], examples: "跑步/骑行/游泳" },
        { key: "cardio_interval", name: "有氧-间歇型", attrs: ["冲刺时长", "间歇时长", "循环次数", "强度"], examples: "间歇跑/跳绳 Tabata" },
    ],
    DIET: [
        { key: "diet_combo", name: "饮食-复合摄入", attrs: ["食物清单", "热量", "宏量营养"], examples: "正餐记录/增肌餐" },
        { key: "diet_single", name: "饮食-单一计量", attrs: ["摄入量", "时间点"], examples: "喝水/蛋白粉/补剂" },
    ],
    HABIT: [
        { key: "habit_stats", name: "习惯-统计型", attrs: ["目标数值", "完成状态"], examples: "步数/冥想时长" },
        { key: "habit_behavior", name: "习惯-行为型", attrs: ["完成状态"], examples: "早睡/阅读打卡" },
    ],
};

const ActionEditDialog: React.FC<ActionEditDialogProps> = ({
    visible,
    action,
    onSave,
    onCancel
}) => {
    const { showToast } = useToastContext();
    const { trackEvent } = useAnalytics();
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
    const [customAttr, setCustomAttr] = useState('');
    const [loading, setLoading] = useState(false);

    const [uploadingDemoVideo, setUploadingDemoVideo] = useState(false);
    const [demoVideoUploadProgress, setDemoVideoUploadProgress] = useState<number>(0);
    const demoVideoInputRef = React.useRef<HTMLInputElement>(null);

    // 视频预览相关
    const [videoModalVisible, setVideoModalVisible] = useState(false);
    const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

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

    const currentPresets = ATTR_PRESETS[itemType] || [];
    const attrOptions = useMemo(() => {
        const base = currentPresets.flatMap((p) => p.attrs);
        const merged = Array.from(new Set([...base, ...attrs]));
        return merged.map((v) => ({ label: v, value: v }));
    }, [currentPresets, attrs]);

    // 判断URL是否可以在页面内播放
    const canPlayInlineVideo = (url?: string | null) => {
        if (!url) return false;
        if (url.startsWith("blob:")) return true;

        const lower = url.toLowerCase();
        // 常见可被 <video> 直接播放的直链扩展名
        if (
            lower.endsWith(".mp4") ||
            lower.endsWith(".webm") ||
            lower.endsWith(".mov") ||
            lower.endsWith(".m4v") ||
            lower.endsWith(".ogg") ||
            lower.includes(".mp4?") ||
            lower.includes(".webm?") ||
            lower.includes(".mov?") ||
            lower.includes(".m4v?") ||
            lower.includes(".ogg?")
        ) {
            return true;
        }

        // Supabase Storage public / signed URL 一般可直接播放（不依赖前端 env）
        if (url.includes("/storage/v1/object/")) return true;

        return false;
    };

    // 打开视频预览
    const openVideo = (videoUrl?: string | null) => {
        if (!videoUrl) return;

        if (canPlayInlineVideo(videoUrl)) {
            setCurrentVideoUrl(videoUrl);
            setVideoModalVisible(true);
            return;
        }

        // 外站页面链接（B站/抖音/YouTube 等）无法用 <video> 播放：直接跳转
        showToast({
            severity: "info",
            summary: "外部视频链接",
            detail: "该链接无法在页面内播放，已为你打开新窗口观看",
        });
        window.open(videoUrl, "_blank");
    };

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

    const handleSave = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            showToast({
                severity: "warn",
                summary: "请填写名称",
                detail: "动作名称不能为空",
            });
            return;
        }

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
                name: trimmedName,
                detail: detail.trim() || null,
                url: url || undefined,
                positions,
                attrs,
                type: itemType,
                enableAutoWeightCompute: itemType === 'STRENGTH' ? enableAutoWeightCompute : false,
                includesBodyWeight: itemType === 'STRENGTH' && enableAutoWeightCompute ? includesBodyWeight : false,
                suggested_time: itemType === 'DIET' && suggestedTime ? suggestedTime : null,
                item_schema: Object.keys(itemSchema).length > 0 ? itemSchema : null,
            };
            await onSave(actionData);

            trackEvent('coach_action_upsert', 'coach_content', {
                is_create: !action?.id,
                type: itemType,
                name_length: name.length,
                has_video: !!url
            });
        } finally { setLoading(false); }
    };

    const handleUploadDemoVideo = async (file?: File) => {
        if (!file) return;
        try {
            setUploadingDemoVideo(true);
            setDemoVideoUploadProgress(0);
            const res = await actionLibService.uploadDemoVideo(file, (p) => {
                setDemoVideoUploadProgress(p);
            });
            if (res?.url) {
                setUrl(res.url);
                
                trackEvent('coach_action_video_upload', 'coach_content', {
                    action_name: name,
                    file_size: file.size
                });

                showToast({
                    severity: "success",
                    summary: "上传成功",
                    detail: "已自动回填演示视频链接",
                });
                if (demoVideoInputRef.current) {
                    // 允许重复选择同一个文件触发 onChange
                    demoVideoInputRef.current.value = "";
                }
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
            setDemoVideoUploadProgress(0);
        }
    };

    const handleApplyPreset = (preset: AttrPreset) => {
        setAttrs(preset.attrs);
    };

    const handleAddCustomAttr = () => {
        const normalized = customAttr.trim();
        if (!normalized) return;
        if (!attrs.includes(normalized)) {
            setAttrs((prev) => [...prev, normalized]);
        }
        setCustomAttr('');
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
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-bold text-surface-500">动作属性（可套用组合，也可自定义）</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {currentPresets.map((preset) => (
                                <button
                                    key={preset.key}
                                    type="button"
                                    onClick={() => handleApplyPreset(preset)}
                                    className="text-left rounded-xl border border-surface-200 bg-surface p-2 hover:border-primary-300"
                                >
                                    <div className="text-xs font-semibold text-surface-700">{preset.name}</div>
                                    <div className="text-[11px] text-surface-500 mt-1">{preset.attrs.join(" / ")}</div>
                                    <div className="text-[11px] text-surface-500">例：{preset.examples}</div>
                                </button>
                            ))}
                        </div>
                        <MultiSelect
                            value={attrs}
                            options={attrOptions}
                            onChange={(e) => setAttrs(e.value)}
                            placeholder="选择属性（可多选）"
                            display={isMobile ? 'comma' : 'chip'}
                            className="rounded-xl w-full"
                        />
                        <div className="p-inputgroup">
                            <InputText
                                value={customAttr}
                                onChange={(e) => setCustomAttr(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddCustomAttr();
                                    }
                                }}
                                placeholder="自定义属性，如：节奏控制、离心时长"
                            />
                            <Button type="button" label="添加" onClick={handleAddCustomAttr} />
                        </div>
                    </div>
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
                                label={uploadingDemoVideo ? `上传中... ${demoVideoUploadProgress}%` : "上传视频"}
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
                        {uploadingDemoVideo && (
                            <div className="mt-2">
                                <div className="flex justify-between text-[10px] font-black text-primary-500 uppercase tracking-widest mb-2">
                                    <span>视频上传中...</span>
                                    <span>{demoVideoUploadProgress}%</span>
                                </div>
                                <ProgressBar
                                    value={demoVideoUploadProgress}
                                    showValue={false}
                                    style={{ height: '6px' }}
                                    className="rounded-full overflow-hidden bg-surface-100"
                                />
                            </div>
                        )}

                        {/* 视频预览区域 */}
                        {url && !uploadingDemoVideo && (
                            <div className="mt-3 p-4 bg-surface-50 rounded-xl border border-surface-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-surface-600">视频预览</span>
                                    <Button
                                        type="button"
                                        icon="pi pi-play"
                                        label="查看视频"
                                        size="small"
                                        className="p-button-text p-button-sm text-primary-500"
                                        onClick={() => openVideo(url)}
                                    />
                                </div>
                                {canPlayInlineVideo(url) ? (
                                    <div className="aspect-video rounded-lg overflow-hidden bg-surface-900 relative group cursor-pointer"
                                        onClick={() => openVideo(url)}>
                                        <video
                                            src={url}
                                            className="w-full h-full object-cover"
                                            preload="metadata"
                                            muted
                                            playsInline
                                            onLoadedMetadata={(e) => {
                                                try { e.currentTarget.currentTime = 0.1; } catch { /* ignore */ }
                                            }}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                        <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <i className="pi pi-play-circle text-white text-4xl" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 p-3 bg-surface-100 rounded-lg">
                                        <i className="pi pi-external-link text-surface-400" />
                                        <span className="text-xs text-surface-500 flex-1">外部视频链接</span>
                                        <Button
                                            type="button"
                                            icon="pi pi-external-link"
                                            label="打开链接"
                                            size="small"
                                            className="p-button-text p-button-sm"
                                            onClick={() => window.open(url, "_blank")}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 视频播放模态框 */}
            <Dialog
                visible={videoModalVisible}
                onHide={() => {
                    setVideoModalVisible(false);
                    setCurrentVideoUrl(null);
                }}
                header="查看演示视频"
                style={isMobile ? { width: '100vw', height: '100dvh', margin: 0 } : { width: '90vw', maxWidth: '800px' }}
                position={isMobile ? 'bottom' : 'center'}
                modal
                dismissableMask
                pt={isMobile ? {
                    root: { className: 'm-0 p-0 rounded-none overflow-hidden' },
                    header: { className: 'px-4 py-3 border-b border-surface-200 bg-surface sticky top-0 z-10' },
                    content: { className: 'px-4 py-4 bg-surface overflow-auto' },
                } : {
                    root: { className: 'rounded-2xl overflow-hidden' },
                    header: { className: 'px-6 py-4 border-b border-surface-200 bg-surface' },
                    content: { className: 'px-6 py-5 bg-surface' },
                }}
            >
                {currentVideoUrl && (
                    <div className="flex justify-center">
                        <video
                            src={currentVideoUrl}
                            controls
                            autoPlay
                            className="w-full max-h-[70vh] rounded-lg"
                            style={{ backgroundColor: '#000' }}
                        >
                            您的浏览器不支持视频播放
                        </video>
                    </div>
                )}
            </Dialog>
        </Dialog>
    );
};

export default ActionEditDialog;