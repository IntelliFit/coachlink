'use client';

import React, { useState, useRef } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { ConfirmPopup, confirmPopup } from 'primereact/confirmpopup';
import { useToastContext } from '@/context/ToastContext';
import { FormPlanTrainingDay } from '@/app/api/plan-lib/create-template/entity';

interface WeekCalendarProps {
    days: FormPlanTrainingDay[];
    selectedDayIndex: number | null;
    onSelectDay: (dayIndex: number) => void;
    onAddWeek: () => void;
    onAddWeekFromExisting: (sourceWeekIndex: number) => void;
    onDeleteWeek: (weekStartIndex: number) => void;
    saving: boolean;
}

const WeekCalendar: React.FC<WeekCalendarProps> = ({
    days,
    selectedDayIndex,
    onSelectDay,
    onAddWeek,
    onAddWeekFromExisting,
    onDeleteWeek,
    saving
}) => {
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [pendingDeleteWeekIndex, setPendingDeleteWeekIndex] = useState<number | null>(null);
    const [selectedOption, setSelectedOption] = useState<'blank' | number | null>(null);
    const acceptBtnRef = useRef(null);
    const rejectBtnRef = useRef(null);
    const { showToast } = useToastContext();

    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
        weeks.push(days.slice(i, i + 7));
    }

    const confirmDelete = () => {
        if (pendingDeleteWeekIndex !== null) {
            onDeleteWeek(pendingDeleteWeekIndex);
        }
        setDeleteConfirmVisible(false);
        setPendingDeleteWeekIndex(null);
    };

    const handleAccept = () => {
        if (selectedOption === 'blank') {
            onAddWeek();
        } else if (typeof selectedOption === 'number') {
            onAddWeekFromExisting(selectedOption);
        }
    };

    const handleReject = () => {
        // 取消操作，重置选中状态
        setSelectedOption(null);
    };

    const showAddWeekPopup = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (weeks.length > 0) {
            // 重置选中选项
            setSelectedOption(null);

            confirmPopup({
                target: event.currentTarget,
                message: (
                    <div className="p-3 min-w-48">
                        <div className="flex flex-col gap-2">
                            <Button
                                label="新建空白周"
                                className={`w-full text-left justify-start option-btn ${selectedOption === 'blank' ? 'selected' : ''}`}
                                onClick={() => setSelectedOption('blank')}
                                disabled={saving}
                            />

                            {weeks.map((week, weekIndex) => {
                                const weekNumber = weekIndex + 1;
                                return (
                                    <Button
                                        key={weekIndex}
                                        label={`第 ${weekNumber} 周`}
                                        className={`w-full text-left justify-start option-btn ${selectedOption === weekIndex ? 'selected' : ''}`}
                                        onClick={() => setSelectedOption(weekIndex)}
                                        disabled={saving}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ),
                visible: true,
                accept: () => {
                    showToast({ severity: 'success', summary: '添加成功' })
                },
                reject: () => { },
                acceptLabel: '添加',
                rejectLabel: '取消',
                dismissable: true,
                onHide: () => {
                    // popup 隐藏时重置选中选项
                    setSelectedOption(null);
                }
            });
        } else {
            // 如果还没有周，直接添加空白周
            onAddWeek();
        }
    };

    return (
        <div className="h-full rounded-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-900">训练日历</h3>
                <div className="relative">
                    {weeks.length > 0 && (
                        <Button
                            label="添加周"
                            icon="pi pi-plus"
                            onClick={showAddWeekPopup}
                            disabled={saving}
                            className="p-button-sm"
                        />
                    )}
                    <ConfirmPopup
                        content={({ message, hide }) => (
                            <div className="bg-surface-0 text-surface-900 border-round p-3 shadow-lg">
                                <span>{message}</span>
                                <div className="flex align-items-center gap-2 mt-3">
                                    <Button ref={acceptBtnRef} label="添加" onClick={() => {
                                        handleAccept();
                                        showToast({ severity: 'success', summary: '添加成功' });
                                        hide();
                                    }} className="p-button-sm p-button-outlined"></Button>
                                    <Button ref={rejectBtnRef} label="取消" outlined onClick={() => { handleReject(); hide(); }} className="p-button-sm p-button-text"></Button>
                                </div>
                            </div>
                        )}
                    />
                </div>
            </div>

            {weeks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px]">
                    <div className="text-center p-8 rounded-lg">
                        <i className="pi pi-calendar text-5xl text-surface-400 mb-4 block"></i>
                        <h4 className="text-xl font-medium text-900 mb-2">暂无训练日历</h4>
                        <p className="text-surface-500 mb-4">点击"添加周"按钮创建第一周训练计划</p>
                        <Button
                            label="添加周"
                            icon="pi pi-plus"
                            onClick={showAddWeekPopup}
                            disabled={saving}
                            className="p-button-sm"
                        />
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {weeks.map((week, weekIndex) => {
                        const weekStartIndex = weekIndex * 7;
                        const weekNumber = weekIndex + 1;

                        return (
                            <div
                                key={weekIndex}
                                className="border-round p-3 border-surface-50 rounded-lg"
                            >
                                <div className="flex justify-between items-center mb-3 h-[40px]">
                                    <span className="font-medium text-800">第 {weekNumber} 周</span>

                                    {weeks.length > 1 && (
                                        <Button
                                            icon="pi pi-trash"
                                            className="p-button-text p-button-danger p-button-sm text-sm"
                                            disabled={saving}
                                            tooltip="删除整周"
                                            onClick={() => {
                                                setPendingDeleteWeekIndex(weekStartIndex);
                                                setDeleteConfirmVisible(true);
                                            }}
                                        />
                                    )}
                                </div>
                                <div className="grid grid-cols-7 gap-3">
                                    {week.map((day) => {
                                        const isSelected = selectedDayIndex === day.dayIndex;
                                        const isTraining = day.type === 'training';

                                        return (
                                            <div
                                                key={day.dayIndex}
                                                onClick={() => !saving && onSelectDay(day.dayIndex)}
                                                className={`
                                                    relative cursor-pointer rounded-xl p-3
                                                    border border-surface-200
                                                    flex flex-col items-center justify-center gap-1
                                                    transition-all duration-200
                                                    bg-surface-0

                                                    hover:-translate-y-0.5

                                                    ${isSelected
                                                        ? 'ring-2 ring-primary-300 border-primary-400 shadow-md'
                                                        : 'hover:bg-surface-50'}
                                                `}
                                            >
                                                {/* 顶部状态条 */}
                                                <div
                                                    className={`
                                                        absolute top-0 left-0 right-0 h-1 rounded-t-xl
                                                        ${isSelected ? '' : isTraining ? 'bg-primary-400' : 'bg-surface-300'}
                                                    `}
                                                />

                                                <span className="text-xs text-500 mt-1">
                                                    第 {day.dayIndex} 天
                                                </span>

                                                <span
                                                    className={`
                                                        text-xl
                                                        ${isTraining ? 'text-primary-600' : 'text-600'}
                                                    `}
                                                >
                                                    <i className={isTraining ? 'pi pi-bolt' : 'pi pi-moon'} />
                                                </span>

                                                <span className="text-xs opacity-60">
                                                    {isTraining ? '训练' : '休息'}
                                                </span>
                                            </div>
                                        );
                                    })}

                                    {Array.from({ length: 7 - week.length }).map((_, i) => (
                                        <div
                                            key={`empty-${i}`}
                                            className="
                                                rounded-xl border border-dashed border-surface-200
                                                flex items-center justify-center
                                                text-400 text-xs
                                                bg-surface-0
                                            "
                                        >
                                            —
                                        </div>
                                    ))}
                                </div>

                            </div>
                        );
                    })}
                </div>
            )}

            {/* 删除确认对话框 */}
            <Dialog
                header="确认删除"
                visible={deleteConfirmVisible}
                onHide={() => setDeleteConfirmVisible(false)}
                style={{ width: '350px' }}
                modal
            >
                <p className="mb-4">确定要删除这一整周的所有训练日吗？</p>

                <div className="flex justify-end gap-2">
                    <Button
                        label="取消"
                        className="p-button-text"
                        onClick={() => setDeleteConfirmVisible(false)}
                    />
                    <Button
                        label="删除"
                        icon="pi pi-trash"
                        className="p-button-danger"
                        onClick={confirmDelete}
                        disabled={saving}
                    />
                </div>
            </Dialog>
        </div>
    );
};

export default WeekCalendar;