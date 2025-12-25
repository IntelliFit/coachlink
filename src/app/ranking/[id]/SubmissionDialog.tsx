'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { rankingService } from '@/app/service/rankingService';
import { useToastContext } from '@/context/ToastContext';
import { LeaderboardFormInput } from '@/types/leaderboard';

interface SubmissionDialogProps {
    visible: boolean;
    onHide: () => void;
    onSuccess?: () => void; // 提交成功后的回调
    templateId: string;
    formSchema: LeaderboardFormInput[];
    rankByField?: string; // 排序指标字段
    className?: string;
}

export default function SubmissionDialog({
    visible,
    onHide,
    onSuccess,
    templateId,
    formSchema,
    rankByField = 'weight', // 默认按 weight 排序
    className
}: SubmissionDialogProps) {
    const [formData, setFormData] = useState<any>({});
    const [loading, setLoading] = useState(false);
    const { showToast } = useToastContext();

    // 初始化表单数据
    useEffect(() => {
        if (visible) {
            const initialData: any = { douyin_nickname: '', notes: '' };
            formSchema.forEach((field) => {
                if (field.type === 'number') {
                    initialData[field.name] = null;
                } else {
                    initialData[field.name] = '';
                }
            });
            setFormData(initialData);
        }
    }, [visible, formSchema]);

    const handleFieldChange = (name: string, value: any) => {
        setFormData((prev: any) => ({
            ...prev,
            [name]: value
        }));
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. 构建符合设计要求的 form_data 数组结构
            const formattedFormData = formSchema.map(field => {
                // 保留原始字段信息并添加用户输入
                return {
                    ...field,
                    userInput: formData[field.name]
                };
            });

            // 2. 提取分数值 (从 rankByField 指定的 name 中取)
            const scoreValue = parseFloat(formData[rankByField]) || 0;

            // 3. 准备提交 payload
            const payload = {
                template_id: templateId,
                form_data: formattedFormData,
                score: scoreValue,
                evidence_url: formData.video_url || '', // 如果 schema 里有视频链接 name 则取对应值
                extra_data: {
                    douyin_nickname: formData.douyin_nickname,
                    notes: formData.notes
                },
                status: 'pending' // 初始状态为待审核
            };

            const result = await rankingService.createEntry(payload);

            if (result) {
                showToast({ severity: 'success', summary: '提交成功', detail: '您的记录已进入审核队列，我们会在三个工作日之内为您审核。' });
                onSuccess?.(); // 触发父组件刷新数据
            } else {
                showToast({ severity: 'error', summary: '提交失败', detail: '请检查您的输入并重试' });
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '提交失败', detail: '请检查网络或表单内容' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            header="提交挑战成绩"
            visible={visible}
            onHide={onHide}
            style={{ width: '95vw', maxWidth: '450px' }}
            className="rounded-3xl"
            breakpoints={{ '960px': '75vw', '641px': '100vw' }}
        >
            <form onSubmit={onSubmit} className="flex flex-col gap-5 mt-4">
                {/* 动态渲染来自 formSchema 的字段 */}
                {formSchema.map((field) => (
                    <div key={field.name} className="flex flex-col gap-2">
                        <label className="text-sm font-semibold ml-1">
                            {field.name}
                        </label>
                        {field.type === 'number' ? (
                            <InputNumber
                                placeholder={`请输入${field.name}数值`}
                                value={formData[field.name]}
                                onValueChange={(e) => handleFieldChange(field.name, e.value)}
                                minFractionDigits={0}
                                maxFractionDigits={2}
                                required
                            />
                        ) : field.type === 'option' ? (
                            <Dropdown
                                options={field.options?.map((opt: string) => ({ label: opt, value: opt }))}
                                placeholder={`请选择${field.name}`}
                                value={formData[field.name]}
                                onChange={(e) => handleFieldChange(field.name, e.value)}
                                required
                            />
                        ) : (
                            <InputText
                                placeholder={`请输入${field.name}`}
                                value={formData[field.name] || ''}
                                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                required
                            />
                        )}
                    </div>
                ))}

                {/* 固定字段：备注 */}
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold ml-1">备注说明</label>
                    <InputTextarea
                        placeholder="有什么想对裁判说的？"
                        value={formData.notes || ''}
                        onChange={(e) => handleFieldChange('notes', e.target.value)}
                        rows={2}
                        autoResize
                    />
                </div>

                <div className="flex flex-col gap-3 mt-4">
                    <Button
                        type="submit"
                        label="立即提交记录"
                        icon="pi pi-check"
                        loading={loading}
                        className="w-full py-3 rounded-xl bg-primary text-white font-bold"
                    />
                    <Button
                        type="button"
                        label="取消"
                        onClick={onHide}
                        text
                        className="w-full text-gray-500"
                    />
                </div>
            </form>
        </Dialog>
    );
}