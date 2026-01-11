'use client';

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
    // 计算总周数
    const totalWeeks = Math.ceil((template.trainingDaysCount + template.restDaysCount) / 7);

    // 时间格式化逻辑 (对齐动作库)
    const formatActionTime = (createdAt?: string, updatedAt?: string) => {
        if (!createdAt) return null;
        const format = (dateStr: string) => {
            const date = new Date(dateStr);
            const y = date.getFullYear().toString().slice(-2);
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const d = date.getDate().toString().padStart(2, '0');
            const hh = date.getHours().toString().padStart(2, '0');
            const mm = date.getMinutes().toString().padStart(2, '0');
            return `${y}.${m}.${d} ${hh}:${mm}`;
        };

        const cText = format(createdAt);
        const uText = updatedAt ? format(updatedAt) : cText;

        if (cText === uText) {
            return { label: '创建于', time: cText, isUpdate: false };
        }
        return { label: '修改于', time: uText, isUpdate: true };
    };

    const timeInfo = formatActionTime(template.createdAt, template.updatedAt);

    return (
        <div className="group relative flex items-center gap-5 p-4 mb-3 bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 rounded-[20px] transition-all duration-300 hover:shadow-[0_12px_30px_-10px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 hover:border-primary-200">
            
            {/* 左侧：核心指标（对齐动作库 56px 尺寸） */}
            <div className="flex flex-col items-center justify-center min-w-[56px] h-[56px] bg-primary-50 dark:bg-primary-900/20 rounded-[16px] border border-primary-100 dark:border-primary-800/50 shadow-sm shrink-0">
                <span className="text-xl font-black text-primary-600 dark:text-primary-400 tracking-tighter leading-none">
                    {totalWeeks}
                </span>
                <span className="text-[9px] font-black text-primary-500/70 uppercase mt-1">
                    Weeks
                </span>
            </div>

            {/* 中间内容区 */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-surface-900 dark:text-surface-0 tracking-tight truncate">
                            {template.name}
                        </h3>
                    </div>

                    {/* 极简时间显示 (对齐动作库) */}
                    {timeInfo && (
                        <div className="hidden sm:flex items-center gap-2 opacity-40 group-hover:opacity-70 transition-opacity duration-300">
                            <span className="text-[10px] tracking-tight whitespace-nowrap">
                                {timeInfo.label}
                            </span>
                            <span className="text-[11px] tracking-tighter">
                                {timeInfo.time}
                            </span>
                        </div>
                    )}
                </div>
                
                <p className="text-[13px] text-surface-500 dark:text-surface-400 line-clamp-1 mb-3 leading-relaxed">
                    {template.description || '暂无计划模版描述'}
                </p>

                {/* 底部功能标签组 */}
                <div className="flex flex-wrap gap-1.5 items-center">
                    <div className="flex items-center text-[10px] font-black px-2 py-0.5 rounded-md bg-surface-100 text-surface-500 dark:bg-surface-800 uppercase tracking-widest">
                        {template.weekDays.length === 0 
                            ? '频率未设定'
                            : template.weekDays.length === 1
                                ? `每周 ${template.weekDays[0]} 练`
                                : `每周 ${Math.min(...template.weekDays)}-${Math.max(...template.weekDays)} 练`
                        }
                    </div>
                    
                    {/* 微型垂直分割线 */}
                    {(template.tags?.length > 0 || template.containedOptions?.length > 0) && (
                        <div className="w-px h-2 bg-surface-200 dark:bg-surface-700 mx-1" />
                    )}

                    {template.tags?.slice(0, 2).map((tag, i) => (
                        <span key={i} className="text-[10px] font-bold text-primary-500/80">
                            #{tag}
                        </span>
                    ))}

                    {template.containedOptions?.slice(0, 2).map((opt, i) => (
                        <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-md border border-primary-100 text-primary-600 dark:border-primary-900/30">
                            {opt}
                        </span>
                    ))}
                </div>
            </div>

            {/* 右侧交互区 (对齐动作库 Hover 逻辑) */}
            <div className="flex items-center gap-1 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto shrink-0">
                {onSelect && (
                    <Button icon="pi pi-check" text rounded severity="success" className="w-9 h-9 hover:bg-green-50" onClick={() => onSelect(template)} />
                )}
                {onCopy && (
                    <Button icon="pi pi-copy" text rounded className="w-9 h-9 text-surface-400 hover:bg-surface-100" onClick={() => onCopy(template.id)} />
                )}
                {onEdit && (
                    <Button icon="pi pi-pencil" text rounded className="w-9 h-9 text-surface-400 hover:bg-surface-100" onClick={() => onEdit(template.id)} />
                )}
                {onDelete && (
                    <Button icon="pi pi-trash" text rounded severity="danger" className="w-9 h-9 hover:bg-red-50" onClick={() => onDelete(template.id)} />
                )}
            </div>
        </div>
    );
};

export default TemplateCard;