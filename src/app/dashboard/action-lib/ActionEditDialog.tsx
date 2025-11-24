'use client';

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { MultiSelect } from 'primereact/multiselect';
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

    useEffect(() => {
        if (action) {
            setName(action.name);
            setDetail(action.detail || '');
            setUrl(action.url || '');
            // 如果position是字符串，则转换为数组，否则直接使用
            setPositions(action.positions || []);
        } else {
            // 重置表单
            setName('');
            setDetail('');
            setUrl('');
            setPositions([]);
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
                positions
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

                <div className="flex flex-col gap-2">
                    <label htmlFor="positions" className="font-medium">动作类型</label>
                    <MultiSelect
                        id="positions"
                        value={positions}
                        options={actionTypes}
                        onChange={(e) => setPositions(e.value)}
                        placeholder="选择动作类型"
                        className="w-full"
                        appendTo='self'
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