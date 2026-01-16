'use client';

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { RadioButton } from 'primereact/radiobutton';
import { CoachActionRow, CoachSubscriptionRow, IntensityConfig, WeightUnit } from '@/types';
import { ActionOptionTemplate, ActionValueTemplate } from './PlanDayCard';
import { CoachPlanAction, CoachPlanActionWithOneFilter } from '@/app/api/plan-lib/create-template/entity';
import { calcRecommendedLoad, LambdaModel, normalizeIntensityConfig } from '@/lib/rmCaculator';
import { GetStudentResponseDto } from '@/app/api/coach/get-student/entity';
import { TrainingItem } from '@/types/questionnaires';
import { AeroInputNumber } from '@/components/AeroInputNumber';


interface ActionSetFormProps {
    set: CoachPlanAction | CoachPlanActionWithOneFilter;
    setIndex: number;
    actionOptions: { label: string; value: string; action: CoachActionRow }[];
    dayIndex: number;
    saving: boolean;
    onActionSetChange: (
        dayIndex: number,
        setIndex: number,
        field: string,
        value: string | number
    ) => void;
    actions: CoachActionRow[];
    studentData?: GetStudentResponseDto['student'] | null;
    planReference1RM?: number;
    subscription?: CoachSubscriptionRow | null;
    isGlobalOneRMConfigEnabled?: boolean;
}

// 强度类型选项
type IntensityTypeOption = 'rm' | 'percentage' | 'none';

