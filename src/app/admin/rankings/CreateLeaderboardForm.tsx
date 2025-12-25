'use client';

import React, { useState } from 'react';
import { addLocale, locale } from 'primereact/api';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Calendar } from 'primereact/calendar';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { useToastContext } from '@/context/ToastContext';
import { rankingService } from '@/app/service/rankingService';
import { LeaderboardRule, LeaderboardFormInput } from '@/types/leaderboard';
import { Tag } from 'primereact/tag';
import { Checkbox } from 'primereact/checkbox';

// 配置中文语言包
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

interface CreateLeaderboardFormProps {
    onSuccess: () => void;
    visible: boolean;
    onHide: () => void;
}

export default function CreateLeaderboardForm({ onSuccess, visible, onHide }: CreateLeaderboardFormProps) {
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
    // 控制添加字段的下拉类型
    const [selectedNewType, setSelectedNewType] = useState<any>('text');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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
            const result = await rankingService.createLeaderboard(reqData);
            if (result) {
                showToast({ severity: 'success', summary: '成功', detail: '排行榜创建成功' });
                onSuccess();
                onHide();
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
    const addFormInput = (type: 'text' | 'number' | 'option') => {
        let newInput: LeaderboardFormInput;
        if (type === 'option') {
            newInput = { type: 'option', name: '', options: ['默认选项'] };
        } else {
            newInput = { type, name: '' } as LeaderboardFormInput;
        }

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

    const typeOptions = [
        { label: '文本输入', value: 'text', icon: 'pi pi-align-left', color: 'blue' },
        { label: '数字数值', value: 'number', icon: 'pi pi-percentage', color: 'green' },
        { label: '单项选择', value: 'option', icon: 'pi pi-list', color: 'orange' }
    ];

    const getTypeTag = (type: string) => {
        const config = typeOptions.find(t => t.value === type);
        return <Tag severity={type === 'option' ? 'warning' : type === 'number' ? 'success' : 'info'}
            value={config?.label} icon={config?.icon} />;
    };

    const rankFieldOptions = formData.form_schema
        .filter(i => i.name)
        .map(i => ({
            label: `${i.name}（${i.type}）`,
            value: i.name
        }));

    const ruleStatusOptions = [
        { label: 'CORRECT', value: 'success', icon: 'pi pi-check-circle' },
        { label: 'BAD', value: 'warning', icon: 'pi pi-exclamation-triangle' },
        { label: 'WARNING', value: 'error', icon: 'pi pi-times-circle' }
    ];

    const ruleStatusTemplate = (option) => {
        const colorClass = option.value === 'success' ? 'text-green-500' : option.value === 'warning' ? 'text-orange-500' : 'text-red-500';
        return (
            <div className="flex items-center gap-2">
                <i className={`${option.icon} ${colorClass}`}></i>
                <span className={colorClass}>{option.label}</span>
            </div>
        );
    }

    const renderFooter = () => (
        <div className="flex justify-end gap-2">
            <Button label="取消" icon="pi pi-times" onClick={onHide} className="p-button-text p-button-secondary" />
            <Button label="创建排行榜" icon="pi pi-check" loading={submitting} onClick={handleSubmit} autoFocus />
        </div>
    );

    return (
        <Dialog
            header="创建排行榜"
            visible={visible}
            onHide={onHide}
            footer={renderFooter()}
            style={{ width: '800px' }}
            breakpoints={{ '960px': '75vw', '641px': '100vw' }}
            modal
            className="p-fluid"
        >
            <div className="pt-2 text-surface-500">
                <div className="grid p-5">
                    {/* 第一行：标题与字段 */}
                    <div className="col-12 md:col-6 field mb-4">
                        <label className="font-bold block mb-2">标题 *</label>
                        <InputText name="title" value={formData.title} onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))} />
                    </div>

                    <div className="col-12 md:col-6 field mb-4">
                        <label className="font-bold block mb-2">排名字段 *</label>
                        <Dropdown
                            value={formData.rank_by_field}
                            options={rankFieldOptions}
                            onChange={(e) =>
                                setFormData(p => ({ ...p, rank_by_field: e.value }))
                            }
                            placeholder={
                                rankFieldOptions.length
                                    ? '请选择一个表单字段'
                                    : '请先添加表单字段'
                            }
                            disabled={rankFieldOptions.length === 0}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4 col-12 md:col-6 field mb-4">
                        <div>
                            <label htmlFor="start_at" className="font-bold block mb-2">开始时间</label>
                            <Calendar
                                id="start_at"
                                value={formData.start_at}
                                onChange={(e) => setFormData(p => ({ ...p, start_at: e.value as Date }))}
                                locale="zh-CN"
                                dateFormat="yy-mm-dd"
                                placeholder="选择开始时间"
                            />
                        </div>
                        <div className="">
                            <label htmlFor="end_at" className="font-bold block mb-2">结束时间</label>
                            <Calendar
                                id="end_at"
                                value={formData.end_at}
                                onChange={(e) => setFormData(p => ({ ...p, end_at: e.value as Date }))}
                                locale="zh-CN"
                                dateFormat="yy-mm-dd"
                                placeholder="选择结束时间"
                            />
                        </div>
                    </div>

                    {/* 其他下拉框和备注... */}
                    <div className="col-12 field mb-4">
                        <label className="font-bold block mb-2">描述</label>
                        <InputTextarea value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} rows={2} />
                    </div>

                    {/* Rules 部分 */}
                    <div className="col-12 field mb-5 pt-6">
                        <div className="flex justify-between items-center mb-3">
                            <div>
                                <label className="font-bold text-lg block">规则说明</label>
                                <small className="text-600">定义用户参与时需要遵守的规则</small>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            {formData.rules.map((rule, index) => (
                                <div key={index} className="p-inputgroup flex-1 shadow-sm">
                                    <span className="p-inputgroup-addon bg-surface-50 text-xs font-bold">{index + 1}</span>
                                    <Dropdown
                                        value={rule.status}
                                        options={ruleStatusOptions}
                                        onChange={(e) => updateRule(index, 'status', e.value)}
                                        valueTemplate={ruleStatusTemplate}
                                        itemTemplate={ruleStatusTemplate}
                                    />
                                    <InputText
                                        value={rule.detail}
                                        onChange={(e) => updateRule(index, 'detail', e.target.value)}
                                        placeholder="请输入规则明细内容..."
                                    />
                                    <Button
                                        icon="pi pi-trash"
                                        severity="danger"
                                        outlined
                                        onClick={() => removeRule(index)}
                                    />
                                </div>
                            ))}
                            {formData.rules.length === 0 && (
                                <div className="text-center p-4 border-round border-1 border-dashed border-300 text-500 text-sm">
                                    暂无规则，点击上方按钮添加
                                </div>
                            )}
                            
                            {/* 在列表底部添加加号按钮 */}
                            <div className="flex justify-center pt-2">
                                <Button
                                    type="button"
                                    icon="pi pi-plus"
                                    size="small"
                                    outlined
                                    onClick={addRule}
                                    label="添加规则"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Form Schema 部分 */}
                    <div className="col-12 field mb-5 pt-6">
                        {/* Header：完全对齐 Rules */}
                        <div className="flex justify-between items-center mb-3">
                            <div>
                                <label className="font-bold text-lg block">提交表单结构</label>
                                <small className="text-600">定义用户参与时需要填写的字段</small>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            {formData.form_schema.map((input, index) => (
                                <div
                                    key={index}
                                    className="border-1 border-200 border-round p-3 hover:border-primary transition-colors border border-surface-200 rounded-lg"
                                >
                                    {/* 顶部信息栏（类似 Rule inputgroup 的左侧编号） */}
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-primary-500 p-2 rounded-lg text-white text-xs font-bold">
                                                INPUT {index + 1}
                                            </span>

                                        </div>

                                        <Button
                                            icon="pi pi-trash"
                                            severity="danger"
                                            text
                                            onClick={() => removeFormInput(index)}
                                        />
                                    </div>

                                    {/* 基础配置区 */}
                                    <div className="grid mb-3">
                                        <div className="col-12 md:col-6 field">
                                            <label className="text-xs font-bold block mb-1 text-500 uppercase">
                                                字段名称
                                            </label>
                                            <InputText
                                                value={input.name}
                                                onChange={(e) =>
                                                    updateFormInput(index, 'name', e.target.value)
                                                }
                                                placeholder="如：真实姓名 / 联系电话"
                                            />
                                        </div>

                                        <div className="col-12 md:col-6 field">
                                            <label className="text-xs font-bold block mb-1 text-500 uppercase">
                                                数据类型
                                            </label>
                                            <Dropdown
                                                value={input.type}
                                                options={[
                                                    { label: '数字', value: 'number' },
                                                    { label: '文本', value: 'text' },
                                                    { label: '选项', value: 'option' }
                                                ]}
                                                onChange={(e) =>
                                                    updateFormInput(index, 'type', e.value)
                                                }
                                            />
                                        </div>

                                        <div className="col-12 field flex align-items-center gap-2">
                                            <Checkbox
                                                inputId={`required-${index}`}
                                                checked={!!input.required}
                                                onChange={(e) => updateFormInput(index, 'required', e.checked)}
                                            />
                                            <label htmlFor={`required-${index}`} className="text-sm cursor-pointer select-none">
                                                设为必填项 (Required)
                                            </label>
                                        </div>
                                    </div>

                                    {/* Option 专属配置 */}
                                    {input.type === 'option' && (
                                        <div className="border-top-1 border-200 pt-3">
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-sm font-bold">
                                                    选项配置
                                                </label>
                                                <Button
                                                    icon="pi pi-plus"
                                                    label="添加选项"
                                                    size="small"
                                                    className='w-[fit-content]'
                                                    outlined
                                                    onClick={() => addOption(index)}
                                                />
                                            </div>

                                            <div className="grid">
                                                {(input as any).options?.map(
                                                    (option: string, optionIndex: number) => (
                                                        <div
                                                            key={optionIndex}
                                                            className="col-12 md:col-6 py-1"
                                                        >
                                                            <div className="p-inputgroup">
                                                                <InputText
                                                                    value={option}
                                                                    onChange={(e) =>
                                                                        updateOption(
                                                                            index,
                                                                            optionIndex,
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    placeholder={`选项 ${optionIndex + 1
                                                                        }`}
                                                                    className="p-inputtext-sm"
                                                                />
                                                                <Button
                                                                    icon="pi pi-times"
                                                                    severity="danger"
                                                                    text
                                                                    onClick={() =>
                                                                        removeOption(
                                                                            index,
                                                                            optionIndex
                                                                        )
                                                                    }
                                                                />
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* 空状态 */}
                            {formData.form_schema.length === 0 && (
                                <div className="text-center p-4 border-round border-1 border-dashed border-300 text-500 text-sm">
                                    暂无表单字段，点击右上角添加
                                </div>
                            )}
                            
                            {/* 在列表底部添加加号按钮 */}
                            <div className="flex gap-2 pt-2">
                                <Button
                                    type="button"
                                    icon="pi pi-plus"
                                    size="small"
                                    outlined
                                    onClick={() => addFormInput(selectedNewType || 'text')}
                                    label="添加字段"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 其他下拉框和备注... */}
                    <div className="col-12 field mb-4">
                        <label className="font-bold block mb-2">备注</label>
                        <InputTextarea value={formData.remarks} onChange={(e) => setFormData(p => ({ ...p, remarks: e.target.value }))} rows={2} />
                    </div>
                </div>
            </div>
        </Dialog>
    );
}