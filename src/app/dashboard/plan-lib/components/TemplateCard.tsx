import React from 'react';
import { Button } from 'primereact/button';
import type { CoachPlansPreview } from '@/app/api/plan-lib/list-templates/entity';

interface TemplateCardProps {
    template: CoachPlansPreview;
    onEdit?: (id: string) => void;
    onSelect?: (template: CoachPlansPreview) => void;
    onCopy?: (id: string) => void;
    onDelete?: (id: string) => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, onEdit, onSelect, onCopy, onDelete }) => {
    return (
        <div className="group flex flex-col md:flex-row items-center gap-6 p-6 mb-4 bg-surface-0 dark:bg-surface-50 border border-surface-100 rounded-[24px] transition-all duration-300 hover:border-primary-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.02)] active:scale-[0.995]">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-900 mb-2">{template.name}</h3>
                    <p className="text-600 mb-3 line-clamp-2">
                        {template.description || '无描述'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                            {Math.ceil((template.trainingDaysCount + template.restDaysCount) / 7)} 周

                            ({template.weekDays.join(',')})
                        </span>

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

                        {/* 显示 options */}
                        {template.containedOptions && template.containedOptions.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {template.containedOptions.map((tag, index) => (
                                    <span key={index} className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded-full">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                        
                        {/* 显示全局问题答案 */}
                        {template.globalAnswers && Object.keys(template.globalAnswers).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {Object.keys(template.globalAnswers).map((question, index) => (
                                    <span key={index} className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                                        {question}
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
                    {onCopy && (
                        <Button
                            icon="pi pi-copy"
                            className="p-button-rounded p-button-text"
                            tooltip="复制"
                            onClick={() => onCopy(template.id)}
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
                    {onDelete && (
                        <Button
                            icon="pi pi-trash"
                            className="p-button-rounded p-button-text p-button-danger"
                            tooltip="删除"
                            onClick={() => onDelete(template.id)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default TemplateCard;