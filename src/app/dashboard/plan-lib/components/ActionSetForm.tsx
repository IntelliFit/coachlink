'use client';

import React, { useEffect } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { CoachActionRow } from '@/types';
import { ActionOptionTemplate, ActionValueTemplate } from './PlanDayCard';
import { CoachPlanAction, CoachPlanActionWithOneFilter } from '@/app/api/plan-lib/create-template/entity';
import { InputNumber } from 'primereact/inputnumber';
import { calcRecommendedLoad, LambdaModel } from '@/lib/rmCaculator'; // 导入计算函数
import { GetStudentResponseDto } from '@/app/api/coach/get-student/entity';

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
}

const ActionSetForm: React.FC<ActionSetFormProps> = ({
    set,
    setIndex,
    actionOptions,
    dayIndex,
    saving,
    onActionSetChange,
    actions,
    studentData,
}) => {     
    const currentAction = actions.find(action => action.id === set.actionId);

    const getUnit = (attr: string) => {
        switch (attr) {
            case '组数':
                return '组';

            case '次数':
                return '次';

            case '强度':
                return 'RM';

            case '休息时间':
                return 's';

            case '持续时间':
                return 's';

            default:
                break;
        }
    }

    const getUserOneRM = () => {
        switch (currentAction?.name) {

            default:
                return undefined;
        }
    }

    const considerBodyWeightActions = ['深蹲', '引体向上', '俯卧撑', '平板支撑'];

    // 当参数或算法变化时，自动计算推荐负重
    useEffect(() => {
        if (!studentData) {
            return;
        }

        const oneRm = getUserOneRM();
        const userBodyWeight = studentData?.profile?.weight;

        
        if (currentAction?.enableAutoWeightCompute && oneRm && userBodyWeight) {
            // 获取强度值（RM值）
            const intensity = set.params?.['强度'];
            // 获取算法
            const algorithm = set.params?.algorithm || '综合计算';

            // 只有当强度值存在且大于0时才计算
            if (intensity && intensity > 0) {
                // 将中文算法名称映射到LambdaModel枚举
                const modelMap: Record<string, LambdaModel> = {
                    'Epley': 'epley',
                    'Brzycki': 'brzycki',
                    'Lombardi': 'lombardi',
                    '综合计算': 'average'
                };

                const model = modelMap[algorithm] || 'average';

                // 计算推荐负重
                const recommendedWeight = calcRecommendedLoad(
                    oneRm,
                    userBodyWeight,
                    intensity,
                    considerBodyWeightActions.includes(currentAction?.name) ? 1 : 0,
                    model
                );

                // 更新推荐数值
                onActionSetChange(dayIndex, setIndex, 'params', {
                    ...set.params,
                    '负重': recommendedWeight
                });
            }
        }
    }, [set.params?.['强度'], set.params?.algorithm, studentData, currentAction]);

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

            {/* 基于attrs动态渲染字段 */}
            {currentAction?.attrs
                .map(attr => (
                    <div key={attr}>
                        <label className="block text-900 text-xs mb-1">{attr}</label>
                        <InputNumber
                            value={set.params?.[attr] || 0}
                            onValueChange={e => {
                                onActionSetChange(dayIndex, setIndex, 'params', {
                                    ...set.params,
                                    [attr]: e.value
                                });
                            }}
                            showButtons
                            suffix={getUnit(attr)}
                            className="w-full"
                            disabled={saving}
                        />
                    </div>
                ))
            }

            {currentAction?.enableAutoWeightCompute && studentData && (
                <div className="md:col-span-2 border-t border-surface-200 pt-3 mt-2">


                    {/* 智能计算输入和算法选择 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-900 text-xs mb-1">推荐数值 (kg)</label>
                            <InputNumber
                                value={set.params?.recommendedWeight || 0}
                                onValueChange={e => {
                                    onActionSetChange(dayIndex, setIndex, 'params', {
                                        ...set.params,
                                        '负重': e.value
                                    });
                                }}
                                suffix="kg"
                                className="w-full"
                                disabled={saving}
                                min={0}
                                maxFractionDigits={2}
                            />
                        </div>

                        <div>
                            <label className="block text-900 text-xs mb-1">计算算法</label>
                            <Dropdown
                                value={set.params?.algorithm || '综合计算'}
                                options={[
                                    { label: '综合计算', value: '综合计算' },
                                    { label: 'Epley', value: 'Epley' },
                                    { label: 'Brzycki', value: 'Brzycki' },
                                    { label: 'Lombardi', value: 'Lombardi' }
                                ]}
                                onChange={e => {
                                    onActionSetChange(dayIndex, setIndex, 'params', {
                                        ...set.params,
                                        algorithm: e.value
                                    });
                                }}
                                className="w-full"
                                disabled={saving}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActionSetForm;