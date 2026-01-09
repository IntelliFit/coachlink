'use client';

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { MultiSelect } from 'primereact/multiselect';
import { InputSwitch } from 'primereact/inputswitch';
import { AutoComplete } from 'primereact/autocomplete';
import { StudentActionRow } from '@/types/student';
import { CanonicalAction } from '@/types/canonical';

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

    // 新增状态：自动计算负重
    const [enableAutoWeightCompute, setEnableAutoWeightCompute] = useState<boolean>(false);
    const [includesBodyWeight, setIncludesBodyWeight] = useState<boolean>(false);
    
    // 新增状态：公共动作库关联
    const [canonicalActionId, setCanonicalActionId] = useState<string | null>(null);
    const [canonicalActions, setCanonicalActions] = useState<CanonicalAction[]>([]);
    const [filteredCanonicalActions, setFilteredCanonicalActions] = useState<CanonicalAction[]>([]);
    const [selectedCanonical, setSelectedCanonical] = useState<CanonicalAction | null>(null);

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

    useEffect(() => {
        if (action) {
            setName(action.name);
            setDetail(action.detail || '');
            setUrl(action.url || '');
            setPositions(action.positions || []);
            setAttrs(action.attrs || []);
            setEnableAutoWeightCompute(action.enableAutoWeightCompute || false);
            setIncludesBodyWeight(action.includesBodyWeight || false);
            setCanonicalActionId(action.canonical_action_id || null);
        } else {
            // 重置表单
            setName('');
            setDetail('');
            setUrl('');
            setPositions([]);
            setAttrs(['组数', '次数', '强度', '休息时间']);
            setEnableAutoWeightCompute(false);
            setIncludesBodyWeight(false);
            setCanonicalActionId(null);
            setSelectedCanonical(null);
        }
    }, [action, visible]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const actionData: Partial<StudentActionRow> = {
                name,
                detail,
                url: url || undefined,
                positions,
                attrs,
                enableAutoWeightCompute,
                includesBodyWeight: enableAutoWeightCompute ? includesBodyWeight : false,
                canonical_action_id: canonicalActionId
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
            style={{ width: '600px' }}
            onHide={onCancel}
            footer={footerContent}
            className="p-fluid"
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

                {/* 自动计算负重设置 */}
                <div className="flex flex-col gap-2 p-3 bg-surface-50 rounded-lg border border-surface-200">
                    <div className="flex items-center justify-between">
                        <label htmlFor="enableAutoWeightCompute" className="font-medium flex items-center gap-2">
                             <i className="pi pi-bolt text-orange-500"></i>
                             智能重量计算
                             <span className="text-xs text-surface-500 font-normal">
                                 (在计划中自动根据 1RM 计算负重)
                             </span>
                        </label>
                        <InputSwitch 
                            id="enableAutoWeightCompute"
                            checked={enableAutoWeightCompute}
                            onChange={(e) => setEnableAutoWeightCompute(e.value || false)}
                        />
                    </div>

                    {enableAutoWeightCompute && (
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-200">
                            <label htmlFor="includesBodyWeight" className="font-medium text-sm pl-6">
                                包含自重
                                <span className="text-xs text-surface-500 font-normal ml-2">
                                    (适用于引体向上等动作)
                                </span>
                            </label>
                            <InputSwitch 
                                id="includesBodyWeight"
                                checked={includesBodyWeight}
                                onChange={(e) => setIncludesBodyWeight(e.value || false)}
                            />
                        </div>
                    )}
                </div>

                {/* 公共动作库关联 */}
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
                    <label htmlFor="detail" className="font-medium">动作描述</label>
                    <InputTextarea
                        id="detail"
                        value={detail}
                        onChange={(e) => setDetail(e.target.value)}
                        rows={3}
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

export default StudentActionEditDialog;
