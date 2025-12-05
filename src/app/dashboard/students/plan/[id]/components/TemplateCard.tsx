import React from 'react';
import { Button } from 'primereact/button';
import type { CoachPlansPreview } from '@/app/api/plan-lib/list-templates/entity';

interface TemplateCardProps {
    template: CoachPlansPreview;
    onEdit?: (id: string) => void;
    onSelect?: (template: CoachPlansPreview) => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, onEdit, onSelect }) => {
    return (
        <div className="border border-surface-200 rounded-lg p-4 hover:bg-surface-50 transition-colors">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-900 mb-2">{template.name}</h3>
                    <p className="text-600 mb-3 line-clamp-2">
                        {template.description || '无描述'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                            {Math.ceil((template.trainingDaysCount + template.restDaysCount) / 7)} 周训练
                        </span>
                        {/* 显示适用人群 */}
                        {template.suitableFor && (
                            <div className="">
                                <span className="text-xs text-600">适用人群:</span>
                                <span className="ml-1 text-sm text-900">{template.suitableFor}</span>
                            </div>
                        )}
                        {/* 显示标签 */}
                        {template.tags && template.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {template.tags.map((tag, index) => (
                                    <span key={index} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex gap-1 ml-2">
                    {onSelect && (
                        <Button
                            icon="pi pi-check"
                            className="p-button-rounded p-button-text"
                            tooltip="选择"
                            onClick={() => onSelect(template)}
                        />
                    )}
                    {onEdit && (
                        <Button
                            icon="pi pi-pencil"
                            className="p-button-rounded p-button-text"
                            tooltip="编辑"
                            onClick={() => onEdit(template.id)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default TemplateCard;