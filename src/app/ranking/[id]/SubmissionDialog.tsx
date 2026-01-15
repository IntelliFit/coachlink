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
import { videoService } from '@/app/service/videoService';
import { FileUpload } from 'primereact/fileupload';
import { ProgressBar } from 'primereact/progressbar';

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
    const [uploadProgress, setUploadProgress] = useState<number>(0);

    // 初始化表单数据
    useEffect(() => {
        if (visible) {
            const initialData: any = { douyin_nickname: '' };
            formSchema.forEach((field) => {
                initialData[field.name] = field.type === 'number' ? null : '';
                if (field.type === 'video') initialData[field.name + '_mode'] = 'upload';
            });
            setFormData(initialData);
            setUploadProgress(0);
        }
    }, [visible, formSchema]);

    const handleFieldChange = (name: string, value: any) => {
        setFormData((p: any) => ({ ...p, [name]: value }));
    };

    const handleModeChange = (fieldName: string, newMode: string) => {
        setFormData((prev: any) => {
            const currentVal = prev[fieldName];
            // 核心修复：如果从上传切到链接，且当前是文件，则重置该值为字符串
            const nextVal = (newMode === 'url' && currentVal instanceof File) ? '' : currentVal;

            return {
                ...prev,
                [fieldName]: nextVal,
                [fieldName + '_mode']: newMode
            };
        });
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setUploadProgress(0); // 重置进度

        try {
            // 创建一个副本用于最终提交
            const finalSubmitData = { ...formData };
            console.log('enter');


            // 1. 遍历 schema，处理所有需要上传的视频文件
            for (const field of formSchema) {
                const isVideoField = field.type === 'video';
                const isUploadMode = formData[field.name + '_mode'] === 'upload';
                const fileValue = formData[field.name];


                if (isVideoField && isUploadMode && fileValue instanceof File) {
                    // 执行上传
                    const uploadResult = await videoService.uploadVideoFile(
                        fileValue,
                        {
                            type: 'completion',
                            requires_review: true
                        },
                        (progress) => setUploadProgress(progress.percentage) // 更新进度条
                    );

                    if (uploadResult?.video_url) {
                        // 【关键点】：将上传后的 URL 覆盖掉原来的 File 对象
                        finalSubmitData[field.name] = uploadResult.video_url;
                    } else {
                        throw new Error(`${field.name} 上传失败`);
                    }
                }
            }

            // 2. 构建最终的 form_data 数组 (包含用户输入的 URL)
            const formattedFormData = formSchema.map(field => ({
                ...field,
                userInput: finalSubmitData[field.name] // 此时这里已经是 URL 字符串了
            }));

            // 3. 提取分数值
            const scoreValue = parseFloat(finalSubmitData[rankByField]) || 0;

            // 4. 提取主证据链接 (通常取第一个视频字段的值)
            const firstVideoField = formSchema.find(f => f.type === 'video');
            const evidenceUrl = firstVideoField ? finalSubmitData[firstVideoField.name] : '';

            // 5. 组装 Payload
            const payload = {
                template_id: templateId,
                form_data: formattedFormData,
                score: scoreValue,
                evidence_url: evidenceUrl,
                extra_data: {
                    douyin_nickname: finalSubmitData.douyin_nickname || ''
                },
                status: 'pending'
            };

            // 6. 调用 API 提交
            const result = await rankingService.createEntry(payload);

            if (result) {
                showToast({
                    severity: 'success',
                    summary: '提交成功',
                    detail: '记录已进入审核队列，请耐心等待。'
                });
                onSuccess?.();
                onHide();
            }
        } catch (error: any) {
            console.error('Submission error:', error);
            showToast({
                severity: 'error',
                summary: '提交失败',
                detail: error.message || '请检查输入或网络后重试'
            });
        } finally {
            setLoading(false);
            setUploadProgress(0);
        }
    };

    return (
        <Dialog
            header={<div className="text-xl font-black tracking-tight text-surface-900">提交挑战成绩</div>}
            visible={visible}
            onHide={onHide}
            style={{ width: '95vw', maxWidth: '480px' }}
            className="aero-dialog"
            pt={{
                root: { className: 'rounded-[32px] border-none shadow-2xl overflow-hidden' },
                header: { className: 'bg-surface pt-8 px-8 border-none' },
                content: { className: 'bg-surface px-8 pb-8 pt-2' }
            }}
        >
            <form onSubmit={onSubmit} className="flex flex-col gap-6 mt-2">
                {formSchema.map((field) => (
                    <div key={field.name} className="flex flex-col gap-2">
                        <label className="text-[11px] font-black text-surface-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                            {field.name}
                        </label>

                        {field.type === 'number' ? (
                            <InputNumber
                                value={formData[field.name]}
                                onValueChange={(e) => handleFieldChange(field.name, e.value)}
                                placeholder="0.00"
                                className="w-full"
                                inputClassName="rounded-2xl py-3 px-4 text-sm font-bold shadow-inner w-full"
                            />
                        ) : field.type === 'option' ? (
                            <Dropdown
                                value={formData[field.name]}
                                options={field.options?.map((opt: string) => ({ label: opt, value: opt }))}
                                onChange={(e) => handleFieldChange(field.name, e.value)}
                                placeholder="点击选择选项"

                                // 基础容器：物理下沉感与一致性圆角
                                className="w-full rounded-2xl h-[48px] flex items-center shadow-inner transition-all focus:bg-surface"

                                // 选项模板：左侧增加状态锚点，提升识别度
                                itemTemplate={(option) => (
                                    <div className="flex items-center gap-3 py-0.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary-400 opacity-60" />
                                        <span className="text-sm font-bold text-surface-700">{option.label}</span>
                                    </div>
                                )}

                                pt={{
                                    // 输入框与触发器
                                    input: {
                                        className: `text-sm font-bold px-4 ${!formData[field.name] ? 'text-surface-400' : 'text-primary-600'}`
                                    },
                                    trigger: { className: 'pr-3 text-surface-400' },

                                    // 弹出面板：核心 Aero 样式
                                    panel: {
                                        className: 'border-none shadow-[0_12px_40px_rgba(0,0,0,0.12)] rounded-[24px] mt-2 overflow-hidden bg-surface/90 backdrop-blur-xl'
                                    },
                                    list: {
                                        className: 'p-2 flex flex-col gap-1.5'
                                    },
                                    item: ({ context }) => ({
                                        className: `
                                            rounded-xl transition-all duration-200 px-4 py-3
                                            ${context.selected
                                                ? 'bg-primary-500/30 text-surface shadow-[0_4px_12px_rgba(var(--primary-500-rgb),0.3)]'
                                                : 'hover:bg-surface-50 text-surface-600 active:scale-[0.98]'}
            `
                                    })
                                }}
                            />
                        ) : field.type === 'video' ? (
                            <div className="bg-surface-50/50 p-4 rounded-[24px] border border-surface-100 flex flex-col gap-4">
                                <div className="flex bg-surface-100 p-1 rounded-xl w-fit">
                                    {['upload', 'url'].map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => {
                                                handleFieldChange(field.name + '_mode', mode);
                                                handleModeChange(field.name, mode);
                                            }}
                                            className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${formData[field.name + '_mode'] === mode
                                                ? 'bg-surface text-primary-500 shadow-sm'
                                                : 'text-surface-400'
                                                }`}
                                        >
                                            {mode === 'upload' ? '文件上传' : '输入链接'}
                                        </button>
                                    ))}
                                </div>

                                {formData[field.name + '_mode'] === 'upload' ? (
                                    <div className="flex flex-col gap-3">
                                        <div className="relative group">
                                            <FileUpload
                                                mode="basic"
                                                accept="video/*"
                                                maxFileSize={10000000}
                                                // 关键修复 1：确保 onSelect 能够正确捕获文件
                                                onSelect={(e) => {
                                                    const file = e.files[0];
                                                    if (file) {
                                                        handleFieldChange(field.name, file);
                                                    }
                                                }}
                                                auto={false}
                                                chooseLabel={formData[field.name] ? "已就绪 (点击更换)" : "点击上传挑战视频"}
                                                className="w-full"
                                                pt={{
                                                    // 关键修复 2：优化 chooseButton 样式，确保 pointer-events 正确
                                                    chooseButton: {
                                                        className: `
                                                                w-full min-h-[100px] flex flex-col items-center justify-center gap-2
                                                                border-2 border-dashed transition-all duration-300 rounded-[24px] cursor-pointer
                                                                ${formData[field.name]
                                                                ? 'bg-primary-50/40 border-primary-300 text-primary-600 shadow-sm'
                                                                : 'bg-surface border-surface-200 text-surface-400 hover:border-primary-400 hover:bg-surface-50'}
                `
                                                    },
                                                    label: { className: 'text-[11px] font-black uppercase tracking-wider' }
                                                }}
                                            />
                                        </div>

                                        {formData[field.name] instanceof File && (
                                            <div className="bg-surface shadow-xl rounded-2xl p-3 flex items-center gap-3 border border-primary-100 max-w-[80%]">
                                                <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center shrink-0">
                                                    <i className="pi pi-video text-surface" />
                                                </div>
                                                <div className="flex flex-col overflow-hidden text-left">
                                                    <span className="text-[10px] font-black text-surface-900 truncate">
                                                        {formData[field.name].name}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-primary-500 uppercase">
                                                        {(formData[field.name].size / 1024 / 1024).toFixed(2)} MB • 已就绪
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <InputText
                                        value={formData[field.name] || ''}
                                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                        placeholder="粘贴视频链接..."
                                        className="rounded-xl py-3 px-4 text-sm font-medium shadow-inner"
                                    />
                                )}
                            </div>
                        ) : (
                            <InputText
                                value={formData[field.name] || ''}
                                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                placeholder={`输入${field.name}`}
                                className="bg-surface-50 border-none rounded-2xl py-3 px-4 text-sm font-bold shadow-inner"
                            />
                        )}
                    </div>
                ))}

                {/* 提交反馈区 */}
                <div className="mt-4 flex flex-col gap-4">
                    {uploadProgress > 0 && uploadProgress < 100 && (
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between text-[10px] font-black text-primary-500 uppercase tracking-widest">
                                <span>视频上传中...</span>
                                <span>{uploadProgress}%</span>
                            </div>
                            <ProgressBar value={uploadProgress} showValue={false} style={{ height: '6px' }} className="rounded-full overflow-hidden bg-surface-100" />
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <Button
                            type="submit"
                            label={loading ? "正在处理..." : "立即提交审核"}
                            loading={loading}
                            className="w-full py-4 bg-primary-500 border-none rounded-[20px] font-black text-sm shadow-[0_10px_30px_rgba(var(--primary-500-rgb),0.3)] active:scale-95 transition-all"
                        />
                        <Button
                            type="button"
                            label="放弃提交"
                            onClick={onHide}
                            text
                            className="text-surface-400 font-bold text-xs"
                        />
                    </div>
                </div>
            </form>
        </Dialog>
    );
}