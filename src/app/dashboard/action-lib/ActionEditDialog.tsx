'use client';

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { ExerciseAction } from '@/app/api/action-lib/list-actions/entity';

interface ActionEditDialogProps {
    visible: boolean;
    action?: ExerciseAction | null;
    onSave: (action: Partial<ExerciseAction>) => Promise<void>;
    onCancel: () => void;
}

const ActionEditDialog: React.FC<ActionEditDialogProps> = ({
    visible,
    action,
    onSave,
    onCancel
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [type, setType] = useState<'strength' | 'cardio' | 'flexibility' | 'other'>('strength');
    const [loading, setLoading] = useState(false);

    const actionTypes = [
        { label: '力量训练', value: 'strength' },
        { label: '心肺训练', value: 'cardio' },
        { label: '柔韧性训练', value: 'flexibility' },
        { label: '其他', value: 'other' }
    ];

    useEffect(() => {
        if (action) {
            setName(action.name);
            setDescription(action.description);
            setVideoUrl(action.video_url || '');
            setType(action.type);
        } else {
            // 重置表单
            setName('');
            setDescription('');
            setVideoUrl('');
            setType('strength');
        }
    }, [action, visible]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const actionData: Partial<ExerciseAction> = {
                name,
                description,
                video_url: videoUrl || undefined,
                type
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
            style={{ width: '500px' }}
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
                    <label htmlFor="description" className="font-medium">动作描述 *</label>
                    <InputTextarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                        required
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label htmlFor="videoUrl" className="font-medium">视频链接</label>
                    <InputText
                        id="videoUrl"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="https://example.com/video.mp4"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label htmlFor="type" className="font-medium">动作类型</label>
                    <Dropdown
                        id="type"
                        value={type}
                        options={actionTypes}
                        onChange={(e) => setType(e.value)}
                        placeholder="选择动作类型"
                    />
                </div>
            </div>
        </Dialog>
    );
};

export default ActionEditDialog;