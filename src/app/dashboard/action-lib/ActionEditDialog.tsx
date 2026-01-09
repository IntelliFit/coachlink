'use client';

import React, { useEffect, useState } from 'react';
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
    const [name, setName] = useState('');
    const [detail, setDetail] = useState('');
    const [url, setUrl] = useState('');
    const [positions, setPositions] = useState<string[]>([]);
    const [attrs, setAttrs] = useState<string[]>([]);
    const [itemType, setItemType] = useState<ItemType>('STRENGTH'); // 项目类型
    const [suggestedTime, setSuggestedTime] = useState<string>('');
    const [calories, setCalories] = useState<number | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [duration, setDuration] = useState<number | null>(null);
    const [pace, setPace] = useState<number | null>(null);
    const [targetDuration, setTargetDuration] = useState<number | null>(null);

    const [enableAutoWeightCompute, setEnableAutoWeightCompute] = useState<boolean>(false);
    const [includesBodyWeight, setIncludesBodyWeight] = useState<boolean>(false);
    const [loading, setLoading] = useState(false);
    
    // 公共动作库关联
    const [canonicalActionId, setCanonicalActionId] = useState<string | null>(null);
    const [canonicalActions, setCanonicalActions] = useState<CanonicalAction[]>([]);
    const [filteredCanonicalActions, setFilteredCanonicalActions] = useState<CanonicalAction[]>([]);
    const [selectedCanonical, setSelectedCanonical] = useState<CanonicalAction | null>(null);

    // 项目类型选项
    const itemTypeOptions = [
        { label: '💪 力量训练', value: 'STRENGTH' },
        { label: '🍎 饮食', value: 'DIET' },
        { label: '🏃 有氧运动', value: 'CARDIO' },
        { label: '✅ 习惯打卡', value: 'HABIT' }
    ];

    const actionTypes = [
        { label: '胸部', value: '胸部' },
        { label: '背部', value: '背部' },
        { label: '腿部', value: '腿部' },
        { label: '肩部', value: '肩部' },
        { label: '手臂', value: '手臂' },
        { label: '核心', value: '核心' },
        { label: '其他', value: '其他' }
    ];

    // 新增：动作属性选项
    const actionAttrs = [
        { label: '组数(sets)', value: '组数' },
        { label: '次数(reps)', value: '次数' },
        { label: '强度(RM)', value: '强度' },
        { label: '持续时间', value: '持续时间' },
        { label: '休息时间', value: '休息时间' }
    ];

    // ... existing options ...

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
            
            // Populate schema fields
            setSuggestedTime(action.suggested_time || '');
            const schema = action.item_schema as any || {};
            setCalories(schema.calories || null);
            setDistance(schema.distance ? schema.distance / 1000 : null); // meters to km
            setDuration(schema.duration ? schema.duration / 60 : null); // seconds to min
            setPace(schema.pace || null);
            setTargetDuration(schema.target_duration || null);
        } else {
            // ... existing reset ...
            setName('');
            setDetail('');
            setUrl('');
            setPositions([]);
            setAttrs(['组数', '次数', '强度', '休息时间']);
            setItemType('STRENGTH');
            setEnableAutoWeightCompute(false);
            setIncludesBodyWeight(false);
            
            // Reset schema fields
            setSuggestedTime('');
            setCalories(null);
            setDistance(null);
            setDuration(null);
            setPace(null);
            setTargetDuration(null);
        }
    }, [action, visible]);

    // 加载公共动作库
    useEffect(() => {
        const fetchCanonicalActions = async () => {
            try {
                const res = await fetch('/api/canonical-actions/list');
                const data = await res.json();
                if (data.success) {
                    setCanonicalActions(data.data);
                    // 如果当前动作已关联公共动作，找到对应项
                    if (action?.canonical_action_id) {
                        const linked = data.data.find((c: CanonicalAction) => c.id === action.canonical_action_id);
                        setSelectedCanonical(linked || null);
                        setCanonicalActionId(action.canonical_action_id);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch canonical actions:', error);
            }
        };
        if (visible) {
            fetchCanonicalActions();
        }
    }, [visible, action]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const itemSchema: any = {};
            if (itemType === 'DIET') {
                if (calories) itemSchema.calories = calories;
            } else if (itemType === 'CARDIO') {
                if (distance) itemSchema.distance = distance * 1000; // km to meters
                if (duration) itemSchema.duration = duration * 60; // min to seconds
                if (pace) itemSchema.pace = pace;
            } else if (itemType === 'HABIT') {
                if (targetDuration) itemSchema.target_duration = targetDuration;
            }

            const actionData: Partial<CoachActionRow> = {
                name,
                detail,
                url: url || undefined,
                positions,
                attrs,
                type: itemType,
                enableAutoWeightCompute: itemType === 'STRENGTH' ? enableAutoWeightCompute : false,
                includesBodyWeight: itemType === 'STRENGTH' && enableAutoWeightCompute ? includesBodyWeight : false,
                suggested_time: itemType === 'DIET' && suggestedTime ? suggestedTime : null,
                item_schema: Object.keys(itemSchema).length > 0 ? itemSchema : null,
                canonical_action_id: canonicalActionId
            };

            // ... save logic ...
            if (action) {
                actionData.id = action.id;
            }

            await onSave(actionData);
        } finally {
            setLoading(false);
        }
    };

    const footerContent = (
        <div className="flex justify-end gap-2">
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

    // ... existing footer ...

    return (
        <Dialog
            // ... existing props ...
            header={action ? "编辑动作" : "添加动作"}
            visible={visible}
            style={{ width: '800px' }}
            onHide={onCancel}
            footer={footerContent}
        >
            <div className="flex flex-col gap-4">
                {/* ... existing type and name ... */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="itemType" className="font-medium">项目类型 *</label>
                    <Dropdown
                        id="itemType"
                        value={itemType}
                        options={itemTypeOptions}
                        onChange={(e) => setItemType(e.value)}
                        className="w-full"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label htmlFor="name" className="font-medium">
                        {itemType === 'DIET' ? '饮食名称' : itemType === 'HABIT' ? '习惯名称' : '动作名称'} *
                    </label>
                    <InputText
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={itemType === 'DIET' ? '如：早餐、午餐、晚餐' : itemType === 'HABIT' ? '如：喝水、冥想' : ''}
                        required
                    />
                </div>

                {/* 公共动作库关联 - 仅力量训练显示 */}
                {itemType === 'STRENGTH' && (
                    <div className="flex flex-col gap-2">
                        <label htmlFor="canonicalAction" className="font-medium">
                            关联公共动作库 <span className="text-surface-500 text-sm">(可选)</span>
                        </label>
                        <AutoComplete
                            id="canonicalAction"
                            value={selectedCanonical}
                            suggestions={filteredCanonicalActions}
                            completeMethod={(e) => {
                                const query = e.query.toLowerCase();
                                const filtered = canonicalActions.filter(c => 
                                    c.name.toLowerCase().includes(query) ||
                                    c.aliases.some(a => a.toLowerCase().includes(query))
                                );
                                setFilteredCanonicalActions(filtered);
                            }}
                            field="name"
                            onChange={(e) => {
                                setSelectedCanonical(e.value);
                                setCanonicalActionId(e.value?.id || null);
                            }}
                            dropdown
                            placeholder="搜索公共动作..."
                            className="w-full"
                            itemTemplate={(item: CanonicalAction) => (
                                <div className="flex flex-col">
                                    <span className="font-medium">{item.name}</span>
                                    {item.aliases.length > 0 && (
                                        <span className="text-xs text-surface-500">
                                            别名: {item.aliases.slice(0, 2).join(', ')}
                                        </span>
                                    )}
                                </div>
                            )}
                        />
                        {selectedCanonical && (
                            <div className="flex items-center gap-2 text-sm text-green-600">
                                <i className="pi pi-link" />
                                <span>已关联: {selectedCanonical.name}</span>
                                <Button
                                    icon="pi pi-times"
                                    className="p-button-text p-button-sm p-button-danger"
                                    onClick={() => {
                                        setSelectedCanonical(null);
                                        setCanonicalActionId(null);
                                    }}
                                    tooltip="取消关联"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Diet Fields */}
                {itemType === 'DIET' && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="calories" className="font-medium">参考热量 (kcal)</label>
                            <InputText
                                id="calories"
                                type="number"
                                value={calories !== null ? String(calories) : ''}
                                onChange={(e) => setCalories(e.target.value ? Number(e.target.value) : null)}
                                placeholder="如: 500"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="suggestedTime" className="font-medium">建议时间</label>
                            <InputText
                                id="suggestedTime"
                                type="time"
                                value={suggestedTime}
                                onChange={(e) => setSuggestedTime(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {/* Cardio Fields */}
                {itemType === 'CARDIO' && (
                    <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="distance" className="font-medium">目标距离 (km)</label>
                            <InputText
                                id="distance"
                                type="number"
                                value={distance !== null ? String(distance) : ''}
                                onChange={(e) => setDistance(e.target.value ? Number(e.target.value) : null)}
                                placeholder="如: 5.0"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="duration" className="font-medium">目标时长 (分钟)</label>
                            <InputText
                                id="duration"
                                type="number"
                                value={duration !== null ? String(duration) : ''}
                                onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : null)}
                                placeholder="如: 30"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="pace" className="font-medium">建议配速 (min/km)</label>
                            <InputText
                                id="pace"
                                type="number"
                                value={pace !== null ? String(pace) : ''}
                                onChange={(e) => setPace(e.target.value ? Number(e.target.value) : null)}
                                placeholder="如: 5.5"
                            />
                        </div>
                    </div>
                )}

                {/* Habit Fields */}
                {itemType === 'HABIT' && (
                    <div className="flex flex-col gap-2">
                        <label htmlFor="targetDuration" className="font-medium">目标时长/次数 (选填)</label>
                        <InputText
                            id="targetDuration"
                            type="number"
                            value={targetDuration !== null ? String(targetDuration) : ''}
                            onChange={(e) => setTargetDuration(e.target.value ? Number(e.target.value) : null)}
                            placeholder="如: 10 (分钟或次)"
                        />
                    </div>
                )}

                {/* Strength Fields */}
                {itemType === 'STRENGTH' && (
                    <>
                        {/* 自动计算负重开关 */}
                        <div className="flex items-center gap-2">
                            <InputSwitch 
                                id="enableAutoWeightCompute"
                                checked={enableAutoWeightCompute}
                                onChange={(e) => setEnableAutoWeightCompute(e.value || false)}
                            />
                            <label htmlFor="enableAutoWeightCompute" className="font-medium">
                                是否自动计算负重
                            </label>
                        </div>

                        {/* 是否包含自重开关（仅在启用自动计算时显示） */}
                        {enableAutoWeightCompute && (
                            <div className="flex items-center gap-2 ml-6 p-3 bg-surface-100 rounded-lg">
                                <InputSwitch 
                                    id="includesBodyWeight"
                                    checked={includesBodyWeight}
                                    onChange={(e) => setIncludesBodyWeight(e.value || false)}
                                />
                                <div className="flex flex-col">
                                    <label htmlFor="includesBodyWeight" className="font-medium">
                                        包含自重计算
                                    </label>
                                    <span className="text-xs text-surface-500">
                                        {includesBodyWeight 
                                            ? '适用于负重引体、负重臂屈伸等动作' 
                                            : '适用于深蹲、卧推、硬拉等动作'}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <label htmlFor="positions" className="font-medium">动作类型</label>
                            <MultiSelect
                                id="positions"
                                value={positions}
                                options={actionTypes}
                                onChange={(e) => setPositions(e.value)}
                                placeholder="选择动作类型"
                                className="w-full"
                                display="chip"
                            />
                        </div>

                        {/* 动作属性多选 */}
                        <div className="flex flex-col gap-2">
                            <label htmlFor="attrs" className="font-medium">动作属性</label>
                            <MultiSelect
                                id="attrs"
                                value={attrs}
                                options={actionAttrs}
                                onChange={(e) => setAttrs(e.value)}
                                placeholder="选择动作属性"
                                className="w-full"
                                display="chip"
                            />
                        </div>
                    </>
                )}

                <div className="flex flex-col gap-2">
                    <label htmlFor="detail" className="font-medium">
                        {itemType === 'DIET' ? '饮食内容' : itemType === 'HABIT' ? '习惯说明' : '动作描述'} *
                    </label>
                    <InputTextarea
                        id="detail"
                        value={detail}
                        onChange={(e) => setDetail(e.target.value)}
                        rows={4}
                        placeholder={itemType === 'DIET' ? '如：燕麦+鸡蛋+牛奶，蛋白质30g' : itemType === 'HABIT' ? '如：每天喝8杯水' : ''}
                        required
                    />
                </div>

                {/* Common fields */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="url" className="font-medium">视频链接</label>
                    <InputText
                        id="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com/video.mp4"
                    />
                </div>
            </div>
        </Dialog>
    );
};

export default ActionEditDialog;