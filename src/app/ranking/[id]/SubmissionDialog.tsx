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
            const initialData: any = { douyin_nickname: '' };
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

            // 2. 尝试从 formSchema 中提取 evidence_url (如果有字段被定义为存储视频/凭证)
            // 策略：查找 explicit field (例如 name='evidence_url') 或者 implicit (name contains 'video'/'link')
            // 但是现在我们更依赖于 schema 中的配置。如果用户配置了某个字段，并且它是必填的，那么它本身就会被上面的 HTML form 必填校验拦截
            // 这里我们主要为了 payload 中的 evidence_url 赋值。
            
            // 查找可能的视频字段
            const videoField = formSchema.find(f => 
                f.name === 'evidence_url' ||
                f.name.includes('视频') || 
                f.name.toLowerCase().includes('video') || 
                f.name.toLowerCase().includes('link') ||
                f.name.includes('链接')
            );
            
            // 如果找到了字段，取其值作为 evidence_url
            // 如果没找到，或该字段非必填且为空，则 payload.evidence_url 可能为空，这是允许的（如果 required=false）
            const videoUrl = videoField ? formData[videoField.name] : (formData.video_url || '');

             // 注意：这里的额外校验仅针对 evidence_url 的业务逻辑
             // 如果字段本身在 schema 中标记为 required=true，上面的 <Input... required={!!field.required} /> 已经阻止了提交
             // 所以这里我们可以移除之前的硬性拦截，除非我们需要确保 evidence_url 字段必须存在于 schema 中
            
            // 3. 提取分数值 (从 rankByField 指定的 name 中取)
            const scoreValue = parseFloat(formData[rankByField]) || 0;

            // 4. 准备提交 payload
            const payload = {
                template_id: templateId,
                form_data: formattedFormData,
                score: scoreValue,
                evidence_url: videoUrl, 
                extra_data: {
                    douyin_nickname: formData.douyin_nickname
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
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {field.type === 'number' ? (
                            <InputNumber
                                placeholder={`请输入${field.name}数值`}
                                value={formData[field.name]}
                                onValueChange={(e) => handleFieldChange(field.name, e.value)}
                                minFractionDigits={0}
                                maxFractionDigits={2}
                                required={!!field.required}
                            />
                        ) : field.type === 'option' ? (
                            <Dropdown
                                options={field.options?.map((opt: string) => ({ label: opt, value: opt }))}
                                placeholder={`请选择${field.name}`}
                                value={formData[field.name]}
                                onChange={(e) => handleFieldChange(field.name, e.value)}
                                required={!!field.required}
                            />
                        ) : field.type === 'video' ? (
                            <div>
                                
                            </div>
                        ) : (
                            <InputText
                                placeholder={`请输入${field.name}`}
                                value={formData[field.name] || ''}
                                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                required={!!field.required}
                            />
                        )}
                    </div>
                ))}

                <div className="flex flex-col gap-3 mt-4">
                    <Button
                        type="submit"
                        label="立即提交记录"
                        icon="pi pi-check"
                        loading={loading}
                        className="w-full py-3 bg-primary-500 border-none rounded-2xl shadow-xl shadow-primary-500/20 hover:bg-primary-600 transition-all transform active:scale-[0.98] p-button p-component"
                    />
                    <Button
                        type="button"
                        label="取消"
                        onClick={onHide}
                        text
                        className="w-full text-gray-500 rounded-2xl"
                    />
                </div>
            </form>
        </Dialog>
    );
}