'use client';

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { MultiSelect } from 'primereact/multiselect';
import { InputSwitch } from 'primereact/inputswitch'; // 新增导入
import { CoachActionRow } from '@/types';

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
    const [attrs, setAttrs] = useState<string[]>([]); // 新增：动作属性状态
    const [enableAutoWeightCompute, setEnableAutoWeightCompute] = useState<boolean>(false); // 新增状态
    const [includesBodyWeight, setIncludesBodyWeight] = useState<boolean>(false); // 新增：是否包含自重
    const [loading, setLoading] = useState(false);

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
            // 如果position是字符串，则转换为数组，否则直接使用
            setPositions(action.positions || []);
            // 新增：设置动作属性
            setAttrs(action.attrs || []);
            setEnableAutoWeightCompute(action.enableAutoWeightCompute || false); // 新增：设置自动计算负重状态
            setIncludesBodyWeight(action.includesBodyWeight || false); // 新增：设置是否包含自重
        } else {
            // 重置表单
            setName('');
            setDetail('');
            setUrl('');
            setPositions([]);
            // 修改：设置默认动作属性
            setAttrs(['组数', '次数', '强度', '休息时间']);
            setEnableAutoWeightCompute(false); // 新增：默认值为false
            setIncludesBodyWeight(false); // 新增：默认值为false
        }
    }, [action, visible]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const actionData: Partial<CoachActionRow> = {
                name,
                detail,
                url: url || undefined,
                // 如果只选择了一个位置，保存为字符串以保持向后兼容
                // 如果选择了多个位置，可以保存为数组
                positions,
                // 新增：保存动作属性
                attrs,
                enableAutoWeightCompute, // 新增：保存自动计算负重设置
                includesBodyWeight: enableAutoWeightCompute ? includesBodyWeight : false // 只有启用自动计算时才保存
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
                <div className="flex flex-col gap-2">
                    <label htmlFor="name" className="font-medium">动作名称 *</label>
                    <InputText
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </div>

                {/* 新增：自动计算负重开关 */}
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

                {/* 新增：是否包含自重开关（仅在启用自动计算时显示） */}
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

                {/* 新增：动作属性多选 */}
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

                <div className="flex flex-col gap-2">
                    <label htmlFor="detail" className="font-medium">动作描述 *</label>
                    <InputTextarea
                        id="detail"
                        value={detail}
                        onChange={(e) => setDetail(e.target.value)}
                        rows={4}
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