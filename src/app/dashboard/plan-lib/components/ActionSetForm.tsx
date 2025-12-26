'use client';

import React, { useEffect, useMemo, useCallback } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { RadioButton } from 'primereact/radiobutton';
import { CoachActionRow, CoachSubscriptionRow, IntensityConfig, WeightUnit } from '@/types';
import { ActionOptionTemplate, ActionValueTemplate } from './PlanDayCard';
import { CoachPlanAction, CoachPlanActionWithOneFilter } from '@/app/api/plan-lib/create-template/entity';
import { InputNumber } from 'primereact/inputnumber';
import { calcRecommendedLoad, LambdaModel, normalizeIntensityConfig } from '@/lib/rmCaculator';
import { GetStudentResponseDto } from '@/app/api/coach/get-student/entity';
import { TrainingItem } from '@/types/questionnaires';

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
    subscription?: CoachSubscriptionRow | null;
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
}) => {
    const currentAction = actions.find(action => action.id === set.actionId);
    const userInput = ((subscription?.subscribe_data || []) as unknown as TrainingItem[]).find(item => item.type === 'rm')?.userInputs || {};

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

    const getUserOneRM = useCallback(() => {
        if (!currentAction) {
            return 1;
        }
        return userInput[currentAction.id] || 1;
    }, [currentAction, userInput]);

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

    // 当参数或算法变化时，自动计算推荐负重（RM 和 百分比 两种模式都支持）
    useEffect(() => {
        if (!studentData || !currentAction?.enableAutoWeightCompute) {
            return;
        }

        const oneRm = getUserOneRM();
        const userBodyWeight = studentData?.profile?.weight;

        if (!oneRm || oneRm <= 0 || !userBodyWeight || userBodyWeight <= 0) {
            console.log('缺少1RM或体重数据，无法计算');
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
            // 百分比模式：直接 1RM × 百分比，不需要减去体重
            const pctValue = existingConfig?.relativeIntensity?.type === 'percentage' 
                ? existingConfig.relativeIntensity.value 
                : percentageValue;
            
            if (!pctValue || pctValue <= 0) return;

            // 直接计算，不考虑体重
            calculatedWeight = oneRm * (pctValue / 100);
        }

        if (calculatedWeight !== null) {
            // 四舍五入到一位小数
            calculatedWeight = Math.round(calculatedWeight * 10) / 10;
            
            // 只在计算结果有较大变化时才更新，避免无限循环
            if (Math.abs(calculatedWeight - (set.params?.load || 0)) > 0.1) {
                console.log(`自动计算: ${intensityType}模式, 1RM=${oneRm}, 体重=${userBodyWeight}, 结果=${calculatedWeight}kg`);
                updateParams({
                    load: calculatedWeight,
                    loadUnit: 'kg',
                    loadCalculated: true,
                });
            }
        }
    }, [set.params?.['强度'], set.params?.algorithm, studentData, currentAction, intensityType, existingConfig, percentageValue, getUserOneRM, updateParams]);

    // 检查当前动作是否有"强度"属性
    const hasIntensityAttr = currentAction?.attrs?.includes('强度');

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    className="w-full"
                    disabled={saving}
                    itemTemplate={(option) => <ActionOptionTemplate action={option.action} />}
                    valueTemplate={(option) => <ActionValueTemplate action={option?.action || null} />}
                />
            </div>

            {/* 基于attrs动态渲染字段（排除"强度"，改为使用新UI） */}
            {currentAction?.attrs
                .filter(attr => attr !== '强度') // 排除强度，使用新UI
                .map(attr => (
                    <div key={attr}>
                        <label className="block text-900 text-xs mb-1">{attr}</label>
                        <InputNumber
                            value={attr === '休息时间' ? ((set.params?.[attr] || 0) / 60) : (set.params?.[attr] || 0)}
                            onValueChange={e => {
                                const value = attr === '休息时间' ? (e.value || 0) * 60 : e.value;
                                updateParams({ [attr]: value });
                            }}
                            showButtons
                            suffix={getUnit(attr)}
                            className="w-full"
                            disabled={saving}
                            min={attr === '休息时间' ? 0.5 : 1}
                            step={attr === '休息时间' ? 0.5 : 1}
                            maxFractionDigits={attr === '休息时间' ? 1 : 0}
                        />
                    </div>
                ))
            }

            {/* 新的强度配置区域 */}
            {hasIntensityAttr && (
                <div className="md:col-span-2 border-t border-surface-200 pt-3 mt-2">
                    <label className="block text-900 text-sm font-medium mb-2">强度设置</label>
                    
                    {/* 相对强度类型选择 */}
                    <div className="flex flex-wrap gap-4 mb-3">
                        <div className="flex items-center">
                            <RadioButton
                                inputId={`intensity-rm-${dayIndex}-${setIndex}-${set.actionId}`}
                                name={`intensity-type-${dayIndex}-${setIndex}-${set.actionId}`}
                                value="rm"
                                checked={intensityType === 'rm'}
                                onChange={() => handleIntensityTypeChange('rm')}
                                disabled={saving}
                            />
                            <label htmlFor={`intensity-rm-${dayIndex}-${setIndex}-${set.actionId}`} className="ml-2 text-sm">
                                RM
                            </label>
                        </div>
                        <div className="flex items-center">
                            <RadioButton
                                inputId={`intensity-pct-${dayIndex}-${setIndex}-${set.actionId}`}
                                name={`intensity-type-${dayIndex}-${setIndex}-${set.actionId}`}
                                value="percentage"
                                checked={intensityType === 'percentage'}
                                onChange={() => handleIntensityTypeChange('percentage')}
                                disabled={saving}
                            />
                            <label htmlFor={`intensity-pct-${dayIndex}-${setIndex}-${set.actionId}`} className="ml-2 text-sm">
                                百分比
                            </label>
                        </div>
                        <div className="flex items-center">
                            <RadioButton
                                inputId={`intensity-none-${dayIndex}-${setIndex}-${set.actionId}`}
                                name={`intensity-type-${dayIndex}-${setIndex}-${set.actionId}`}
                                value="none"
                                checked={intensityType === 'none'}
                                onChange={() => handleIntensityTypeChange('none')}
                                disabled={saving}
                            />
                            <label htmlFor={`intensity-none-${dayIndex}-${setIndex}-${set.actionId}`} className="ml-2 text-sm">
                                仅固定重量
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* RM 输入 */}
                        {intensityType === 'rm' && (
                            <div>
                                <label className="block text-900 text-xs mb-1">RM 值</label>
                                <InputNumber
                                    value={set.params?.['强度'] || 5}
                                    onValueChange={e => handleRmChange(e.value)}
                                    showButtons
                                    suffix="RM"
                                    className="w-full"
                                    disabled={saving}
                                    min={1}
                                    max={36}
                                />
                                <small className="text-500 text-xs">RM范围1-36，如5RM = 能做5次的最大重量</small>
                            </div>
                        )}

                        {/* 百分比输入 */}
                        {intensityType === 'percentage' && (
                            <div>
                                <label className="block text-900 text-xs mb-1">1RM 百分比</label>
                                <InputNumber
                                    value={percentageValue}
                                    onValueChange={e => handlePercentageChange(e.value)}
                                    showButtons
                                    suffix="%"
                                    className="w-full"
                                    disabled={saving}
                                    min={30}
                                    max={100}
                                />
                                <small className="text-500 text-xs">如80% = 1RM的80%重量</small>
                            </div>
                        )}

                        {/* 推荐/固定重量 */}
                        <div>
                            <label className="block text-900 text-xs mb-1">
                                {intensityType === 'none' ? '固定重量' : '推荐数值（备选）'}
                            </label>
                            <div className="flex gap-2">
                                <InputNumber
                                    value={recommendedValue}
                                    onValueChange={e => handleRecommendedChange(e.value)}
                                    className="flex-1"
                                    disabled={saving}
                                    min={0}
                                    maxFractionDigits={1}
                                />
                                <Dropdown
                                    value={recommendedUnit}
                                    options={[
                                        { label: 'kg', value: 'kg' },
                                        { label: 'lbs', value: 'lbs' }
                                    ]}
                                    onChange={e => handleRecommendedChange(recommendedValue, e.value)}
                                    className="w-20"
                                    disabled={saving}
                                />
                            </div>
                            <small className="text-500 text-xs">
                                {intensityType === 'none' 
                                    ? '直接使用此重量' 
                                    : '无法计算时使用此值'}
                            </small>
                        </div>
                    </div>
                </div>
            )}

            {/* 智能计算预览（仅当有学员数据且启用自动计算时） */}
            {currentAction?.enableAutoWeightCompute && studentData && (
                <div className="md:col-span-2 border-t border-surface-200 pt-3 mt-2">
                    <div>
                        <label className="block text-900 text-xs mb-1">计算预览</label>
                        <div className="p-2 bg-surface-100 rounded text-sm">
                            {set.params?.load && set.params.load > 0 ? (
                                <span className="font-semibold text-primary">
                                    {Number(set.params.load).toFixed(1)} {set.params?.loadUnit || 'kg'}
                                </span>
                            ) : (
                                <span className="text-500">待计算</span>
                            )}
                            {intensityType === 'rm' && set.params?.['强度'] && (
                                <span className="text-500 ml-2">({set.params?.['强度']}RM)</span>
                            )}
                            {intensityType === 'percentage' && (
                                <span className="text-500 ml-2">({percentageValue}%)</span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActionSetForm;