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
import { Clock } from 'lucide-react';
import { InputSwitch } from 'primereact/inputswitch';

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
        initiator: '',
        needReview: true,
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
                    {/* 1. 基础信息组：标题与排名字段 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 col-12 mb-6">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest ml-1">
                                活动标题 <span className="text-primary-500">*</span>
                            </label>
                            <InputText
                                name="title"
                                value={formData.title}
                                placeholder="输入新活动名称..."
                                onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                                className={`
                                    w-full rounded-xl py-3 px-4 text-sm font-bold transition-all 
                                    /* 1. 降低 Safari 重绘压力：将 shadow-inner 替换为实色边框 */
                                    bg-surface-50/50 border border-surface-200/60
                                    /* 2. 只在焦点状态下展示下沉感或发光感 */
                                    focus:bg-surface focus:shadow-sm focus:border-primary-400
                                    /* 3. 强制开启硬件加速 */
                                    will-change-contents transform-gpu
                                `}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest ml-1">
                                发起人 <span className="text-primary-500">*</span>
                            </label>
                            <InputText
                                name="initiator"
                                value={formData.initiator}
                                placeholder="输入发起部门或姓名..."
                                onChange={(e) => setFormData(p => ({ ...p, initiator: e.target.value }))}
                                className="w-full rounded-xl py-3 px-4 text-sm font-bold transition-all bg-surface-50 border border-surface-200/60 focus:bg-surface focus:border-primary-400 transform-gpu will-change-contents"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest ml-1">
                                排名字段 <span className="text-primary-500">*</span>
                            </label>
                            <Dropdown
                                value={formData.rank_by_field}
                                options={rankFieldOptions}
                                onChange={(e) => setFormData(p => ({ ...p, rank_by_field: e.value }))}
                                placeholder={rankFieldOptions.length ? '请选择排名参考字段' : '请先在下方添加字段'}
                                disabled={rankFieldOptions.length === 0}
                                className="w-full rounded-xl"
                                pt={{
                                    input: { className: `text-sm font-bold px-4 ${!formData.rank_by_field ? 'text-surface-400' : 'text-primary-600'}` },
                                    panel: { className: 'border-none shadow-[0_20px_50px_rgba(0,0,0,0.12)] rounded-[20px] mt-2 overflow-hidden bg-surface/90 backdrop-blur-xl' },
                                    item: ({ context }) => ({
                                        className: `rounded-xl transition-all duration-200 px-4 py-3 ${context.selected ? 'bg-primary-500/70 text-surface shadow-lg' : 'hover:bg-surface-50 text-surface-600'}`
                                    })
                                }}
                            />
                        </div>

                        {/* 是否审核 (磁贴切换风格) */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest ml-1">
                                审核流程
                            </label>
                            <div className="flex items-center justify-between bg-surface-50 border border-surface-200/60 rounded-xl h-[46px] px-4">
                                <span className="text-sm font-bold text-surface-600">需要管理员审核</span>
                                <InputSwitch
                                    checked={formData.needReview}
                                    onChange={(e) => setFormData(p => ({ ...p, needReview: e.value }))}
                                    className="scale-90"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. 时间范围组：卡片化 */}
                    <div className="col-12 mb-8">
                        <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest ml-1 mb-2 block">
                            有效时间范围
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="relative flex flex-col gap-1 bg-surface-50/50 p-3 rounded-xl border border-surface-100 shadow-sm">
                                <label className="text-[10px] font-bold text-surface-400 flex items-center gap-1">
                                    <Clock size={10} /> 开始时间
                                </label>
                                <Calendar
                                    id="start_at"
                                    value={formData.start_at}
                                    onChange={(e) => setFormData(p => ({ ...p, start_at: e.value }))}
                                    showTime hourFormat="24" locale="zh-CN" dateFormat="yy-mm-dd"
                                    placeholder="设置开始日期"
                                    inputClassName="border-none p-0 bg-transparent text-sm font-black text-surface-700 focus:shadow-none w-full"
                                />
                            </div>
                            <div className="relative flex flex-col gap-1 bg-surface-50/50 p-3 rounded-xl border border-surface-100 shadow-sm">
                                <label className="text-[10px] font-bold text-surface-400 flex items-center gap-1">
                                    <Clock size={10} /> 结束时间
                                </label>
                                <Calendar
                                    id="end_at"
                                    value={formData.end_at}
                                    onChange={(e) => setFormData(p => ({ ...p, end_at: e.value }))}
                                    showTime hourFormat="24" locale="zh-CN" dateFormat="yy-mm-dd"
                                    placeholder="设置结束日期"
                                    inputClassName="border-none p-0 bg-transparent text-sm font-black text-surface-700 focus:shadow-none w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 3. 详细描述 */}
                    <div className="col-12 field mb-8">
                        <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest ml-1 mb-2 block">活动描述</label>
                        <InputTextarea
                            value={formData.description}
                            onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                            rows={3} autoResize
                            className="w-full rounded-[20px] p-4 text-sm font-medium transition-all bg-surface-50/50 border border-surface-100 focus:bg-surface will-change-contents"
                            placeholder="描述此排行榜的背景和奖励..."
                        />
                    </div>

                    {/* 4. 规则配置：磁贴化列表 */}
                    <div className="col-12 field mb-8 pt-4">
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <h2 className="text-xl font-black text-surface-900 tracking-tight mb-1">规则说明</h2>
                                <p className="text-surface-400 text-xs font-medium">配置用户参与时的准则</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3">
                            {formData.rules.map((rule, index) => (
                                <div key={index} className="group flex flex-col md:flex-row items-stretch md:items-center gap-2 bg-surface p-2 rounded-[22px] border border-surface-100 shadow-sm hover:shadow-md transition-all">
                                    <div className="hidden md:flex items-center justify-center w-8 h-8 ml-2 bg-surface-900 text-surface rounded-full text-[10px] font-black">
                                        {index + 1}
                                    </div>
                                    <div className="w-full md:w-32">
                                        <Dropdown
                                            value={rule.status}
                                            options={ruleStatusOptions}
                                            onChange={(e) => updateRule(index, 'status', e.value)}
                                            className="w-full bg-surface-50/80 border-none rounded-xl h-10 flex items-center"
                                        />
                                    </div>
                                    <InputText
                                        value={rule.detail}
                                        onChange={(e) => updateRule(index, 'detail', e.target.value)}
                                        placeholder="规则条目内容..."
                                        className="flex-1 border-none bg-transparent shadow-none text-sm font-medium py-2 px-3"
                                    />
                                    <Button icon="pi pi-trash" severity="danger" text className="w-10 h-10" onClick={() => removeRule(index)} />
                                </div>
                            ))}
                            <button type="button" onClick={addRule} className="w-full h-12 flex items-center justify-center gap-2 border-2 border-dashed border-surface-200 rounded-[22px] text-surface-400 hover:border-primary-300 hover:bg-primary-50/30 transition-all active:scale-[0.99]">
                                <i className="pi pi-plus text-xs" />
                                <span className="text-xs font-bold tracking-tight">添加规则条目</span>
                            </button>
                        </div>
                    </div>

                    {/* 5. 表单结构配置：卡片式分层 */}
                    <div className="col-12 field mb-8 pt-6">
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <h2 className="text-xl font-black text-surface-900 tracking-tight mb-1">表单结构配置</h2>
                                <p className="text-surface-400 text-xs font-medium">定义用户需要填写的数据字段</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-4">
                            {formData.form_schema.map((input, index) => (
                                <div key={index} className="relative bg-surface rounded-[24px] p-5 border border-surface-100 shadow-sm hover:shadow-lg transition-all">
                                    <div className="flex justify-between items-center mb-5">
                                        <div className="flex items-center gap-3">
                                            <span className="flex items-center justify-center bg-surface-900 text-surface w-6 h-6 rounded-lg text-[10px] font-black">{index + 1}</span>
                                            <div className="px-2 py-0.5 bg-primary-50 text-primary-600 rounded-md text-[10px] font-black uppercase tracking-wider">{input.type || 'TEXT'}</div>
                                        </div>
                                        <Button icon="pi pi-trash" severity="danger" text onClick={() => removeFormInput(index)} />
                                    </div>
                                    <div className="grid gap-4">
                                        <div className="col-12 md:col-6 flex flex-col gap-1.5">
                                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest ml-1">字段名称</label>
                                            <InputText value={input.name} onChange={(e) => updateFormInput(index, 'name', e.target.value)} className="w-full rounded-xl py-2.5 shadow-inner" />
                                        </div>
                                        <div className="col-12 md:col-6 flex flex-col gap-1.5">
                                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest ml-1">数据类型</label>
                                            <Dropdown value={input.type} options={[{ label: '数字', value: 'number' }, { label: '文本', value: 'text' }, { label: '选项', value: 'option' }]} onChange={(e) => updateFormInput(index, 'type', e.value)} className="w-full bg-surface-50/50 border-none rounded-xl h-[46px] flex items-center" />
                                        </div>
                                    </div>

                                    {/* Option 候选项渲染 */}
                                    {input.type === 'option' && (
                                        <div className="mt-5 pt-5 border-t border-dashed border-surface-200">
                                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-3 block">候选项列表</label>
                                            <div className="grid gap-2">
                                                {(input as any).options?.map((option, optIdx) => (
                                                    <div key={optIdx} className="col-12 md:col-6 flex items-center gap-2 bg-surface-50 rounded-xl p-1 pr-2 border border-transparent">
                                                        <InputText value={option} onChange={(e) => updateOption(index, optIdx, e.target.value)} className="flex-1 border-none bg-transparent shadow-none text-xs py-2 px-3" />
                                                        <Button icon="pi pi-times" severity="secondary" text className="w-6 h-6 p-0" onClick={() => removeOption(index, optIdx)} />
                                                    </div>
                                                ))}
                                                <button type="button" onClick={() => addOption(index)} className="col-12 md:col-6 h-[38px] flex items-center justify-center gap-2 border-2 border-dashed border-surface-200 rounded-xl text-surface-400 hover:text-primary-500 transition-all">
                                                    <i className="pi pi-plus text-xs" />
                                                    <span className="text-xs font-bold">增加选项</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={() => addFormInput('text')} className="mt-5 w-full h-12 flex items-center justify-center gap-2 border-2 border-dashed border-surface-200 rounded-[22px] text-surface-400 hover:border-primary-300 transition-all active:scale-[0.99]">
                            <i className="pi pi-plus text-xs" />
                            <span className="text-xs font-black tracking-tight">新增数据字段</span>
                        </button>
                    </div>

                    {/* 6. 备注 */}
                    <div className="col-12 field mb-4 mt-5">
                        <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest ml-1 mb-2 block">内部备注</label>
                        <InputTextarea value={formData.remarks} onChange={(e) => setFormData(p => ({ ...p, remarks: e.target.value }))} rows={2} className="w-full rounded-[20px] p-4 text-sm font-medium shadow-inner" />
                    </div>
                </div>
            </div>
        </Dialog>
    );
}