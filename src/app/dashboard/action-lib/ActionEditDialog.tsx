'use client';

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { MultiSelect } from 'primereact/multiselect';
import { Dropdown } from 'primereact/dropdown';
import { InputSwitch } from 'primereact/inputswitch';
import { CoachActionRow, ItemType } from '@/types';

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
    const [enableAutoWeightCompute, setEnableAutoWeightCompute] = useState<boolean>(false);
    const [includesBodyWeight, setIncludesBodyWeight] = useState<boolean>(false);
    const [loading, setLoading] = useState(false);

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
        }
    }, [action, visible]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const actionData: Partial<CoachActionRow> = {
                name,
                detail,
                url: url || undefined,
                positions,
                attrs,
                type: itemType,
                enableAutoWeightCompute: itemType === 'STRENGTH' ? enableAutoWeightCompute : false,
                includesBodyWeight: itemType === 'STRENGTH' && enableAutoWeightCompute ? includesBodyWeight : false
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

    return (
        <Dialog
            header={action ? "编辑动作" : "添加动作"}
            visible={visible}
            style={{ width: '800px' }}
            onHide={onCancel}
            footer={footerContent}
        >
            <div className="flex flex-col gap-4">
                {/* 项目类型选择 */}
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

                {/* 以下字段只对力量训练类型显示 */}
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