import React, { useState, useEffect } from 'react';
import { FileText, Calendar, Clock, Pencil } from 'lucide-react';
import { Skeleton } from 'primereact/skeleton';
import { RadioButton } from 'primereact/radiobutton';
import { Button } from 'primereact/button';
import { actionLibService } from '@/app/service/actionLibService';
import { CoachActionRow } from '@/types';
import { useSession } from 'next-auth/react';

interface PlanPreferencesDisplayProps {
    subscribeData: any[];
    loading?: boolean;
    coachId?: string;
    planStatus?: string; // 'active' | 'completed' | null
    onEditQuestionnaire?: () => void; // 点击编辑按钮回调
}

export const PlanPreferencesDisplay: React.FC<PlanPreferencesDisplayProps> = ({
    subscribeData,
    loading = false,
    coachId,
    planStatus,
    onEditQuestionnaire
}) => {
    const [autoComputeActions, setAutoComputeActions] = useState<CoachActionRow[]>([]);
    const [loadingActions, setLoadingActions] = useState<boolean>(true);
    const { data: session } = useSession();

    useEffect(() => {
        if (!subscribeData) return;
        
        const hasRmQuestion = subscribeData.some(item => item.type === 'rm');
        
        if (hasRmQuestion && coachId) {
            const fetchActions = async () => {
                setLoadingActions(true);
                try {
                    const res = await actionLibService.listAutoComputeActions({
                        coachId: coachId
                    });
                    if (res && res.actions) {
                        setAutoComputeActions(res.actions);
                    }
                } catch (error) {
                    console.error("Failed to fetch actions:", error);
                } finally {
                    setLoadingActions(false);
                }
            };
            fetchActions();
        } else {
            setLoadingActions(false);
        }
    }, [subscribeData, coachId]);

    // 允许随时编辑问卷（不再限制必须完成计划）
    const canEdit = Boolean(onEditQuestionnaire);

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-surface-100">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center">
                        <FileText className="text-primary-600" size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">本期训练需求</h3>
                        <p className="text-sm text-gray-500">基于您的问卷生成的训练偏好</p>
                    </div>
                </div>
                {canEdit && (
                    <Button
                        label="更新问卷"
                        icon={<Pencil size={14} className="mr-1" />}
                        size="small"
                        severity="info"
                        outlined
                        onClick={onEditQuestionnaire}
                        className="text-xs"
                    />
                )}
            </div>

            {loading ? (
                <div className="space-y-4">
                    <Skeleton height="4rem" className="rounded-xl" />
                    <Skeleton height="4rem" className="rounded-xl" />
                    <Skeleton height="4rem" className="rounded-xl" />
                </div>
            ) : (!subscribeData || subscribeData.length === 0) ? (
                 <div className="text-center py-8 text-gray-400">
                    <p>暂无训练需求数据</p>
                 </div>
            ) : (
                <div className="space-y-6">
                    {subscribeData.map((item, index) => (
                        <div key={`q-${index}`} className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                            {item.type === 'tags' ? (
                                <>
                                    <div className="text-sm font-semibold text-gray-800 mb-3">
                                        Q{index + 1}. {item.question || "偏好的训练项目"}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {item.userSelections?.map((tag: string, tagIndex: number) => (
                                            <span
                                                key={tagIndex}
                                                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-primary-700 border border-primary-100 shadow-sm"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                        {(!item.userSelections || item.userSelections.length === 0) && <span className="text-xs text-gray-400">未选择</span>}
                                    </div>
                                </>
                            ) : item.type === 'times' ? (
                                <>
                                    <div className="text-sm font-semibold text-gray-800 mb-3">
                                        Q{index + 1}. {item.question || "每周训练频率"}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {[1, 2, 3, 4, 5, 6, 7].map(num => (
                                            <div key={num} className={`flex items-center justify-center w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                                                item.userSelection === num 
                                                    ? 'bg-primary-600 text-white shadow-md shadow-primary-200' 
                                                    : 'bg-white text-gray-400 border border-gray-200'
                                            }`}>
                                                {num}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : item.type === 'rm' ? (
                                <>
                                    <div className="text-sm font-semibold text-gray-800 mb-3">
                                        Q{index + 1}. {item.question || "您的 RM 数据"}
                                    </div>
                                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                                        {loadingActions ? (
                                            <div className="space-y-2">
                                                <Skeleton width="100%" height="2rem" />
                                                <Skeleton width="100%" height="2rem" />
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {autoComputeActions.map(action => {
                                                    // Handle userInputs potentially being a string or object
                                                    let userInputs = item.userInputs;
                                                    if (typeof userInputs === 'string') {
                                                        try { userInputs = JSON.parse(userInputs); } 
                                                        catch (e) { userInputs = {}; }
                                                    }
                                                    
                                                    const val = userInputs?.[action.id] || 0;
                                                    return (
                                                        <div key={action.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                                            <span className="text-sm text-gray-600">{action.name}</span>
                                                            <span className="text-sm font-bold text-gray-900">{val > 0 ? `${val}kg` : '-'}</span>
                                                        </div>
                                                    );
                                                })}
                                                {autoComputeActions.length === 0 && <span className="text-sm text-gray-400">暂无 RM 数据配置</span>}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-sm font-semibold text-gray-800 mb-3">
                                        Q{index + 1}. {item.question || `问题 ${index + 1}`}
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-gray-200 text-sm text-gray-700 min-h-[3rem]">
                                        {typeof item.userSelection === 'string' 
                                            ? item.userSelection 
                                            : JSON.stringify(item.userSelection || item.userInputs || '未填写')}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
