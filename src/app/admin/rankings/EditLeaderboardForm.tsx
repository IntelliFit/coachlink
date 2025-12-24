'use client';

import React, { useEffect, useState } from 'react';
// 1. 引入 addLocale 和 locale 方法
import { addLocale, locale } from 'primereact/api';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Calendar } from 'primereact/calendar';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { useToastContext } from '@/context/ToastContext';
import { rankingService } from '@/app/service/rankingService';
import { LeaderboardTemplateRow } from '@/types';
import { LeaderboardRule, LeaderboardFormInput } from '@/types/leaderboard';

interface EditLeaderboardFormProps {
    leaderboard: LeaderboardTemplateRow | null;
    visible: boolean;
    onHide: () => void;
    onSuccess: () => void;
}

// 2. 定义中文配置
addLocale('zh-CN', {
    firstDayOfWeek: 1,
    dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
    dayNamesShort: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
    dayNamesMin: ['日', '一', '二', '三', '四', '五', '六'],
    monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
    monthNamesShort: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'],
    today: '今天',
    clear: '清除'
});

export default function EditLeaderboardForm({ leaderboard, visible, onHide, onSuccess }: EditLeaderboardFormProps) {
    const { showToast } = useToastContext();

    // ... formData 和 submitting 状态保持不变 ...

    const [formData, setFormData] = useState({
        id: '',
        title: '',
        description: '',
        start_at: null as Date | null,
        end_at: null as Date | null,
        rank_by_field: '',
        sort_order: 'desc',
        type: 'score',
        remarks: '',
        rules: [] as LeaderboardRule[],
        form_schema: [] as LeaderboardFormInput[]
    });

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (leaderboard) {
            setFormData({
                id: leaderboard.id,
                title: leaderboard.title || '',
                description: leaderboard.description || '',
                start_at: leaderboard.start_at ? new Date(leaderboard.start_at) : null,
                end_at: leaderboard.end_at ? new Date(leaderboard.end_at) : null,
                rank_by_field: leaderboard.rank_by_field || '',
                sort_order: leaderboard.sort_order || 'desc',
                type: leaderboard.type || 'score',
                remarks: leaderboard.remarks || '',
                rules: leaderboard.rules || [],
                form_schema: leaderboard.form_schema || []
            });
        }
    }, [leaderboard]);

    const handleSubmit = async () => {
        if (!formData.title || !formData.rank_by_field) {
            showToast({ severity: 'warn', summary: '提示', detail: '请填写必填项' });
            return;
        }

        setSubmitting(true);
        try {
            const reqData = {
                ...formData,
                start_at: formData.start_at?.toISOString(),
                end_at: formData.end_at?.toISOString()
            };
            const result = await rankingService.updateLeaderboard(reqData);
            if (result?.success) {
                showToast({ severity: 'success', summary: '成功', detail: '更新成功' });
                onSuccess();
                onHide();
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '错误', detail: '更新失败' });
        } finally {
            setSubmitting(false);
        }
    };

    const renderFooter = () => (
        <div className="flex justify-end gap-2">
            <Button label="取消" icon="pi pi-times" onClick={onHide} className="p-button-text p-button-secondary" />
            <Button label="保存更改" icon="pi pi-check" loading={submitting} onClick={handleSubmit} autoFocus />
        </div>
    );

    // 处理rules的添加
    const addRule = () => {
        const newRule: LeaderboardRule = {
            detail: '',
            status: 'success'
        };
        setFormData(prev => ({
            ...prev,
            rules: [...prev.rules, newRule]
        }));
    };

    // 更新rule
    const updateRule = (index: number, field: keyof LeaderboardRule, value: string) => {
        const newRules = [...formData.rules];
        newRules[index] = { ...newRules[index], [field]: value };
        setFormData(prev => ({ ...prev, rules: newRules }));
    };

    // 删除rule
    const removeRule = (index: number) => {
        const newRules = [...formData.rules];
        newRules.splice(index, 1);
        setFormData(prev => ({ ...prev, rules: newRules }));
    };

    // 处理form_schema的添加
    const addFormInput = () => {
        const newInput: LeaderboardFormInput = {
            type: 'text',
            name: '',
            options: []
        };
        setFormData(prev => ({
            ...prev,
            form_schema: [...prev.form_schema, newInput]
        }));
    };

    // 更新form_input
    const updateFormInput = (index: number, field: keyof LeaderboardFormInput, value: any) => {
        const newFormSchema = [...formData.form_schema];
        
        if (field === 'type' && value !== 'option') {
            // 如果类型不是option，移除options属性
            const updatedInput = { ...newFormSchema[index], [field]: value } as LeaderboardFormInput;
            if (field !== 'type' || value !== 'option') {
                delete (updatedInput as any).options;
            }
            newFormSchema[index] = updatedInput;
        } else {
            newFormSchema[index] = { ...newFormSchema[index], [field]: value };
        }
        
        setFormData(prev => ({ ...prev, form_schema: newFormSchema }));
    };

    // 更新选项
    const updateOption = (inputIndex: number, optionIndex: number, value: string) => {
        const newFormSchema = [...formData.form_schema];
        const input = newFormSchema[inputIndex] as any;
        if (input.options) {
            input.options[optionIndex] = value;
            newFormSchema[inputIndex] = input;
            setFormData(prev => ({ ...prev, form_schema: newFormSchema }));
        }
    };

    // 添加选项
    const addOption = (inputIndex: number) => {
        const newFormSchema = [...formData.form_schema];
        const input = newFormSchema[inputIndex] as any;
        if (input.options) {
            input.options.push('');
        } else {
            input.options = [''];
        }
        newFormSchema[inputIndex] = input;
        setFormData(prev => ({ ...prev, form_schema: newFormSchema }));
    };

    // 删除选项
    const removeOption = (inputIndex: number, optionIndex: number) => {
        const newFormSchema = [...formData.form_schema];
        const input = newFormSchema[inputIndex] as any;
        if (input.options) {
            input.options.splice(optionIndex, 1);
            newFormSchema[inputIndex] = input;
            setFormData(prev => ({ ...prev, form_schema: newFormSchema }));
        }
    };

    // 删除form_input
    const removeFormInput = (index: number) => {
        const newFormSchema = [...formData.form_schema];
        newFormSchema.splice(index, 1);
        setFormData(prev => ({ ...prev, form_schema: newFormSchema }));
    };

    if (!leaderboard) return null;

    return (
        <Dialog
            header="编辑排行榜"
            visible={visible}
            onHide={onHide}
            footer={renderFooter()}
            style={{ width: '700px' }}
            breakpoints={{ '960px': '75vw', '641px': '100vw' }}
            modal
            className="p-fluid"
        >
            <div className="pt-2">
                <div className="grid">
                    {/* 其他字段保持不变... */}
                    <div className="col-12 md:col-6 field mb-4">
                        <label className="font-bold block mb-2">标题 *</label>
                        <InputText name="title" value={formData.title} onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))} />
                    </div>

                    <div className="col-12 md:col-6 field mb-4">
                        <label className="font-bold block mb-2">排名字段 *</label>
                        <InputText name="rank_by_field" value={formData.rank_by_field} onChange={(e) => setFormData(p => ({ ...p, rank_by_field: e.target.value }))} />
                    </div>

                    <div className="col-12 md:col-6 field mb-4">
                        <label htmlFor="start_at" className="font-bold block mb-2">开始时间</label>
                        <Calendar
                            id="start_at"
                            value={formData.start_at}
                            onChange={(e) => setFormData(p => ({ ...p, start_at: e.value as Date }))}
                            showTime
                            hourFormat="24"
                            showIcon
                            // 3. 应用中文语言包
                            locale="zh-CN"
                            dateFormat="yy-mm-dd"
                            placeholder="选择开始时间"
                        />
                    </div>

                    <div className="col-12 md:col-6 field mb-4">
                        <label htmlFor="end_at" className="font-bold block mb-2">结束时间</label>
                        <Calendar
                            id="end_at"
                            value={formData.end_at}
                            onChange={(e) => setFormData(p => ({ ...p, end_at: e.value as Date }))}
                            showTime
                            hourFormat="24"
                            showIcon
                            // 3. 应用中文语言包
                            locale="zh-CN"
                            dateFormat="yy-mm-dd"
                            placeholder="选择结束时间"
                        />
                    </div>

                    {/* 其他下拉框和备注... */}
                    <div className="col-12 field mb-4">
                        <label className="font-bold block mb-2">描述</label>
                        <InputTextarea value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} rows={2} />
                    </div>

                    {/* Rules 部分 */}
                    <div className="col-12 field mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <label className="font-bold block">规则</label>
                            <Button 
                                type="button" 
                                label="添加规则" 
                                icon="pi pi-plus" 
                                size="small" 
                                severity="secondary" 
                                onClick={addRule}
                            />
                        </div>
                        
                        {formData.rules.map((rule, index) => (
                            <div key={index} className="flex flex-col border border-gray-200 rounded p-3 gap-2 mb-2">
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <InputTextarea 
                                            value={rule.detail} 
                                            onChange={(e) => updateRule(index, 'detail', e.target.value)} 
                                            placeholder="规则描述" 
                                            rows={2}
                                        />
                                    </div>
                                    <div className="w-40">
                                        <Dropdown
                                            value={rule.status}
                                            options={[
                                                { label: '成功', value: 'success' },
                                                { label: '警告', value: 'warning' },
                                                { label: '错误', value: 'error' }
                                            ]}
                                            onChange={(e) => updateRule(index, 'status', e.value)}
                                            placeholder="状态"
                                        />
                                    </div>
                                    <div>
                                        <Button 
                                            type="button" 
                                            label="" 
                                            icon="pi pi-trash" 
                                            severity="danger" 
                                            size="small" 
                                            onClick={() => removeRule(index)}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Form Schema 部分 */}
                    <div className="col-12 field mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <label className="font-bold block">提交表单结构</label>
                            <Button 
                                type="button" 
                                label="添加字段" 
                                icon="pi pi-plus" 
                                size="small" 
                                severity="secondary" 
                                onClick={addFormInput}
                            />
                        </div>
                        
                        {formData.form_schema.map((input, index) => (
                            <div key={index} className="flex flex-col border border-gray-200 rounded p-3 gap-2 mb-2">
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <InputText 
                                            value={input.name} 
                                            onChange={(e) => updateFormInput(index, 'name', e.target.value)} 
                                            placeholder="字段名称" 
                                        />
                                    </div>
                                    <div className="w-40">
                                        <Dropdown
                                            value={input.type}
                                            options={[
                                                { label: '数字', value: 'number' },
                                                { label: '文本', value: 'text' },
                                                { label: '选项', value: 'option' }
                                            ]}
                                            onChange={(e) => updateFormInput(index, 'type', e.value)}
                                            placeholder="类型"
                                        />
                                    </div>
                                    <div>
                                        <Button 
                                            type="button" 
                                            label="" 
                                            icon="pi pi-trash" 
                                            severity="danger" 
                                            size="small" 
                                            onClick={() => removeFormInput(index)}
                                        />
                                    </div>
                                </div>
                                
                                {input.type === 'option' && (
                                    <div className="mt-2">
                                        <label className="text-sm font-bold text-gray-700 block mb-1">选项</label>
                                        {(input as any).options?.map((option: string, optionIndex: number) => (
                                            <div key={optionIndex} className="flex gap-2 mb-1">
                                                <InputText
                                                    value={option}
                                                    onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                                                    placeholder="选项值"
                                                    className="flex-1"
                                                />
                                                <Button
                                                    type="button"
                                                    label=""
                                                    icon="pi pi-trash"
                                                    severity="danger"
                                                    size="small"
                                                    onClick={() => removeOption(index, optionIndex)}
                                                />
                                            </div>
                                        ))}
                                        <Button
                                            type="button"
                                            label="添加选项"
                                            icon="pi pi-plus"
                                            size="small"
                                            severity="secondary"
                                            onClick={() => addOption(index)}
                                            className="mt-1"
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Dialog>
    );
}