const ActionSetForm: React.FC<ActionSetFormProps> = ({
    set,
    setIndex,
    actionOptions,
    dayIndex,
    saving,
    onActionSetChange,
    actions,
    studentData,
    subscription,
    planReference1RM,
    isGlobalOneRMConfigEnabled,
}) => {
    const currentAction = actions.find(action => action.id === set.actionId);
    const [advancedOpen, setAdvancedOpen] = useState(false);

    useEffect(() => {
        // 桌面端默认展开更多信息；移动端默认收起以提升信息密度
        try {
            setAdvancedOpen(window.matchMedia('(min-width: 768px)').matches);
        } catch {
            setAdvancedOpen(false);
        }
    }, []);

    // 从问卷获取初始值作为 fallback
    const questionnaireInput = ((subscription?.subscribe_data || []) as unknown as TrainingItem[]).find(item => item.type === 'rm')?.userInputs || {};

    // 从 props 计算当前强度配置（无本地状态，完全受控）
    const existingConfig = useMemo(() => normalizeIntensityConfig(set.params), [set.params]);

    // 计算当前强度类型（从 props 派生，不使用 state）
    const intensityType: IntensityTypeOption = useMemo(() => {
        if (existingConfig?.relativeIntensity?.type === 'percentage') return 'percentage';
        if (existingConfig?.relativeIntensity?.type === 'rm' || set.params?.['强度']) return 'rm';
        return 'none';
    }, [existingConfig, set.params]);

    // 百分比值（从 props 派生）
    const percentageValue = useMemo(() => {
        if (existingConfig?.relativeIntensity?.type === 'percentage') {
            return existingConfig.relativeIntensity.value;
        }
        return 80; // 默认80%
    }, [existingConfig]);

    // 推荐数值和单位（从 props 派生）
    const recommendedValue = useMemo(() => {
        return existingConfig?.recommendedLoad?.value || set.params?.load || 0;
    }, [existingConfig, set.params?.load]);

    const recommendedUnit: WeightUnit = useMemo(() => {
        return existingConfig?.recommendedLoad?.unit || 'kg';
    }, [existingConfig]);

    const getUnit = (attr: string) => {
        switch (attr) {
            case '组数':
                return '组';
            case '次数':
                return '次';
            case '强度':
                return 'RM';
            case '休息时间':
                return 'min';
            case '持续时间':
                return 's';
            default:
                break;
        }
    }

    // 获取用户1RM：优先级 PlanConfig > AggregatedAPI > Questionnaire
    // 注意：负数是有意义的，表示需要辅助的自重动作
    const getUserOneRM = useCallback(() => {
        if (!currentAction) {
            return null; // 改为返回 null 而不是 1
        }

        // 1. 优先使用计划层级的统一配置
        if (planReference1RM !== null && planReference1RM !== undefined) {
            return planReference1RM;
        }

        if (studentData && studentData.aggregated1RM) {
            let aggregatedValue = studentData.aggregated1RM[currentAction.id];

            // 如果 ID 匹配失败，尝试 Name 匹配 (fallback)
            if (aggregatedValue === undefined && currentAction.name) {
                aggregatedValue = studentData.aggregated1RM[currentAction.name];
            }
            // 负数也是有效值（表示需要辅助）
            if (aggregatedValue !== undefined && aggregatedValue !== null) {
                return aggregatedValue;
            }
        }


        // 3. Fallback 到问卷数据
        const questVal = questionnaireInput[currentAction.id];
        return questVal !== undefined ? questVal : null;
    }, [currentAction, studentData?.aggregated1RM, questionnaireInput, planReference1RM]);

    const considerBodyWeightActions = ['深蹲', '引体向上', '俯卧撑', '平板支撑'];

    // 更新 params 的统一函数
    const updateParams = useCallback((updates: Record<string, any>) => {
        onActionSetChange(dayIndex, setIndex, 'params', {
            ...set.params,
            ...updates
        });
    }, [dayIndex, setIndex, set.params, onActionSetChange]);

    // 处理强度类型切换
    const handleIntensityTypeChange = useCallback((newType: IntensityTypeOption) => {
        const newConfig: IntensityConfig = {};
        const newParams: Record<string, any> = {};

        if (newType === 'rm') {
            const rmValue = set.params?.['强度'] || 5;
            newConfig.relativeIntensity = { type: 'rm', value: rmValue };
            newParams['强度'] = rmValue;
        } else if (newType === 'percentage') {
            const pctValue = existingConfig?.relativeIntensity?.type === 'percentage'
                ? existingConfig.relativeIntensity.value
                : 80;
            newConfig.relativeIntensity = { type: 'percentage', value: pctValue };
            // 清除旧的 RM 强度字段
            newParams['强度'] = undefined;
        } else {
            // 'none' - 仅固定重量
            newParams['强度'] = undefined;
        }

        // 保留推荐数值
        if (recommendedValue > 0) {
            newConfig.recommendedLoad = { value: recommendedValue, unit: recommendedUnit };
        }

        updateParams({
            intensityConfig: Object.keys(newConfig).length > 0 ? newConfig : undefined,
            ...newParams
        });
    }, [set.params, existingConfig, recommendedValue, recommendedUnit, updateParams]);

    // 处理 RM 值变化
    const handleRmChange = useCallback((value: number | null) => {
        const rmValue = value || 5;
        const newConfig: IntensityConfig = {
            relativeIntensity: { type: 'rm', value: rmValue }
        };

        if (recommendedValue > 0) {
            newConfig.recommendedLoad = { value: recommendedValue, unit: recommendedUnit };
        }

        updateParams({
            '强度': rmValue,
            intensityConfig: newConfig
        });
    }, [recommendedValue, recommendedUnit, updateParams]);

    // 处理百分比值变化
    const handlePercentageChange = useCallback((value: number | null) => {
        const pctValue = value || 80;
        const newConfig: IntensityConfig = {
            relativeIntensity: { type: 'percentage', value: pctValue }
        };

        if (recommendedValue > 0) {
            newConfig.recommendedLoad = { value: recommendedValue, unit: recommendedUnit };
        }

        updateParams({
            '强度': undefined, // 百分比模式不使用旧字段
            intensityConfig: newConfig
        });
    }, [recommendedValue, recommendedUnit, updateParams]);

    // 处理推荐数值变化
    const handleRecommendedChange = useCallback((value: number | null, unit?: WeightUnit) => {
        const newValue = value || 0;
        const newUnit = unit || recommendedUnit;

        const newConfig: IntensityConfig = {};

        // 保留当前的相对强度设置
        if (existingConfig?.relativeIntensity) {
            newConfig.relativeIntensity = existingConfig.relativeIntensity;
        }

        if (newValue > 0) {
            newConfig.recommendedLoad = { value: newValue, unit: newUnit };
        }

        updateParams({
            load: newValue,
            loadUnit: newUnit,
            intensityConfig: Object.keys(newConfig).length > 0 ? newConfig : undefined
        });
    }, [existingConfig, recommendedUnit, updateParams]);

    // 本地状态：用户当前输入的参考1RM
    // 如果有 planReference1RM，则不再独立维护本地 manual1RM，直接使用之
    const [manual1RM, setManual1RM] = useState<number>(0);

    // 当没有 planReference1RM 时，我们才使用本地 manual1RM 逻辑
    // 如果有 planReference1RM，useEffect 会依赖它，不需要在这里 sync
    useEffect(() => {
        // 如果有计划层级的配置，优先不操作本地状态
        if (planReference1RM && planReference1RM > 0) {
            return;
        }

        const bgRm = getUserOneRM();
        // 初始化或当背景值改变且当前值为0/默认值时更新
        if (bgRm > 0 && (manual1RM === 0 || manual1RM === 1)) {
            setManual1RM(bgRm);
        } else if (manual1RM === 0) {
            setManual1RM(1); // 默认至少为1
        }
    }, [getUserOneRM, manual1RM, planReference1RM]);

    // 当动作ID改变时，重置 manual1RM，确保获取新动作的参考值
    useEffect(() => {
        setManual1RM(0); // 重置为0将触发上面的 Effect 重新获取 1RM
    }, [set.actionId]);

    // ... (existing helper functions)

    // 当参数或算法变化时，自动计算推荐负重（RM 和 百分比 两种模式都支持）
    useEffect(() => {
        if (!studentData || !currentAction?.enableAutoWeightCompute) {
            return;
        }

        // 如果是查看学员计划 (studentData存在) 或 全局配置 (planReference1RM存在)，
        // 则强制使用系统/全局定义的 1RM，忽略 manual1RM (因为输入框已隐藏，manual1RM 可能过时)
        let oneRm = manual1RM;
        if (studentData) {
            oneRm = getUserOneRM();
        } else if (planReference1RM !== null && planReference1RM !== undefined) {
            oneRm = planReference1RM;
        }
        const userBodyWeight = studentData?.profile?.weight;

        // 负数 1RM 是有意义的（表示需要辅助的自重动作）
        // 只有 null/undefined 才表示未设置
        if (oneRm === null || oneRm === undefined || !userBodyWeight || userBodyWeight <= 0) {
            // console.log('缺少1RM或体重数据，无法计算');
            return;
        }

        let calculatedWeight: number | null = null;
        const includesBodyWeight = currentAction?.includesBodyWeight ||
            considerBodyWeightActions.includes(currentAction?.name);

        if (intensityType === 'rm') {
            // RM 模式
            const rmValue = set.params?.['强度'];
            if (!rmValue || rmValue <= 0) return;

            const algorithm = set.params?.algorithm || '综合计算';
            const modelMap: Record<string, LambdaModel> = {
                'Epley': 'epley',
                'Brzycki': 'brzycki',
                'Lombardi': 'lombardi',
                '综合计算': 'average'
            };
            const model = modelMap[algorithm] || 'average';

            calculatedWeight = calcRecommendedLoad(
                oneRm,
                userBodyWeight,
                rmValue,
                includesBodyWeight ? 1 : 0,
                model
            );
        } else if (intensityType === 'percentage') {
            // 百分比模式
            const pctValue = existingConfig?.relativeIntensity?.type === 'percentage'
                ? existingConfig.relativeIntensity.value
                : percentageValue;

            if (!pctValue || pctValue <= 0) return;

            const targetTotal = oneRm * (pctValue / 100);

            if (includesBodyWeight) {
                calculatedWeight = targetTotal - userBodyWeight;
            } else {
                calculatedWeight = targetTotal;
            }
        }

        if (calculatedWeight !== null) {
            // 四舍五入到一位小数
            calculatedWeight = Math.round(calculatedWeight * 10) / 10;

            // 注意：负数是有意义的，表示需要辅助训练（如引体向上用辅助带）
            // 不再强制设为0

            // 只在计算结果有较大变化时才更新，避免无限循环
            if (Math.abs(calculatedWeight - (set.params?.load || 0)) > 0.1) {
                updateParams({
                    load: calculatedWeight,
                    loadUnit: 'kg',
                    loadCalculated: true,
                });
            }
        }
    }, [set.params?.['强度'], set.params?.algorithm, studentData, currentAction, intensityType, existingConfig, percentageValue, manual1RM, planReference1RM, updateParams]);

    // 检查当前动作是否有"强度"属性
    const hasIntensityAttr = currentAction?.attrs?.includes('强度');
    const baseAttrs = (currentAction?.attrs || []).filter(attr => attr !== '强度');

    return (
        <div className="grid grid-cols-1 gap-3">
            <div className="md:col-span-2">
                <label className="block text-900 text-xs mb-1">动作</label>
                <Dropdown
                    value={set.actionId}
                    options={actionOptions}
                    onChange={(e) => {
                        onActionSetChange(dayIndex, setIndex, 'actionId', e.value || '')
                    }}
                    optionLabel="label"
                    placeholder="选择动作"
                    filter
                    className="w-full rounded-2xl"
                    panelClassName="max-w-[calc(100vw-1.5rem)] w-[calc(100vw-1.5rem)] sm:max-w-[520px] sm:w-[520px]"
                    scrollHeight="360px"
                    appendTo="self"
                    disabled={saving}
                    itemTemplate={(option) => <ActionOptionTemplate action={option.action} />}
                    valueTemplate={(option) => <ActionValueTemplate action={option?.action || null} />}
                />
            </div>

            {baseAttrs.length > 0 && (
                <div className="md:col-span-2">
                    {/* 使用 gap-2 紧凑布局，并为移动端微调外边距 */}
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                        {baseAttrs.map(attr => (
                            <div key={attr} className="min-w-0 flex flex-col">
                                {/* 标签与单位：在上方水平排列，保持输入框纯粹 */}
                                <div className="flex justify-between items-end mb-1 px-0.5">
                                    <label className="text-surface-500 text-[10px] font-bold truncate leading-none">
                                        {attr}
                                    </label>
                                    {/* 这里的 getUnit 会直接显示，不再作为后缀挤占 Input 内部空间 */}
                                    <span className="text-surface-400 text-[9px] font-medium leading-none ml-1 flex-shrink-0">
                                        {getUnit(attr)}
                                    </span>
                                </div>

                                <div className="relative group">
                                    <AeroInputNumber
                                        value={attr === '休息时间' ? ((set.params?.[attr] || 0) / 60) : (set.params?.[attr] || 0)}
                                        onValueChange={e => {
                                            const value = attr === '休息时间' ? (e.value || 0) * 60 : e.value;
                                            updateParams({ [attr]: value });
                                        }}
                                        // 保持 inputClassName 不变
                                        inputClassName="w-full border border-surface-200 rounded-2xl text-sm !py-2 !px-3"
                                        disabled={saving}
                                        min={attr === '休息时间' ? 0.5 : 1}
                                        step={attr === '休息时间' ? 0.5 : 1}
                                        maxFractionDigits={attr === '休息时间' ? 1 : 0}
                                        // 移动端隐藏按钮可获得更纯粹的数字化观感，且避免误触
                                        // 如果业务必须保留，可设为 true
                                        showButtons={false}
                                    />

                                    {/* 交互增强层：不改变 Input 样式，但在外部包裹一层 Focus 指示线条 */}
                                    <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-focus-within:border-orange-400/30 pointer-events-none transition-all" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {hasIntensityAttr && (
                <div className="md:col-span-2 mt-4 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <label className="block text-900 text-sm font-medium mb-2">强度设置</label>
                        <button
                            type="button"
                            className="md:hidden text-[12px] font-bold text-primary-600"
                            onClick={() => setAdvancedOpen(v => !v)}
                        >
                            {advancedOpen ? '收起更多' : '更多设置'}
                        </button>
                    </div>


                    {/* 相对强度类型选择：胶囊切换风格 */}
                    <div className="flex p-1 bg-surface-100/80 rounded-[12px] w-fit mb-3 border border-surface-200/50">
                        {[
                            { label: 'RM', value: 'rm' },
                            { label: '%', value: 'percentage' },
                            { label: '固定', value: 'none' }
                        ].map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleIntensityTypeChange(opt.value as any)}
                                className={`
                        px-3 py-1.5 rounded-[9px] text-[12px] font-bold transition-all
                        ${intensityType === opt.value
                                        ? 'bg-surface text-surface-900 shadow-sm'
                                        : 'text-surface-500 hover:text-surface-700'}
                    `}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* RM 输入 */}
                        {intensityType === 'rm' && (
                            <div className="flex flex-col gap-1.5">
                                <label className="block text-900 text-xs ml-1">RM 值</label>
                                <AeroInputNumber
                                    value={set.params?.['强度'] || 5}
                                    onValueChange={e => handleRmChange(e.value)}
                                    suffix="RM"
                                    min={1}
                                    max={36}
                                    disabled={saving}
                                    inputClassName="w-full border border-surface-200 rounded-2xl text-sm !py-2 !px-3"
                                    showButtons
                                />
                                {advancedOpen && (
                                    <small className="text-500 text-xs ml-1 opacity-50">RM范围1-36，如5RM=能做5次的最大重量</small>
                                )}
                            </div>
                        )}

                        {/* 百分比输入 */}
                        {intensityType === 'percentage' && (
                            <div className="flex flex-col gap-1.5">
                                <label className="block text-900 text-xs ml-1">1RM 百分比</label>
                                <AeroInputNumber
                                    value={percentageValue}
                                    onValueChange={e => handlePercentageChange(e.value)}
                                    suffix="%"
                                    min={30}
                                    max={100}
                                    disabled={saving}
                                    inputClassName="w-full border border-surface-200 rounded-2xl text-sm !py-2 !px-3"
                                    showButtons
                                />
                                {advancedOpen && (
                                    <small className="text-500 text-xs ml-1 opacity-50">如80%=1RM的80%重量</small>
                                )}
                            </div>
                        )}

                        {/* 推荐/固定重量 */}
                        <div className="flex flex-col gap-1.5">
                            <label className="block text-900 text-xs ml-1">
                                {intensityType === 'none' ? '固定重量' : '推荐数值（备选）'}
                            </label>
                            <div className="flex gap-2">
                                <AeroInputNumber
                                    value={recommendedValue}
                                    onValueChange={e => handleRecommendedChange(e.value)}
                                    disabled={saving}
                                    min={0}
                                    maxFractionDigits={1}
                                    inputClassName="w-full border border-surface-200 rounded-2xl text-sm !py-2 !px-3"
                                    showButtons
                                />
                                <Dropdown
                                    value={recommendedUnit}
                                    options={[{ label: 'kg', value: 'kg' }, { label: 'lbs', value: 'lbs' }]}
                                    onChange={e => handleRecommendedChange(recommendedValue, e.value)}
                                    disabled={saving}
                                    pt={{
                                        root: { className: 'w-20 bg-surface-100 border-none rounded-[12px] flex items-center shadow-none' },
                                        input: { className: 'text-[12px] font-bold text-center pr-0' },
                                        trigger: { className: 'w-6' }
                                    }}
                                />
                            </div>
                            {advancedOpen && (
                                <small className="text-500 text-xs ml-1 opacity-50">
                                    {intensityType === 'none'
                                        ? '直接使用此重量'
                                        : '无法计算时使用此值'}
                                </small>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 更多设置：移动端默认折叠（备注 + 计算预览等） */}
            <div className="md:col-span-2">
                {advancedOpen && (
                    <div className="mt-2 pt-3 border-t border-surface-100">
                        {/* 备注字段 */}
                        <div className="mb-3">
                            <label className="block text-surface-400 text-[11px] font-bold uppercase tracking-widest mb-2 ml-1">备注</label>
                            <input
                                type="text"
                                value={set.params?.note || ''}
                                onChange={e => onActionSetChange(dayIndex, setIndex, 'params', { note: e.target.value } as any)}
                                placeholder="如 rpe9、热身组等"
                                className="w-full p-2.5 border border-surface-200 rounded-2xl text-sm bg-surface-50/50 focus:bg-white focus:border-primary-300 transition-all"
                                disabled={saving}
                            />
                        </div>

                        {/* 智能计算预览（仅当有学员数据且启用自动计算时） */}
                        {currentAction?.enableAutoWeightCompute && studentData && (
                            <div className="pt-2">
                                <div className="flex flex-col gap-1.5">
                                    <label className="block text-surface-400 text-[11px] font-bold ml-1">计算预览</label>

                                    <div className="flex items-center justify-between p-3 bg-surface-50 rounded-[14px] border border-surface-100/50">
                                        <div className="flex items-center gap-3">
                                            {/* 结果数值：保持清晰但尺寸适中 */}
                                            <div className="flex items-baseline gap-1">
                                                {set.params?.load !== null && set.params?.load !== undefined ? (
                                                    <>
                                                        <span className={`text-base font-black ${set.params.load < 0 ? 'text-red-500' : 'text-primary-600'}`}>
                                                            {set.params.load < 0 ? '辅助 ' : ''}{Math.abs(Number(set.params.load)).toFixed(1)}
                                                        </span>
                                                        <span className={`text-[10px] font-bold uppercase ${set.params.load < 0 ? 'text-red-400' : 'text-primary-500'}`}>
                                                            {set.params?.loadUnit || 'kg'}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-sm font-medium text-surface-400">
                                                        {!studentData?.profile?.weight ? '缺少体重数据' :
                                                            getUserOneRM() === null ? '缺少1RM数据' : '待计算'}
                                                    </span>
                                                )}
                                            </div>

                                            {/* 强度详情：辅助信息 */}
                                            <div className="flex items-center gap-2 text-[12px] text-surface-500 font-medium border-l border-surface-200 pl-3">
                                                {intensityType === 'rm' && set.params?.['强度'] && (
                                                    <span>{set.params?.['强度']}RM</span>
                                                )}
                                                {intensityType === 'percentage' && (
                                                    <span>{percentageValue}%</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* 1RM 基准信息：极简展示 */}
                                        {studentData && (
                                            <div className="text-[10px] text-surface-400 font-medium bg-white/50 px-2 py-0.5 rounded-md border border-surface-100">
                                                {getUserOneRM() !== null
                                                    ? (
                                                        <span className={getUserOneRM() < 0 ? 'text-blue-500' : ''}>
                                                            基准1RM: {getUserOneRM()}kg{getUserOneRM() < 0 ? ' (需辅助)' : ''}
                                                        </span>
                                                    )
                                                    : <span className="text-orange-500">需设置1RM</span>}
                                                {studentData?.profile?.weight
                                                    ? ` · 体重: ${studentData.profile.weight}kg`
                                                    : <span className="text-orange-500 ml-1">· 需设置体重</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActionSetForm;