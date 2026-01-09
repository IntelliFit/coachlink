import React from 'react';
import { Button } from 'primereact/button';
import { Tooltip } from 'primereact/tooltip';
import type { CoachPlansPreview } from '@/app/api/plan-lib/list-templates/entity';

interface TemplateCardProps {
    template: CoachPlansPreview;
    onEdit?: (id: string) => void;
    onSelect?: (template: CoachPlansPreview) => void;
    onCopy?: (id: string) => void;
    onDelete?: (id: string) => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, onEdit, onSelect, onCopy, onDelete }) => {
    const totalWeeks = Math.ceil((template.trainingDaysCount + template.restDaysCount) / 7);

    return (
        <div className="group relative flex flex-col md:flex-row items-center gap-6 p-5 mb-4 
                        bg-surface dark:bg-surface-900 
                        border border-surface-100 dark:border-surface-800 
                        rounded-[20px] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                        hover:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.06)] hover:-translate-y-1 hover:border-primary-200
                        active:scale-[0.98]">
            
            {/* 左侧：核心指标（数值中心化） */}
            <div className="flex flex-col items-center justify-center min-w-[72px] h-[72px] bg-surface-50 dark:bg-surface-800/50 rounded-[18px] border border-surface-50 dark:border-surface-700">
                <span className="text-2xl font-black text-primary-600 dark:text-primary-400 tracking-tighter leading-none">
                    {totalWeeks}
                </span>
                <span className="text-[11px] font-bold text-surface-400 mt-1.5">
                    周计划
                </span>
            </div>

            {/* 中间：内容排版 */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-[17px] font-bold text-surface-900 dark:text-surface-0 tracking-tight truncate">
                        {template.name}
                    </h3>
                </div>
                
                <p className="text-[13px] text-surface-500 dark:text-surface-400 mb-4 line-clamp-1 leading-relaxed">
                    {template.description || '暂无计划描述'}
                </p>

                {/* 标签组：低饱和功能色 (50级背景 + 600级文字) */}
                <div className="flex flex-wrap gap-1.5">
                    <div className="flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400">
                        <i className="pi pi-calendar-plus mr-1.5 scale-75 opacity-70" />
                        每周 {template.weekDays.length} 练
                    </div>

                    {template.tags?.map((tag, i) => (
                        <span key={i} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                            {tag}
                        </span>
                    ))}

                    {template.containedOptions?.map((opt, i) => (
                        <span key={i} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400">
                            {opt}
                        </span>
                    ))}
                    
                    {Object.keys(template.globalAnswers || {}).map((q, i) => (
                        <span key={i} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                            {q}
                        </span>
                    ))}
                </div>
            </div>

            {/* 右侧：交互触发区 (Hover 后显示) */}
            <div className="flex items-center gap-1.5 
                            opacity-0 translate-x-4 pointer-events-none
                            group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto
                            transition-all duration-300 ease-out">
                {onSelect && (
                    <Button
                        icon="pi pi-check"
                        text rounded
                        severity="success"
                        className="w-9 h-9 hover:bg-green-50 dark:hover:bg-green-900/20"
                        tooltip="使用此模版" tooltipOptions={{ position: 'top' }}
                        onClick={() => onSelect(template)}
                    />
                )}
                {onCopy && (
                    <Button
                        icon="pi pi-copy"
                        text rounded
                        className="w-9 h-9 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
                        tooltip="复制" tooltipOptions={{ position: 'top' }}
                        onClick={() => onCopy(template.id)}
                    />
                )}
                {onEdit && (
                    <Button
                        icon="pi pi-pencil"
                        text rounded
                        className="w-9 h-9 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
                        tooltip="编辑" tooltipOptions={{ position: 'top' }}
                        onClick={() => onEdit(template.id)}
                    />
                )}
                <div className="w-px h-4 bg-surface-200 dark:bg-surface-700 mx-1" />
                {onDelete && (
                    <Button
                        icon="pi pi-trash"
                        text rounded
                        severity="danger"
                        className="w-9 h-9 hover:bg-red-50 dark:hover:bg-red-900/20"
                        tooltip="删除" tooltipOptions={{ position: 'top' }}
                        onClick={() => onDelete(template.id)}
                    />
                )}
            </div>
        </div>
    );
};

export default TemplateCard;