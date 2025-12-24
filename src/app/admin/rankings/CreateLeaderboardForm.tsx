'use client';

import React, { useState } from 'react';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Calendar } from 'primereact/calendar';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { addLocale } from 'primereact/api';
import { useToastContext } from '@/context/ToastContext';
import { rankingService } from '@/app/service/rankingService';
import { LeaderboardRule, LeaderboardFormInput } from '@/types/leaderboard';

// 配置中文语言包
addLocale('zh-CN', {
    firstDayOfWeek: 1,
    dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
    dayNamesShort: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
    dayNamesMin: ['日', '一', '二', '三', '四', '五', '六'],
    monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
    monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    today: '今天',
    clear: '清除'
});

interface CreateLeaderboardFormProps {
    onSuccess: () => void;
}

export default function CreateLeaderboardForm({ onSuccess }: CreateLeaderboardFormProps) {
    const { showToast } = useToastContext();
    const [submitting, setSubmitting] = useState(false);

    const initialFormState = {
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
    };

    const [formData, setFormData] = useState(initialFormState);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const reqData = {
                ...formData,
                start_at: formData.start_at?.toISOString(),
                end_at: formData.end_at?.toISOString()
            };
            const result = await rankingService.createLeaderboard(reqData);
            if (result) {
                showToast({ severity: 'success', summary: '成功', detail: '排行榜创建成功' });
                onSuccess();
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '错误', detail: '创建失败，请检查输入' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleChange = (e: any) => {
        const name = e.target?.name || (e.originalEvent?.target as any)?.name;
        const value = e.value !== undefined ? e.value : e.target.value;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

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

    // 定义 Card 的底部按钮区
    const footer = (
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
            <Button 
                type="button" 
                label="重置" 
                icon="pi pi-refresh" 
                className="p-button-text p-button-secondary" 
                onClick={() => setFormData(initialFormState)} 
            />
            <Button 
                type="submit" 
                form="leaderboard-form" // 关联表单 ID
                label="确认创建" 
                icon="pi pi-check" 
                loading={submitting} 
            />
        </div>
    );

    return (
        <Card footer={footer} className="shadow-none border border-gray-200 rounded-lg">
            <form id="leaderboard-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                
                {/* 第一行：标题与字段 */}
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 flex flex-col gap-2">
                        <label htmlFor="title" className="text-sm font-bold text-gray-700">标题 <span className="text-red-500">*</span></label>
                        <InputText id="title" name="title" value={formData.title} onChange={handleChange} placeholder="请输入排行榜名称" className="w-full" required />
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                        <label htmlFor="rank_by_field" className="text-sm font-bold text-gray-700">排名字段 <span className="text-red-500">*</span></label>
                        <InputText id="rank_by_field" name="rank_by_field" value={formData.rank_by_field} onChange={handleChange} placeholder="例如: score" className="w-full" required />
                    </div>
                </div>

                {/* 第二行：描述 */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="description" className="text-sm font-bold text-gray-700">描述</label>
                    <InputTextarea id="description" name="description" value={formData.description} onChange={handleChange} rows={2} className="w-full" placeholder="排行榜用途说明" />
                </div>

                {/* 第三行：时间范围 */}
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 flex flex-col gap-2">
                        <label htmlFor="start_at" className="text-sm font-bold text-gray-700">开始时间</label>
                        <Calendar 
                            id="start_at" name="start_at" value={formData.start_at} onChange={handleChange} 
                            showTime hourFormat="24" locale="zh-CN" showIcon showButtonBar
                            placeholder="选择起始日期" className="w-full" 
                        />
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                        <label htmlFor="end_at" className="text-sm font-bold text-gray-700">结束时间</label>
                        <Calendar 
                            id="end_at" name="end_at" value={formData.end_at} onChange={handleChange} 
                            showTime hourFormat="24" locale="zh-CN" showIcon showButtonBar
                            placeholder="选择截止日期" className="w-full" 
                        />
                    </div>
                </div>

                {/* 第四行：配置项 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700">排序</label>
                        <Dropdown name="sort_order" value={formData.sort_order} options={[{label:'降序', value:'desc'}, {label:'升序', value:'asc'}]} onChange={handleChange} className="w-full" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700">类型</label>
                        <Dropdown name="type" value={formData.type} options={[{label:'分数', value:'score'}, {label:'用时', value:'time'}]} onChange={handleChange} className="w-full" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700">备注</label>
                        <InputText name="remarks" value={formData.remarks} onChange={handleChange} placeholder="选填" className="w-full" />
                    </div>
                </div>

                {/* Rules 部分 */}
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-gray-700">规则</label>
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
                        <div key={index} className="flex flex-col border border-gray-200 rounded p-3 gap-2">
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
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-gray-700">提交表单结构</label>
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
                        <div key={index} className="flex flex-col border border-gray-200 rounded p-3 gap-2">
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
            </form>
        </Card>
    );
}