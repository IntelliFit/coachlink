'use client';

import React from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';

interface PlanPreview {
    totalDays: number;
    trainingDays: number;
    restDays: number;
    focusAreas: string[];
}

interface NextPlanPreviewModalProps {
    visible: boolean;
    onHide: () => void;
    planName: string;
    preview: PlanPreview;
    onActivate: () => void;
    onEdit: () => void;
    loading?: boolean;
}

export const NextPlanPreviewModal: React.FC<NextPlanPreviewModalProps> = ({
    visible,
    onHide,
    planName,
    preview,
    onActivate,
    onEdit,
    loading = false,
}) => {
    return (
        <Dialog
            visible={visible}
            onHide={onHide}
            header="预览下一阶段计划"
            modal
            style={{ width: '90vw', maxWidth: '600px' }}
        >
            <div className="space-y-4">
                {/* Plan Name */}
                <div>
                    <h3 className="text-xl font-bold text-surface-900 mb-1">
                        {planName}
                    </h3>
                    <Tag severity="info" value="智能生成" icon="pi pi-sparkles" />
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-3 gap-3">
                    <Card className="p-3 text-center">
                        <div className="text-2xl font-bold text-primary-600 mb-1">
                            {preview.totalDays}
                        </div>
                        <div className="text-xs text-surface-500">总天数</div>
                    </Card>
                    <Card className="p-3 text-center">
                        <div className="text-2xl font-bold text-green-600 mb-1">
                            {preview.trainingDays}
                        </div>
                        <div className="text-xs text-surface-500">训练日</div>
                    </Card>
                    <Card className="p-3 text-center">
                        <div className="text-2xl font-bold text-surface-400 mb-1">
                            {preview.restDays}
                        </div>
                        <div className="text-xs text-surface-500">休息日</div>
                    </Card>
                </div>

                {/* Focus Areas */}
                <div>
                    <h4 className="text-sm font-semibold text-surface-700 mb-2">
                        训练重点
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {preview.focusAreas.map((area, index) => (
                            <Tag
                                key={index}
                                value={area}
                                severity="secondary"
                                className="px-3 py-1"
                            />
                        ))}
                    </div>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <i className="pi pi-info-circle text-blue-600 mt-1" />
                        <div className="text-sm text-surface-700">
                            <p className="mb-1 font-medium">💡 温馨提示</p>
                            <p className="text-surface-600">
                                此计划已根据您的最新状态和之前的训练表现生成，您可以直接激活开始训练，或先编辑调整后再开始。
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <Button
                        label="激活并开始"
                        icon="pi pi-check"
                        className="flex-1"
                        onClick={onActivate}
                        loading={loading}
                    />
                    <Button
                        label="编辑计划"
                        icon="pi pi-pencil"
                        className="flex-1"
                        outlined
                        onClick={onEdit}
                        disabled={loading}
                    />
                </div>

                <Button
                    label="取消"
                    className="w-full p-button-text p-button-secondary"
                    onClick={onHide}
                    disabled={loading}
                />
            </div>
        </Dialog>
    );
};

export default NextPlanPreviewModal;
