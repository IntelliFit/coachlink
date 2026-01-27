'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Pencil } from 'lucide-react';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { coachService } from '@/app/service/coachService';

interface SubscribeItem {
    type: 'tags' | 'times' | 'rm' | string;
    id?: string;
    question?: string;
    userSelection?: string | number;
    userSelections?: string[];
    userInputs?: Record<string, number>;
    options?: string[];
}

interface StudentSubscribeDataViewProps {
    data: SubscribeItem[] | null;
    loading?: boolean;
    autoComputeActions?: { id: string; name: string }[];
    onEdit?: () => void;
}

export const StudentSubscribeDataView: React.FC<StudentSubscribeDataViewProps> = ({
    data,
    loading,
    autoComputeActions = [],
    onEdit
}) => {
    const [optionMap, setOptionMap] = useState<Record<string, string[]>>({});
    const hasOption = useMemo(() => (data || []).some((item) => item.type === 'option'), [data]);

    useEffect(() => {
        const loadQuestionnaireOptions = async () => {
            if (!hasOption) return;
            const res = await coachService.getQuestionnaires();
            const qs = res?.questionnaires || [];
            const map: Record<string, string[]> = {};
            qs.forEach((q: any) => {
                if (q?.id && Array.isArray(q.options)) {
                    map[q.id] = q.options;
                }
            });
            setOptionMap(map);
        };
        loadQuestionnaireOptions();
    }, [hasOption]);

    const getQuestionText = (item: SubscribeItem) => {
        // 兼容：部分题型（tags/times/rm）历史上不存 question 字段，标题需由前端按类型提供
        if (item.question && item.question.trim()) return item.question;

        switch (item.type) {
            case 'tags':
                return '请选择您偏好的训练项目（可多选）';
            case 'times':
                return '您希望每周训练几次？';
            case 'rm':
                return '请输入以下动作您的极限重量';
            default:
                return '未命名问卷项';
        }
    };

    // 骨架屏状态
    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between px-1">
                    <Skeleton width="100px" height="1.25rem" className="rounded-full" />
                    <Skeleton width="40px" height="1.25rem" className="rounded-full" />
                </div>
                <div className="bg-surface-50/40 rounded-[24px] p-2 space-y-2">
                    <Skeleton height="120px" className="rounded-[20px]" />
                    <Skeleton height="120px" className="rounded-[20px]" />
                </div>
            </div>
        );
    }

    if (!data || data.length === 0) return null;

    const getOptionLabel = (item: SubscribeItem) => {
        if (typeof item.userSelection !== 'number') return '未填写';
        const localOptions = Array.isArray(item.options) ? item.options : [];
        if (localOptions[item.userSelection]) return localOptions[item.userSelection];
        if (item.id && optionMap[item.id] && optionMap[item.id][item.userSelection]) {
            return optionMap[item.id][item.userSelection];
        }
        return `选项 ${item.userSelection + 1}`;
    };

    return (
        <div className="space-y-4">
            {/* 头部标题与操作 */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 font-bold tracking-tight text-surface-900 text-sm">
                    <FileText size={16} className="text-primary-500" strokeWidth={2.5} />
                    <span>本期需求</span>
                </div>
                {onEdit && (
                    <button
                        onClick={onEdit}
                        className="flex items-center gap-1 text-[11px] font-black text-primary-600 px-3 py-1 bg-primary-50 rounded-full transition-all active:scale-[0.95] hover:bg-primary-100/50"
                    >
                        <Pencil size={10} strokeWidth={3} />
                        编辑
                    </button>
                )}
            </div>

            {/* 内容容器：色阶替代线条 */}
            <div className="bg-surface-50/40 rounded-[24px] p-2 space-y-2">
                {data.map((item, index) => (
                    <div 
                        key={`q-${index}`} 
                        className="bg-white rounded-[20px] p-5 transition-all duration-300 hover:bg-white/80"
                    >
                        {/* 辅助标签 */}
                        <div className="text-[9px] font-black text-surface-300 tracking-widest uppercase mb-1">
                            Q{index + 1} · {item.type === 'tags' ? '偏好' : item.type === 'times' ? '频率' : '评估'}
                        </div>
                        
                        {/* 问题文本 */}
                        <div className="text-sm font-bold text-surface-900 mb-3 tracking-tight leading-snug">
                            {getQuestionText(item)}
                        </div>

                        {/* 答案呈现区 */}
                        <div className="px-4 py-3 bg-surface-50/50 rounded-[16px]">
                            {item.type === 'tags' ? (
                                <div className="flex flex-wrap gap-2">
                                    {item.userSelections?.map((tag, tagIndex) => (
                                        <span key={tagIndex} className="px-3 py-1 rounded-full bg-primary-50 text-primary-600 text-[11px] font-bold">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            ) : item.type === 'times' ? (
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-primary-600 tracking-tighter">
                                        {item.userSelection}
                                    </span>
                                    <span className="text-[10px] font-bold text-surface-400">次 / 每周</span>
                                </div>
                            ) : item.type === 'rm' ? (
                                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                                    {autoComputeActions.map(action => {
                                        let inputs: any = item.userInputs;
                                        if (typeof inputs === 'string') {
                                            try { inputs = JSON.parse(inputs); } catch { inputs = {}; }
                                        }
                                        return (
                                        <div key={action.id} className="flex justify-between items-center text-[11px] py-1 border-b border-surface-100/30 last:border-0">
                                            <span className="text-surface-400 font-medium">{action.name}</span>
                                            <span className="font-bold text-surface-900 tracking-tight">
                                                {inputs?.[action.id] || '--'} <small className="text-[9px] font-normal">kg</small>
                                            </span>
                                        </div>
                                    )})}
                                </div>
                            ) : item.type === 'option' ? (
                                <div className="text-sm text-surface-600 leading-relaxed font-medium italic opacity-80">
                                    {getOptionLabel(item)}
                                </div>
                            ) : (
                                <div className="text-sm text-surface-600 leading-relaxed font-medium italic opacity-80">
                                    {item.userSelection || '未填写'}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};