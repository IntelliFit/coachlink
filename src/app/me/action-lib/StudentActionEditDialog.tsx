'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { MultiSelect } from 'primereact/multiselect';
import { InputSwitch } from 'primereact/inputswitch';
import { StudentActionRow, ItemType } from '@/types/student';

interface StudentActionEditDialogProps {
    visible: boolean;
    action?: StudentActionRow | null;
    onSave: (action: Partial<StudentActionRow>) => Promise<void>;
    onCancel: () => void;
}

const StudentActionEditDialog: React.FC<StudentActionEditDialogProps> = ({
    visible,
    action,
    onSave,
    onCancel
}) => {
    const [name, setName] = useState('');
    const [detail, setDetail] = useState('');
    const [url, setUrl] = useState('');
    const [positions, setPositions] = useState<string[]>([]);
    const [attrs, setAttrs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // 项目类型状态
    const [itemType, setItemType] = useState<ItemType>('STRENGTH');
    
    // 饮食类型字段
    const [suggestedTime, setSuggestedTime] = useState<string>('');
    const [calories, setCalories] = useState<number | null>(null);
    
    // 有氧类型字段
    const [distance, setDistance] = useState<number | null>(null);
    const [duration, setDuration] = useState<number | null>(null);
    const [pace, setPace] = useState<number | null>(null);
    
    // 习惯类型字段
    const [targetDuration, setTargetDuration] = useState<number | null>(null);

    // 新增状态：自动计算负重
    const [enableAutoWeightCompute, setEnableAutoWeightCompute] = useState<boolean>(false);
    const [includesBodyWeight, setIncludesBodyWeight] = useState<boolean>(false);
    
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mql = window.matchMedia('(max-width: 640px)');
        const update = () => setIsMobile(mql.matches);
        update();
        mql.addEventListener?.('change', update);
        return () => mql.removeEventListener?.('change', update);
    }, []);

    const actionTypes = [
        { label: '胸部', value: '胸部' },
        { label: '背部', value: '背部' },
        { label: '腿部', value: '腿部' },
        { label: '肩部', value: '肩部' },
        { label: '手臂', value: '手臂' },
        { label: '核心', value: '核心' },
        { label: '其他', value: '其他' }
    ];

    const actionAttrs = [
        { label: '组数(sets)', value: '组数' },
        { label: '次数(reps)', value: '次数' },
        { label: '强度', value: '强度' },
        { label: '持续时间', value: '持续时间' },
        { label: '休息时间', value: '休息时间' }
    ];

    // 项目类型选项（与教练端一致）
    const itemTypeOptions = [
        { label: '力量训练', value: 'STRENGTH', icon: 'pi-sliders-h', color: 'text-orange-500' },
        { label: '饮食管理', value: 'DIET', icon: 'pi-apple', color: 'text-green-500' },
        { label: '有氧运动', value: 'CARDIO', icon: 'pi-bolt', color: 'text-blue-500' },
        { label: '习惯打卡', value: 'HABIT', icon: 'pi-heart', color: 'text-purple-500' }
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
            
            // 解析 item_schema 中的类型特定字段
            const schema = action.item_schema as any || {};
            setCalories(schema.calories || null);
            setDistance(schema.distance ? schema.distance / 1000 : null);
            setDuration(schema.duration ? schema.duration / 60 : null);
            setPace(schema.pace || null);
            setTargetDuration(schema.target_duration || null);
        } else {
            // 重置表单
            setName('');
            setDetail('');
            setUrl('');
            setPositions([]);
            setAttrs(['组数', '次数', '强度', '休息时间']);
            setItemType('STRENGTH');
            setEnableAutoWeightCompute(false);
            setIncludesBodyWeight(false);
            setSuggestedTime('');
            setCalories(null);
            setDistance(null);
            setDuration(null);
            setPace(null);
            setTargetDuration(null);
        }
    }, [action, visible]);

    const handleSave = async () => {
        setLoading(true);
        try {
            // 构建类型特定的 item_schema
            const itemSchema: Record<string, unknown> = {};
            if (itemType === 'DIET' && calories !== null) {
                itemSchema.calories = calories;
            } else if (itemType === 'CARDIO') {
                if (distance !== null) itemSchema.distance = distance * 1000; // 转换为米
                if (duration !== null) itemSchema.duration = duration * 60; // 转换为秒
                if (pace !== null) itemSchema.pace = pace;
            } else if (itemType === 'HABIT' && targetDuration !== null) {
                itemSchema.target_duration = targetDuration;
            }

            const actionData: Partial<StudentActionRow> = {
                name,
                detail,
                url: url || undefined,
                positions: itemType === 'STRENGTH' ? positions : null,
                attrs: itemType === 'STRENGTH' ? attrs : null,
                type: itemType,
                enableAutoWeightCompute: itemType === 'STRENGTH' ? enableAutoWeightCompute : false,
                includesBodyWeight: itemType === 'STRENGTH' && enableAutoWeightCompute ? includesBodyWeight : false,
                suggested_time: itemType === 'DIET' ? (suggestedTime || null) : null,
                item_schema: Object.keys(itemSchema).length > 0 ? itemSchema : null
            };

            if (action) {
                actionData.id = action.id;
            }

            await onSave(actionData);
        } finally {
            setLoading(false);
        }
    };

    const footerContent = (
        <div className={`flex gap-2 ${isMobile ? 'w-full justify-between' : 'justify-end'}`}>
            <Button
                label="取消"
                icon="pi pi-times"
                onClick={onCancel}
                className="p-button-text"
                disabled={loading}
            />
            <Button
                label="保存"
                icon="pi pi-check"
                onClick={handleSave}
                loading={loading}
            />
        </div>
    );

    const dialogPt = useMemo(() => {
        // 小屏：全屏/底部抽屉体验 + 底部按钮区固定感更强
        if (isMobile) {
            return {
                root: { className: 'm-0 p-0 rounded-none sm:rounded-2xl overflow-hidden' },
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
            header={action ? "编辑动作" : "添加动作"}
            visible={visible}
            modal
            draggable={false}
            resizable={false}
            dismissableMask
            style={isMobile ? { width: '100vw', height: '100dvh', margin: 0 } : { width: '600px', maxWidth: '95vw' }}
            position={isMobile ? 'bottom' : 'center'}
            onHide={onCancel}
            footer={footerContent}
            className="p-fluid"
            pt={dialogPt as any}
        >
            <div className="flex flex-col gap-6 py-2">
                {/* 1) 类型选择（同教练端风格） */}
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

                {/* 2) 名称 */}
                <div className="flex flex-col gap-2.5">
                    <label htmlFor="name" className="text-[11px] font-black uppercase tracking-widest text-surface-400 ml-1">
                        {itemType === 'DIET' ? '饮食名称' : itemType === 'HABIT' ? '习惯名称' : '动作名称'} *
                    </label>
                    <InputText
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={itemType === 'DIET' ? '如：健康轻食午餐' : itemType === 'HABIT' ? '如：每日早起冥想' : '输入动作全称...'}
                        required
                        className="w-full rounded-xl border-surface-200 focus:border-primary-500 py-3"
                    />
                </div>

                {/* 3) 动态属性区域 */}
                <div className="bg-surface-50/50 p-4 rounded-[24px] border border-surface-100 flex flex-col gap-5">
                    {/* 饮食字段 */}
                    {itemType === 'DIET' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-300">
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-surface-500 ml-1">热量估算 (kcal)</label>
                                <InputText
                                    type="number"
                                    value={calories !== null ? String(calories) : ''}
                                    onChange={(e) => setCalories(e.target.value === '' ? null : Number(e.target.value))}
                                    className="rounded-xl"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-surface-500 ml-1">推荐进食时间</label>
                                <InputText
                                    type="time"
                                    value={suggestedTime}
                                    onChange={(e) => setSuggestedTime(e.target.value)}
                                    className="rounded-xl"
                                />
                            </div>
                        </div>
                    )}

                    {/* 有氧字段 */}
                    {itemType === 'CARDIO' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-surface-500 ml-1 text-center">距离 (km)</label>
                                <InputText
                                    type="number"
                                    value={distance !== null ? String(distance) : ''}
                                    onChange={(e) => setDistance(e.target.value === '' ? null : Number(e.target.value))}
                                    className="rounded-xl text-center"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-surface-500 ml-1 text-center">时长 (min)</label>
                                <InputText
                                    type="number"
                                    value={duration !== null ? String(duration) : ''}
                                    onChange={(e) => setDuration(e.target.value === '' ? null : Number(e.target.value))}
                                    className="rounded-xl text-center"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-surface-500 ml-1 text-center">配速 (m/k)</label>
                                <InputText
                                    type="number"
                                    value={pace !== null ? String(pace) : ''}
                                    onChange={(e) => setPace(e.target.value === '' ? null : Number(e.target.value))}
                                    className="rounded-xl text-center"
                                />
                            </div>
                        </div>
                    )}

                    {/* 习惯字段 */}
                    {itemType === 'HABIT' && (
                        <div className="flex flex-col gap-2 animate-in fade-in duration-300">
                            <label className="text-[11px] font-bold text-surface-500 ml-1">目标达成量 (分钟/次数)</label>
                            <InputText
                                type="number"
                                value={targetDuration !== null ? String(targetDuration) : ''}
                                onChange={(e) => setTargetDuration(e.target.value === '' ? null : Number(e.target.value))}
                                className="rounded-xl"
                                placeholder="例如: 10"
                            />
                        </div>
                    )}

                    {/* 力量训练专属 */}
                    {itemType === 'STRENGTH' && (
                        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                            <div className="flex flex-col gap-2 p-3 bg-surface-50 rounded-2xl border border-surface-200">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="font-medium flex items-center gap-2">
                                            <i className="pi pi-bolt text-orange-500"></i>
                                            <span>智能重量计算</span>
                                        </div>
                                        <div className="text-xs text-surface-500 mt-1">
                                            在计划中自动根据 1RM 计算负重
                                        </div>
                                    </div>
                                    <InputSwitch
                                        id="enableAutoWeightCompute"
                                        checked={enableAutoWeightCompute}
                                        onChange={(e) => setEnableAutoWeightCompute(e.value || false)}
                                    />
                                </div>

                                {enableAutoWeightCompute && (
                                    <div className="flex items-start justify-between gap-4 mt-2 pt-3 border-t border-surface-200">
                                        <div className="min-w-0 pl-0">
                                            <div className="font-medium text-sm">包含自重</div>
                                            <div className="text-xs text-surface-500 mt-1">
                                                适用于引体向上等动作
                                            </div>
                                        </div>
                                        <InputSwitch
                                            id="includesBodyWeight"
                                            checked={includesBodyWeight}
                                            onChange={(e) => setIncludesBodyWeight(e.value || false)}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                <label htmlFor="positions" className="text-[11px] font-bold text-surface-500 ml-1">训练部位</label>
                                <MultiSelect
                                    id="positions"
                                    value={positions}
                                    options={actionTypes}
                                    onChange={(e) => setPositions(e.value)}
                                    placeholder="选择训练部位"
                                    className="w-full"
                                    display={isMobile ? 'comma' : 'chip'}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label htmlFor="attrs" className="text-[11px] font-bold text-surface-500 ml-1">动作属性</label>
                                <MultiSelect
                                    id="attrs"
                                    value={attrs}
                                    options={actionAttrs}
                                    onChange={(e) => setAttrs(e.value)}
                                    placeholder="选择动作属性"
                                    className="w-full"
                                    display={isMobile ? 'comma' : 'chip'}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* 4) 描述与链接（通用） */}
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2.5">
                        <label htmlFor="detail" className="text-[11px] font-black uppercase tracking-widest text-surface-400 ml-1">详细描述</label>
                        <InputTextarea
                            id="detail"
                            value={detail}
                            onChange={(e) => setDetail(e.target.value)}
                            rows={3}
                            placeholder="填写详细的操作要求、注意事项或说明..."
                            className="rounded-xl border-surface-200"
                        />
                    </div>

                    <div className="flex flex-col gap-2.5">
                        <label htmlFor="url" className="text-[11px] font-black uppercase tracking-widest text-surface-400 ml-1">演示视频 URL</label>
                        <InputText
                            id="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com/video.mp4"
                            className="rounded-xl border-surface-200"
                        />
                    </div>
                </div>
            </div>
        </Dialog>
    );
};

export default StudentActionEditDialog;
