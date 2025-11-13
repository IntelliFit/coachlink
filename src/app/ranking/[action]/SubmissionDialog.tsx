import React from 'react';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';

interface SubmissionDialogProps {
    visible: boolean;
    onHide: () => void;
    formData: {
        name: string;
        gender: string;
        weight_kg: number;
        video_url: string;
        notes: string;
    };
    setFormData: React.Dispatch<React.SetStateAction<{
        name: string;
        gender: string;
        weight_kg: number;
        video_url: string;
        notes: string;
    }>>;
    onSubmit: (e: React.FormEvent) => void;
}

export default function SubmissionDialog({ visible, onHide, formData, setFormData, onSubmit }: SubmissionDialogProps) {
    const genderOptions = [
        { label: '男', value: 'male' },
        { label: '女', value: 'female' },
    ];

    return (
        <Dialog
            header="提交我的记录"
            visible={visible}
            onHide={onHide}
            style={{ width: '90vw', maxWidth: '480px' }}
        >
            <form onSubmit={onSubmit} className="flex flex-col gap-4 mt-2">
                <InputText
                    placeholder="昵称"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                <Dropdown
                    options={genderOptions}
                    placeholder="性别"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.value })}
                />
                <InputNumber
                    placeholder="负重重量(kg)"
                    value={formData.weight_kg}
                    onValueChange={(e) =>
                        setFormData({ ...formData, weight_kg: e.value || 0 })
                    }
                />
                <InputText
                    placeholder="视频链接"
                    value={formData.video_url}
                    onChange={(e) =>
                        setFormData({ ...formData, video_url: e.target.value })
                    }
                />
                <InputTextarea
                    placeholder="备注（可选）"
                    value={formData.notes}
                    onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={3}
                />
                <div className="flex justify-end gap-3 mt-4">
                    <Button
                        type="button"
                        label="取消"
                        severity="secondary"
                        outlined
                        className="rounded-xl"
                        onClick={onHide}
                    />
                    <Button
                        type="submit"
                        label="提交"
                        icon="pi pi-check"
                        className="!bg-primary-600 !border-primary-600 hover:!bg-primary-700 rounded-xl"
                    />
                </div>
            </form>
        </Dialog>
    );
}