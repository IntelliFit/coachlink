'use client';

import React from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { useRouter } from 'next/navigation';

interface PlanCompletionModalProps {
    visible: boolean;
    onHide: () => void;
    planName: string;
    completionRate: number;
    onUpdateProfile: () => void;
    onGenerateNextPlan: () => void;
    onViewHistory: () => void;
}

export const PlanCompletionModal: React.FC<PlanCompletionModalProps> = ({
    visible,
    onHide,
    planName,
    completionRate,
    onUpdateProfile,
    onGenerateNextPlan,
    onViewHistory,
}) => {
    const router = useRouter();

    const handleUpdateProfile = () => {
        onHide();
        onUpdateProfile();
    };

    const handleGenerateNext = () => {
        onHide();
        onGenerateNextPlan();
    };

    const handleViewHistory = () => {
        onHide();
        onViewHistory();
    };

    return (
        <Dialog
            visible={visible}
            onHide={onHide}
            header={null}
            showHeader={false}
            modal
            style={{ width: '90vw', maxWidth: '500px' }}
            contentClassName="p-0"
        >
            <div className="p-6 text-center">
                {/* Celebration Icon */}
                <div className="mb-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 mb-4">
                        <i className="pi pi-check text-4xl text-white" />
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-surface-900 mb-2">
                    🎉 恭喜完成训练计划！
                </h2>

                {/* Plan Info */}
                <p className="text-surface-600 mb-1">
                    <span className="font-semibold">{planName}</span>
                </p>
                <p className="text-sm text-surface-500 mb-6">
                    完成度：{completionRate}%
                </p>

                {/* Message */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
                    <p className="text-sm text-surface-700 leading-relaxed">
                        您的身体可能已经发生变化，建议<span className="font-semibold text-blue-600">更新训练问卷</span>以获取更精准的下一阶段训练建议。
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                    <Button
                        label="更新问卷并生成下一阶段"
                        icon="pi pi-sparkles"
                        className="w-full p-button-lg"
                        onClick={handleUpdateProfile}
                    />
                    
                    <Button
                        label="直接生成下一阶段"
                        icon="pi pi-forward"
                        className="w-full p-button-lg p-button-outlined"
                        onClick={handleGenerateNext}
                    />

                    <div className="flex gap-2">
                        <Button
                            label="查看执行记录"
                            icon="pi pi-history"
                            className="flex-1 p-button-text"
                            onClick={handleViewHistory}
                        />
                        <Button
                            label="稍后再说"
                            className="flex-1 p-button-text p-button-secondary"
                            onClick={onHide}
                        />
                    </div>
                </div>
            </div>
        </Dialog>
    );
};

export default PlanCompletionModal;
