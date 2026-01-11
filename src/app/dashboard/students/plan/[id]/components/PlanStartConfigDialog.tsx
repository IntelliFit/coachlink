import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { useState, useEffect } from 'react';

export interface PlanStartConfig {
    startWeek: number;
    startDay: number;
}

interface PlanStartConfigDialogProps {
    visible: boolean;
    /** Total weeks of the template to generate options */
    totalWeeks?: number;
    onHide: () => void;
    onConfirm: (config: PlanStartConfig) => void;
}

export function PlanStartConfigDialog({
    visible,
    totalWeeks = 12,
    onHide,
    onConfirm,
}: PlanStartConfigDialogProps) {
    const [startWeek, setStartWeek] = useState<number>(1);
    const [startDay, setStartDay] = useState<number>(1);

    // Reset when opening
    useEffect(() => {
        if (visible) {
            setStartWeek(1);
            setStartDay(1);
        }
    }, [visible]);

    // Generate week options
    const weekOptions = Array.from({ length: totalWeeks }, (_, i) => ({
        label: `第 ${i + 1} 周`,
        value: i + 1,
    }));

    // Generate day options (1-7)
    const dayOptions = [
        { label: '第 1 天', value: 1 },
        { label: '第 2 天', value: 2 },
        { label: '第 3 天', value: 3 },
        { label: '第 4 天', value: 4 },
        { label: '第 5 天', value: 5 },
        { label: '第 6 天', value: 6 },
        { label: '第 7 天', value: 7 },
    ];

    const handleConfirm = () => {
        onConfirm({
            startWeek,
            startDay,
        });
    };

    // Calculate days skipped
    const skippedDays = (startWeek - 1) * 7 + (startDay - 1);
    const isFromBeginning = startWeek === 1 && startDay === 1;

    const footer = (
        <div className="flex justify-end gap-2">
            <Button
                label="取消"
                icon="pi pi-times"
                onClick={onHide}
                className="p-button-text"
            />
            <Button
                label="确认导入"
                icon="pi pi-check"
                onClick={handleConfirm}
            />
        </div>
    );

    return (
        <Dialog
            visible={visible}
            onHide={onHide}
            header={
                <div className="flex items-center gap-2">
                    <i className="pi pi-calendar-plus text-primary" />
                    <span>设置起始进度</span>
                </div>
            }
            footer={footer}
            className="w-full max-w-md"
            modal
        >
            <div className="flex flex-col gap-4 p-2">
                <div className="text-surface-600 text-sm">
                    您可以选择从计划的特定位置开始执行。系统将根据您的选择自动调整计划开始日期。
                </div>

                <div className="bg-surface-50 p-4 rounded-lg border border-surface-200">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-surface-500 mb-1">起始周</label>
                            <Dropdown
                                value={startWeek}
                                options={weekOptions}
                                onChange={(e) => setStartWeek(e.value)}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-surface-500 mb-1">起始天</label>
                            <Dropdown
                                value={startDay}
                                options={dayOptions}
                                onChange={(e) => setStartDay(e.value)}
                                className="w-full"
                            />
                        </div>
                    </div>

                    {!isFromBeginning && (
                        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                            <i className="pi pi-info-circle mr-1" />
                            学员将直接从<strong>第 {startWeek} 周第 {startDay} 天</strong>开始执行。
                            <br />
                            系统会将前 {skippedDays} 天视为已完成。
                        </div>
                    )}
                </div>
            </div>
        </Dialog>
    );
}
