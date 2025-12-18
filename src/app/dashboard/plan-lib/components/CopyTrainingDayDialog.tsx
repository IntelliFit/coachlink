'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { CoachActionRow } from '@/types';
import { ArrowRight, Calendar, Copy } from 'lucide-react';
import { FormPlanTrainingDay } from '@/app/api/plan-lib/create-template/entity';


interface CopyTrainingDayDialogProps {
    visible: boolean;
    onHide: () => void;
    trainingDays: FormPlanTrainingDay[];
    onSelectDay: (dayIndex: number) => void;
    saving: boolean;
    actions: CoachActionRow[]; // 添加 actions 属性
    targetDayIndex: number; // 添加目标天数属性
}

const CopyTrainingDayDialog: React.FC<CopyTrainingDayDialogProps> = ({
    visible,
    onHide,
    trainingDays,
    onSelectDay,
    saving,
    actions,
    targetDayIndex
}) => {
    const [selectedSourceDay, setSelectedSourceDay] = useState<FormPlanTrainingDay | null>(null);

    // 计算周数和天数
    const getWeekAndDay = (dayIndex: number) => {
        const week = Math.floor(dayIndex / 7) + 1;
        const day = (dayIndex % 7) + 1;
        return { week, day };
    };

    // 按周分组训练日
    const groupDaysByWeek = () => {
        const weeks: { [key: number]: FormPlanTrainingDay[] } = {};

        trainingDays.forEach(day => {
            const { week } = getWeekAndDay(day.dayIndex - 1);
            if (!weeks[week]) {
                weeks[week] = [];
            }
            weeks[week].push(day);
        });

        return weeks;
    };

    // 渲染带周标识的日历视图
    const renderCalendarWithWeeks = () => {
        const weeks = groupDaysByWeek();
        const weekNumbers = Object.keys(weeks)
            .map(Number)
            .sort((a, b) => a - b);

        return (
            <>
                {weekNumbers.map(weekNum => {
                    const daysInWeek = weeks[weekNum] || [];

                    const dayMap: { [key: number]: FormPlanTrainingDay } = {};
                    daysInWeek.forEach(day => {
                        const { day: dayOfWeek } = getWeekAndDay(day.dayIndex - 1);
                        dayMap[dayOfWeek] = day;
                    });

                    return (
                        <div key={weekNum} className="mb-8">
                            {/* 周标题 */}
                            <div className="mb-3 text-sm font-semibold text-700">
                                第 {weekNum} 周
                            </div>

                            <div className="grid grid-cols-7 gap-3">
                                {Array.from({ length: 7 }, (_, dayIndex) => {
                                    const day = dayMap[dayIndex + 1];

                                    if (day) {
                                        const isTraining = day.type === 'training';
                                        const isSelected =
                                            selectedSourceDay?.dayIndex === day.dayIndex;
                                        const isTargetDay =
                                            day.dayIndex === targetDayIndex + 1;

                                        const isDisabled = isTargetDay || saving;

                                        return (
                                            <div
                                                key={day.dayIndex}
                                                onClick={() => {
                                                    if (isDisabled) return;
                                                    handleSelectDay(day);
                                                }}
                                                className={`
                                                    relative rounded-xl p-3
                                                    flex flex-col items-center justify-center gap-1
                                                    border border-surface-200
                                                    bg-surface-0
                                                    transition-all duration-200 ease-out

                                                    ${!isDisabled && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md'}
                                                    ${isSelected &&
                                                        'ring-2 ring-primary-300 border-primary-400 shadow-md scale-[1.02] bg-primary-50/40'}
                                                    ${isDisabled && 'opacity-50 cursor-not-allowed'}
                                                `}
                                            >
                                                {/* 顶部状态条 */}
                                                <div
                                                    className={`
                                                        absolute top-0 left-0 right-0 h-1 rounded-t-xl
                                                        transition-all
                                                        ${isTraining
                                                                ? isSelected
                                                                    ? 'bg-primary-500'
                                                                    : 'bg-primary-300'
                                                                : isSelected
                                                                    ? ''
                                                                    : 'bg-surface-300'}
                                                    `}
                                                />

                                                {!isTargetDay && (
                                                    <div>
                                                        <span className="text-xs text-500 mt-1">
                                                            第 {day.dayIndex} 天
                                                        </span>

                                                        <span
                                                            className={`
                                                                text-xl transition-all
                                                                ${isTraining ? 'text-primary-600' : 'text-600'}
                                                                ${isSelected ? 'scale-110' : ''}
                                                            `}
                                                        >
                                                            <i
                                                                className={
                                                                    isTraining
                                                                        ? 'pi pi-bolt'
                                                                        : 'pi pi-moon'
                                                                }
                                                            />
                                                        </span>

                                                        <span className="text-xs opacity-60">
                                                            {isTraining ? '训练' : '休息'}
                                                        </span>
                                                    </div>
                                                )}

                                                {isTargetDay && (
                                                    <span className="text-[10px] text-400">
                                                        当前目标
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    }

                                    // 空占位
                                    const dayIndexNumber =
                                        (weekNum - 1) * 7 + dayIndex + 1;

                                    return (
                                        <div
                                            key={`empty-${dayIndexNumber}`}
                                            className="
                                            rounded-xl border border-dashed border-surface-200
                                            flex flex-col items-center justify-center
                                            text-400 text-xs
                                            bg-surface-0
                                        "
                                        >
                                            —
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </>
        );
    };


    // 默认选择第一个训练日
    useEffect(() => {
        if (visible && trainingDays.length > 0 && !selectedSourceDay) {
            setSelectedSourceDay(trainingDays[0]);
        }
    }, [visible, trainingDays, selectedSourceDay]);

    const handleSelectDay = (day: FormPlanTrainingDay) => {
        if (saving) return;
        setSelectedSourceDay(day);
    };

    const handleConfirm = () => {
        if (selectedSourceDay) {
            onSelectDay(selectedSourceDay.dayIndex);
        }
    };

    // 根据动作ID查找动作名称
    const getActionName = (actionId: string) => {
        const action = actions.find(a => a.id === actionId);
        return action ? action.name : '未知动作';
    };

    // 生成标题
    const getTitle = () => {
        if (selectedSourceDay) {
            const source = getWeekAndDay(selectedSourceDay.dayIndex);
            const target = getWeekAndDay(targetDayIndex);
            return (
                <div className="flex items-center gap-2">
                    从其他训练日复制
                    <span className="font-bold">W{source.week}D{source.day}</span>
                    <ArrowRight></ArrowRight>
                    <span className="font-bold">W{target.week}D{target.day}</span>
                </div>
            );
        }
        const target = getWeekAndDay(targetDayIndex);
        return (
            <div className="flex items-center gap-2">
                <Calendar size={20} className="text-blue-500" />
                <span>选择要复制到 <span className="font-bold">W{target.week}D{target.day}</span> 的训练日</span>
            </div>
        );
    };

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

    return (
        <Dialog
            header={getTitle()}
            visible={visible}
            onHide={() => {
                onHide();
                setSelectedSourceDay(null);
            }}
            style={{
                width: '800px',    // 视口宽度的90%
                height: '80vh',   // 视口高度的80%
                maxWidth: '1200px', // 最大宽度限制
                maxHeight: '800px', // 最大高度限制
                minWidth: '300px',  // 最小宽度保证在小屏幕上可用
                minHeight: '400px'  // 最小高度保证内容显示
            }}
            modal
            maximizable
        >
            <div className='flex flex-col justify-between h-[100%]'>
                <div className="flex flex-col md:flex-row gap-4">
                    {/* 左侧：日历视图 */}
                    <div className="md:w-1/2">
                        <div className="p-4">
                            {/* 渲染带周标识的日历视图 */}
                            {renderCalendarWithWeeks()}
                        </div>
                    </div>

                    {/* 右侧：预览视图 */}
                    <div className="md:w-1/2">
                        {selectedSourceDay ? (
                            <div className="border-1 border-surface-200 border-round-lg p-4">
                                <h4 className="font-bold text-lg mb-4">训练日预览</h4>

                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-sm font-medium">日期:</span>
                                        <span className="text-sm">第 {selectedSourceDay.dayIndex} 天</span>
                                    </div>

                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-sm font-medium">类型:</span>
                                        <span className={`text-sm px-2 py-1 rounded-full ${selectedSourceDay.type === 'training'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-blue-100 text-blue-800'
                                            }`}>
                                            {selectedSourceDay.type === 'training' ? '训练日' : '休息日'}
                                        </span>
                                    </div>

                                    <div className="flex items-start gap-2 mb-3">
                                        <span className="text-sm font-medium">备注:</span>
                                        <span className="text-sm flex-1">
                                            {selectedSourceDay.note || '无备注'}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">动作数量:</span>
                                        <span className="text-sm">{selectedSourceDay.actionSetsCount} 个动作</span>
                                    </div>
                                </div>

                                {selectedSourceDay.type === 'training' && selectedSourceDay.actionSetsCount > 0 && selectedSourceDay.actionSets ? (
                                    <div className="flex flex-col gap-3 max-h-60 overflow-y-auto">
                                        {selectedSourceDay.actionSets.map((set, index) => (
                                            <div
                                                key={index}
                                                className="p-3 bg-surface-50 border-round-lg border-1 border-surface-200"
                                            >
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-medium text-sm">{getActionName(set.actionId)}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    {actions.find(action => action.id === set.actionId)?.attrs.map(attr => (
                                                        <div key={attr}>
                                                            <div>{attr}: {set.params[attr] || '--'}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : selectedSourceDay.type === 'rest' ? (
                                    <div className="py-8 px-4 text-center text-600 flex items-center justify-center min-h-10rem">
                                        <div className="flex flex-col items-center max-w-md w-full">
                                            <i className="pi pi-moon text-3xl mb-4"></i>
                                            <p className="text-sm">休息日 - 无需安排训练内容</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-4 text-center text-600">
                                        <p>该训练日暂无动作安排</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="border-1 border-surface-200 border-round-lg p-4 flex items-center justify-center h-full min-h-20rem">
                                <p>请选择一个训练日进行预览</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <Button
                        label="取消"
                        className="p-button-text"
                        onClick={() => {
                            onHide();
                            setSelectedSourceDay(null);
                        }}
                        disabled={saving}
                    />
                    <Button
                        label="确认复制"
                        icon="pi pi-copy"
                        onClick={handleConfirm}
                        disabled={saving || !selectedSourceDay}
                        autoFocus
                    />
                </div>
            </div>
        </Dialog>
    );
};

export default CopyTrainingDayDialog;