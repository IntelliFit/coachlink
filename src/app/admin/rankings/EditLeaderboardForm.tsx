'use client';

import React, { useEffect, useState } from 'react';
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
import { Clock } from 'lucide-react';
import { InputSwitch } from 'primereact/inputswitch';
import {
    fromISOStringToBeijingWallTimeDate,
    toBeijingISOStringFromWallTime,
} from '@/lib/beijingTime';

interface EditLeaderboardFormProps {
    leaderboardId: string;
    visible: boolean;
    onHide: () => void;
    onSuccess: () => void;
}

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

export default function EditLeaderboardForm({ leaderboardId, visible, onHide, onSuccess }: EditLeaderboardFormProps) {
    const { showToast } = useToastContext();

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
        initiator: '',
        needReview: true,
        rules: [] as LeaderboardRule[],
        form_schema: [] as LeaderboardFormInput[]
    });

    // 控制添加字段的下拉类型
    const [selectedNewType, setSelectedNewType] = useState<any>('text');
    const loadLeaderboard = async () => {
        const res = await rankingService.getLeaderboard({ id: leaderboardId });
        if (res) {
            setFormData({
                ...res.leaderboard,
                start_at: res.leaderboard?.start_at ? fromISOStringToBeijingWallTimeDate(res.leaderboard.start_at) : null,
                end_at: res.leaderboard?.end_at ? fromISOStringToBeijingWallTimeDate(res.leaderboard.end_at) : null
            });
        } else {
            showToast({
                severity: 'error',
                summary: '加载失败',
                detail: '请稍后重试',
            });
        }
    };


    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (leaderboardId) {
            loadLeaderboard();
        }
    }, [leaderboardId]);

    const handleSubmit = async () => {
        if (!formData.title || !formData.rank_by_field) {
            showToast({ severity: 'warn', summary: '提示', detail: '请填写必填项' });
            return;
        }

        setSubmitting(true);
        try {
            const reqData = {
                ...formData,
                start_at: formData.start_at ? toBeijingISOStringFromWallTime(formData.start_at) : undefined,
                end_at: formData.end_at ? toBeijingISOStringFromWallTime(formData.end_at) : undefined
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
            <Button label="取消" icon="pi pi-times" onClick={onHide} className="p-button-text p-button-secondary rounded-2xl" />
            <Button label="保存更改" icon="pi pi-check" loading={submitting} onClick={handleSubmit} className='rounded-2xl' />
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

    const typeOptions = [
        { label: '文本输入', value: 'text', icon: 'pi pi-align-left', color: 'blue' },
        { label: '数字数值', value: 'number', icon: 'pi pi-percentage', color: 'green' },
        { label: '单项选择', value: 'option', icon: 'pi pi-list', color: 'orange' }
    ];

    // --- 改良后的添加逻辑 ---
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

    const getTypeTag = (type: string) => {
        const config = typeOptions.find(t => t.value === type);
        return <Tag severity={type === 'option' ? 'warning' : type === 'number' ? 'success' : 'info'}
            value={config?.label} icon={config?.icon} />;
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

    if (!leaderboardId) {
        return null;
    }

    return (
        <Dialog
            header="编辑排行榜"
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
                    {/* 标题与排名字段组 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 col-12 mb-6">
                        {/* 标题输入 */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest ml-1">
                                活动标题 <span className="text-primary-500">*</span>
                            </label>
                            <InputText
                                name="title"
                                value={formData.title}
                                placeholder="为你的活动起一个吸引人的名字..."
                                onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                                className="w-full rounded-xl py-3 px-4 text-sm font-bold focus:bg-surface transition-all shadow-inner"
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

                        {/* 排名字段选择 */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest ml-1">
                                排名字段 <span className="text-primary-500">*</span>
                            </label>
                            <Dropdown
                                value={formData.rank_by_field}
                                options={rankFieldOptions}
                                onChange={(e) => setFormData(p => ({ ...p, rank_by_field: e.value }))}
                                placeholder={
                                    rankFieldOptions.length ? '选择用于排名的表单字段' : '请先在下方添加表单字段'
                                }
                                disabled={rankFieldOptions.length === 0}

                                // 基础容器样式：保持物理下沉感
                                className={`w-full rounded-xl`}

                                // 选项模板：数值中心化排版
                                itemTemplate={(option) => (
                                    <div className="flex items-center justify-between py-1">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-primary-400" />
                                            <span className="text-sm font-bold text-surface-700">{option.label}</span>
                                        </div>
                                        <i className="pi pi-chevron-right text-[10px] text-surface-300" />
                                    </div>
                                )}

                                pt={{
                                    input: {
                                        className: `text-sm font-bold px-4 ${!formData.rank_by_field ? 'text-surface-400' : 'text-primary-600'}`
                                    },
                                    trigger: { className: 'pr-3 text-surface-400' },
                                    panel: {
                                        className: 'border-none shadow-[0_20px_50px_rgba(0,0,0,0.12)] rounded-[20px] mt-2 overflow-hidden bg-surface/90 backdrop-blur-xl'
                                    },
                                    list: { className: 'p-2 flex flex-col gap-1' },
                                    item: ({ context }) => ({
                                        className: `
                                    rounded-xl transition-all duration-200 px-4 py-3
                                    ${context.selected
                                                ? 'bg-primary-500/70 text-surface shadow-[0_4px_12px_rgba(var(--primary-500-rgb),0.3)]'
                                                : 'hover:bg-surface-50 text-surface-600'}
            `
                                    }),
                                    // 空状态样式优化
                                    emptyMessage: {
                                        className: 'p-6 text-center text-xs font-bold text-surface-400 tracking-tight'
                                    }
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

                    {/* 时间范围组：采用卡片化聚合 */}
                    <div className="col-12 mb-8">
                        <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest ml-1 mb-2 block">
                            有效时间范围
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* 开始时间 */}
                            <div className="relative flex flex-col gap-1 bg-surface p-3 rounded-xl border border-surface-100 shadow-sm">
                                <label htmlFor="start_at" className="text-[10px] font-bold text-surface-400 flex items-center gap-1">
                                    <Clock size={10} /> 开始时间
                                </label>
                                <Calendar
                                    id="start_at"
                                    value={formData.start_at}
                                    onChange={(e) => setFormData(p => ({ ...p, start_at: e.value as Date }))}
                                    showTime
                                    hourFormat="24"
                                    locale="zh-CN"
                                    dateFormat="yy-mm-dd"
                                    placeholder="设置开始日期与时间"
                                    className="aero-calendar"
                                    inputClassName="border-none p-0 text-sm font-black text-surface-700 focus:shadow-none w-full"
                                />
                            </div>

                            {/* 结束时间 */}
                            <div className="relative flex flex-col gap-1 bg-surface p-3 rounded-xl border border-surface-100 shadow-sm">
                                <label htmlFor="end_at" className="text-[10px] font-bold text-surface-400 flex items-center gap-1">
                                    <Clock size={10} /> 结束时间
                                </label>
                                <Calendar
                                    id="end_at"
                                    value={formData.end_at}
                                    onChange={(e) => setFormData(p => ({ ...p, end_at: e.value as Date }))}
                                    showTime
                                    hourFormat="24"
                                    locale="zh-CN"
                                    dateFormat="yy-mm-dd"
                                    placeholder="设置结束日期与时间"
                                    className="aero-calendar"
                                    inputClassName="border-none p-0 text-sm font-black text-surface-700 focus:shadow-none w-full"
                                />
                            </div>
                        </div>
                    </div>



                    {/* 描述部分：增强呼吸感 */}
                    <div className="col-12 field mb-8">
                        <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest ml-1 mb-2 block">
                            详细描述
                        </label>
                        <InputTextarea
                            value={formData.description}
                            onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                            rows={3}
                            autoResize
                            className="w-full rounded-[20px] p-4 text-sm font-medium focus:bg-surface transition-all shadow-inner leading-relaxed"
                            placeholder="请简要说明该活动的背景或参与要求..."
                        />
                    </div>

                    {/* Rules 部分：规则说明 */}
                    <div className="col-12 field mb-8 pt-4">
                        {/* Header：对齐之前的表单结构配置风格 */}
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <h2 className="text-xl font-black text-surface-900 tracking-tight mb-1">规则说明</h2>
                                <p className="text-surface-400 text-xs font-medium">定义用户参与时需要遵循的准则</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            {formData.rules.map((rule, index) => (
                                <div
                                    key={index}
                                    className="group flex flex-col md:flex-row items-stretch md:items-center gap-2 bg-surface p-2 md:p-1.5 rounded-[22px] border border-surface-100 shadow-[0_2px_8px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_20px_rgb(0,0,0,0.04)] transition-all"
                                >
                                    {/* 编号：数值中心化 */}
                                    <div className="hidden md:flex items-center justify-center w-8 h-8 ml-2 bg-surface-900 text-surface rounded-full text-[10px] font-black shrink-0">
                                        {index + 1}
                                    </div>

                                    {/* 状态下拉：轻盈磁贴化 */}
                                    <div className="w-full md:w-32 shrink-0">
                                        <Dropdown
                                            value={rule.status}
                                            options={ruleStatusOptions}
                                            onChange={(e) => updateRule(index, 'status', e.value)}
                                            valueTemplate={ruleStatusTemplate}
                                            itemTemplate={ruleStatusTemplate}
                                            className="w-full bg-surface-50/80 border-none rounded-xl h-10 flex items-center"
                                            pt={{
                                                input: { className: 'text-xs font-bold px-3' },
                                                trigger: { className: 'w-8' }
                                            }}
                                        />
                                    </div>

                                    {/* 内容输入：占据剩余空间 */}
                                    <div className="flex-1">
                                        <InputText
                                            value={rule.detail}
                                            onChange={(e) => updateRule(index, 'detail', e.target.value)}
                                            placeholder="定义一条新的规则明细..."
                                            className="w-full border-none bg-transparent shadow-none text-sm font-medium py-2 px-3 focus:ring-0"
                                        />
                                    </div>

                                    {/* 删除操作：低饱和度降噪 */}
                                    <Button
                                        icon="pi pi-trash"
                                        severity="danger"
                                        text
                                        className="w-10 h-10 p-0 transition-opacity"
                                        onClick={() => removeRule(index)}
                                    />
                                </div>
                            ))}

                            {/* 空状态：骨架化占位 */}
                            {formData.rules.length === 0 && (
                                <div className="flex flex-col items-center justify-center p-8 bg-surface-50/30 border-2 border-dashed border-surface-200 rounded-[24px]">
                                    <p className="text-surface-400 text-xs font-bold">暂无规则条目</p>
                                </div>
                            )}

                            {/* 底部添加按钮：磁贴占位模式 */}
                            <button
                                type="button"
                                onClick={addRule}
                                className="w-full h-12 flex items-center justify-center gap-2 border-2 border-dashed border-surface-200 rounded-[22px] text-surface-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/30 transition-all active:scale-[0.99]"
                            >
                                <i className="pi pi-plus text-xs" />
                                <span className="text-xs font-bold tracking-tight">添加规则条目</span>
                            </button>
                        </div>
                    </div>

                    {/* Form Schema 部分 */}
                    <div className="col-12 field mb-8 pt-6">
                        {/* Header：保持紧凑，主动作位于右侧 */}
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <h2 className="text-xl font-black text-surface-900 tracking-tight mb-1">表单结构配置</h2>
                                <p className="text-surface-400 text-xs font-medium">定义用户参与时需要填写的核心数据字段</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            {formData.form_schema.map((input, index) => (
                                <div
                                    key={index}
                                    className="relative bg-surface rounded-[24px] p-5 border border-surface-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.04)]"
                                >
                                    {/* 顶部状态栏 */}
                                    <div className="flex justify-between items-center mb-5">
                                        <div className="flex items-center gap-3">
                                            <span className="flex items-center justify-center bg-surface-900 text-surface w-6 h-6 rounded-lg text-[10px] font-black">
                                                {index + 1}
                                            </span>
                                            <div className="px-2 py-0.5 bg-primary-50 text-primary-600 rounded-md text-[10px] font-black uppercase tracking-wider border border-primary-100/50">
                                                {input.type || 'TEXT'}
                                            </div>
                                        </div>
                                        <Button
                                            icon="pi pi-trash"
                                            severity="danger"
                                            text
                                            className="p-button-rounded p-button-sm transition-opacity"
                                            onClick={() => removeFormInput(index)}
                                        />
                                    </div>

                                    {/* 基础配置区 */}
                                    <div className="grid gap-4">
                                        <div className="col-12 md:col-6 flex flex-col gap-1.5">
                                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest ml-1">字段名称</label>
                                            <InputText
                                                value={input.name}
                                                onChange={(e) => updateFormInput(index, 'name', e.target.value)}
                                                placeholder="描述该字段的用途..."
                                                className="w-full  rounded-xl py-2.5 px-4 text-sm font-medium focus:bg-surface transition-all shadow-inner"
                                            />
                                        </div>

                                        <div className="col-12 md:col-6 flex flex-col gap-1.5">
                                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest ml-1">数据类型</label>
                                            <Dropdown
                                                value={input.type}
                                                options={[
                                                    { label: '数字录入', value: 'number', icon: 'pi pi-hashtag' },
                                                    { label: '文本描述', value: 'text', icon: 'pi pi-align-left' },
                                                    { label: '单项选择', value: 'option', icon: 'pi pi-list' },
                                                    { label: '视频上传', value: 'video', icon: 'pi pi-video' },
                                                ]}
                                                onChange={(e) => updateFormInput(index, 'type', e.value)}
                                                className="w-full bg-surface-50/50 border-none rounded-xl h-[46px] flex items-center shadow-inner transition-all focus:bg-surface"

                                                // 自定义选项模板：增加图标和数值中心化排版
                                                itemTemplate={(option) => (
                                                    <div className="flex items-center gap-3 py-1">
                                                        <i className={`${option.icon} text-surface-400 text-xs`} />
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-surface-700">{option.label}</span>
                                                            <span className="text-[9px] font-black text-surface-300 uppercase tracking-widest">{option.value}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                pt={{
                                                    // 输入框部分
                                                    input: { className: 'text-sm font-bold text-surface-600 px-4 py-2.5' },
                                                    trigger: { className: 'pr-3' },

                                                    // 核心：弹出面板优化
                                                    panel: {
                                                        className: 'border-none shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[20px] mt-2 overflow-hidden bg-surface/80 backdrop-blur-xl'
                                                    },
                                                    list: { className: 'p-2 flex flex-col gap-1' },
                                                    item: ({ context }) => ({
                                                        className: `
                                                            rounded-xl transition-all duration-200 px-3 py-2
                                                            ${context.selected ? 'bg-primary-500/70 text-surface' : 'hover:bg-surface-100 text-surface-600'}
                                                            ${context.focused && !context.selected ? 'bg-surface-50' : ''}
            `
                                                    })
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Option 专属配置：采用列表结尾添加模式 */}
                                    {input.type === 'option' && (
                                        <div className="mt-5 pt-5 border-t border-dashed border-surface-200">
                                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest ml-1 mb-3 block">
                                                可选项列表 (Options List)
                                            </label>

                                            <div className="grid gap-2">
                                                {(input as any).options?.map((option: string, optionIndex: number) => (
                                                    <div key={optionIndex} className="col-12 md:col-6">
                                                        <div className="flex items-center gap-2 bg-surface-50 rounded-xl p-1 pr-2 border border-transparent hover:border-surface-200 transition-all">
                                                            <InputText
                                                                value={option}
                                                                onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                                                                placeholder={`选项 ${optionIndex + 1}`}
                                                                className="flex-1 border-none bg-transparent shadow-none text-xs font-medium py-2 px-3"
                                                            />
                                                            <Button
                                                                icon="pi pi-times"
                                                                severity="secondary"
                                                                text
                                                                className="p-button-sm p-0 w-6 h-6 min-w-0 opacity-50 hover:opacity-100"
                                                                onClick={() => removeOption(index, optionIndex)}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* 增加选项按钮：作为列表的最后一个 Slot */}
                                                <div className="col-12 md:col-6">
                                                    <button
                                                        type="button"
                                                        onClick={() => addOption(index)}
                                                        className="w-full h-[38px] flex items-center justify-center gap-2 border-2 border-dashed border-surface-200 rounded-xl text-surface-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/30 transition-all active:scale-[0.98]"
                                                    >
                                                        <i className="pi pi-plus text-xs" />
                                                        <span className="text-xs font-bold">增加候选项</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className='mt-5'>
                            <button
                                type="button"
                                onClick={() => addFormInput(selectedNewType || 'text')}
                                className="w-full h-12 flex items-center justify-center gap-2 border-2 border-dashed border-surface-200 rounded-[22px] text-surface-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/30 transition-all active:scale-[0.99]"
                            >
                                <i className="pi pi-plus text-xs" />
                                <span className="text-xs font-bold tracking-tight">新增字段</span>
                            </button>
                        </div>
                    </div>

                    {/* 其他下拉框和备注... */}
                    <div className="col-12 field mb-4 mt-5">
                        <label className="font-bold block mb-2">备注</label>
                        <InputTextarea value={formData.remarks} onChange={(e) => setFormData(p => ({ ...p, remarks: e.target.value }))} rows={2} />
                    </div>
                </div>
            </div>
        </Dialog>
    );
}
