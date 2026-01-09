'use client';

import React, { useState, useEffect } from 'react';
import { Button } from 'primereact/button';
import { Badge } from 'primereact/badge';
import { Dialog } from 'primereact/dialog';
import { Skeleton } from 'primereact/skeleton';
import { ClipboardList, ChevronRight, Bolt, Moon, CheckCircle2, History } from 'lucide-react';
import { planLibService } from '@/app/service/planLibService';
import { CoachPlanInstanceRow, CoachActionRow } from '@/types';
import { CoachPlanAction } from '@/app/api/plan-lib/create-template/entity';
import { Divider } from 'primereact/divider';

interface StudentPlanExecutionViewProps {
    subscriptionId: string;
    // 新增：直接接收数据
    instance: CoachPlanInstanceRow | null;
    executions: Record<number, any>;
    loading?: boolean;
    // 基础信息
    planName?: string;
    planDescription?: string;
    isCompleted?: boolean;
}

interface TrainingDay {
    dayIndex: number;
    type: 'training' | 'rest';
    note?: string;
    actionSets?: CoachPlanAction[];
}

const StudentPlanExecutionView: React.FC<StudentPlanExecutionViewProps> = ({
    subscriptionId,
    instance,
    executions,
    loading = false,
    planName = '学员执行情况',
    planDescription = '查看详细执行记录',
    isCompleted = false
}) => {
    const [actions, setActions] = useState<Record<string, CoachActionRow>>({});

    const [detailVisible, setDetailVisible] = useState(false);
    const [videoModalVisible, setVideoModalVisible] = useState(false);
    const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

    // --- 内部渲染逻辑 (代码复用) ---
    const ExecutionDetailsSection = ({ execution }: { execution: any }) => {
        if (!execution || !execution.action_executions) return null;
        const completedSets = execution.action_executions.flatMap((ae: any) =>
            (ae.sets || []).filter((s: any) => s.status === 'completed').map((s: any) => ({
                ...s,
                action_name: ae.action_name
            }))
        );
        if (completedSets.length === 0) return null;
        return (
            <div className="mt-4 border-t border-surface-200 pt-4">
                <div className="bg-green-50 rounded-lg p-2 mb-2 border border-green-100 flex items-center gap-2 text-green-700 text-xs font-bold">
                    <CheckCircle2 size={14} /> 执行记录
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                        <tbody className="divide-y divide-surface-100">
                            {completedSets.map((set: any, idx: number) => (
                                <tr key={idx}>
                                    <td className="py-2 font-medium">{set.action_name}</td>
                                    <td className="py-2 text-surface-600">{set.actual_weight}kg × {set.actual_reps}</td>
                                    <td className="py-2 text-right">
                                        {set.has_video && (
                                            <Button icon="pi pi-video" className="p-0 h-5 w-5" text onClick={() => {
                                                setCurrentVideoUrl(set.video_url);
                                                setVideoModalVisible(true);
                                            }} />
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const ActionItem = ({ actionSet, action }: { actionSet: CoachPlanAction; action?: any }) => {
        const actionName = action?.name || actionSet.setName || '未知动作';
        return (
            <div className="p-2 bg-surface-50 rounded border border-surface-100 mb-1 flex justify-between items-center text-xs">
                <span className="font-medium">{actionName}</span>
                <span className="text-surface-500">{(actionSet as any).params?.['组数'] || 3}组</span>
            </div>
        );
    };

    const trainingDays = (instance?.training_days as unknown as TrainingDay[] || []).sort((a, b) => a.dayIndex - b.dayIndex);

    return (
        <>
            {/* 1. 外部展示卡片 (Aero 风格版) */}
            <div
                className="group relative bg-surface-50/50 rounded-[24px] p-5 cursor-pointer transition-all duration-500 ease-out border border-surface-200/70 hover:bg-surface hover:border-primary-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] active:scale-[0.98] mb-6"
                onClick={() => setDetailVisible(true)}
            >
                {/* 背景光晕装饰 */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 rounded-[24px] transition-opacity duration-500" />

                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                        {/* 图标容器：增加背景深度 */}
                        <div className="w-11 h-11 rounded-[16px] bg-surface flex items-center justify-center text-surface-400 shadow-sm border border-surface-100 transition-all duration-500 group-hover:scale-110 group-hover:text-primary-600 group-hover:border-primary-100 group-hover:shadow-primary-500/10">
                            <ClipboardList size={22} strokeWidth={2} />
                        </div>

                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-surface-900 tracking-tighter group-hover:text-primary-700 transition-colors">
                                    {planName}
                                </span>
                                {isCompleted && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-black uppercase tracking-tight rounded-full border border-green-100/50">
                                        <CheckCircle2 size={10} strokeWidth={3} />
                                        已完成
                                    </span>
                                )}
                            </div>
                            <span className="text-xs font-medium text-surface-500 mt-1 opacity-80 leading-snug">
                                {planDescription || "暂无详细描述"}
                            </span>
                        </div>
                    </div>

                    {/* 右侧交互提示 */}
                    <div className="flex items-center gap-1">
                        <span className="text-[11px] font-black text-primary-600 opacity-0 translate-x-4 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:translate-x-0">
                            查看详情
                        </span>
                        <div className="w-8 h-8 flex items-center justify-center rounded-full text-primary-600 transition-all duration-500 group-hover:bg-primary-500 group-hover:text-surface group-hover:rotate-[-45deg]">
                            <ChevronRight size={18} strokeWidth={3} />
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. 详情弹出层 (内部处理 Skeleton) */}
            <Dialog
                header={
                    <div className="flex flex-col gap-0.5">
                        <span className="tracking-tight font-black text-surface-900 text-lg">学员执行情况</span>
                    </div>
                }
                visible={detailVisible}
                onHide={() => setDetailVisible(false)}
                style={{ width: '95vw', maxWidth: '600px' }}
                className="aero-dialog"
                pt={{
                    root: { className: 'rounded-[24px] border-none shadow-2xl bg-surface overflow-hidden' },
                    header: { className: 'p-6 pb-2 border-none' },
                    content: { className: 'p-6 pt-0' }
                }}
                blockScroll
            >
                <div className="pt-2 pb-6">
                    {loading ? (
                        <div className="space-y-6">
                            <Skeleton height="110px" className="rounded-[24px] bg-surface-50/50" />
                            <div className="space-y-3">
                                <Skeleton width="40%" height="1.5rem" className="rounded-full" />
                                <Skeleton height="120px" className="rounded-[20px]" />
                            </div>
                        </div>
                    ) : instance ? (
                        <div className="space-y-8">
                            {/* 1. 计划概览 - 数值中心化布局 */}
                            <div className="bg-surface-50/40 rounded-[24px] p-6 border border-surface-100/50">
                                <p className="text-sm text-surface-500 font-medium leading-relaxed mb-6 italic opacity-80">
                                    “ {instance.description || '暂无详细计划描述'} ”
                                </p>
                                <div className="flex items-center justify-around relative">
                                    {/* 极简纵向分割线 */}
                                    <div className="absolute left-1/2 -translate-x-1/2 h-8 w-[1px] bg-surface-200/40" />

                                    <div className="text-center">
                                        <div className="text-[10px] font-black text-surface-400 tracking-widest mb-1">总计天数</div>
                                        <div className="text-2xl font-black text-surface-900 tracking-tighter">
                                            {trainingDays.length}
                                            <span className="text-[10px] font-bold text-surface-300 ml-1">天</span>
                                        </div>
                                    </div>

                                    <div className="text-center">
                                        <div className="text-[10px] font-black text-surface-400 tracking-widest mb-1">已执行</div>
                                        <div className="text-2xl font-black text-primary-600 tracking-tighter">
                                            {Object.keys(executions).length}
                                            <span className="text-[10px] font-bold text-primary-300 ml-1">次</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. 训练排期清单 */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2 font-bold tracking-tight text-surface-900">
                                        <span>训练计划排期</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {trainingDays.map((day, idx) => {
                                        const isRest = day.type === 'rest';
                                        const dayExe = executions[day.dayIndex];

                                        return (
                                            <div
                                                key={idx}
                                                className={`rounded-[20px] transition-all duration-300 ${isRest
                                                    ? 'bg-surface-50/40'
                                                    : 'bg-surface border border-surface-100/60 shadow-sm hover:border-primary-100 hover:shadow-md'
                                                    }`}
                                            >
                                                {/* 卡片头部：使用色阶和图标区分状态 */}
                                                <div className="px-5 py-4 flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform duration-500 ${isRest ? 'bg-blue-50 text-blue-500' : 'bg-primary-50 text-primary-500'
                                                            }`}>
                                                            {isRest ? <Moon size={16} /> : <Bolt size={16} strokeWidth={2.5} />}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-surface-900 tracking-tight">第 {day.dayIndex} 天</span>
                                                            <span className={`text-[10px] font-bold uppercase ${isRest ? 'text-blue-400' : 'text-primary-400'}`}>
                                                                {isRest ? '休息' : '训练'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {dayExe && (
                                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 rounded-full border border-green-100/50">
                                                            <CheckCircle2 size={12} className="text-green-600" />
                                                            <span className="text-[10px] font-black text-green-700 tracking-tight">已完成</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 详细内容区：增加内边距呼吸感 */}
                                                {!isRest && (
                                                    <div className="px-5 pb-5 space-y-3">
                                                        <div className="space-y-2">
                                                            {day.actionSets?.map((as, i) => (
                                                                <div key={i} className="p-3 bg-surface-50/50 rounded-[14px] hover:bg-surface-50 transition-colors">
                                                                    <ActionItem
                                                                        actionSet={as}
                                                                        action={actions[(as as any).action_id || (as as any).actionId]}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {dayExe && (
                                                            <div className="mt-4 pt-4 border-t border-dashed border-surface-100/60">
                                                                <div className="text-[10px] font-black text-surface-300 tracking-widest mb-2">执行反馈详情</div>
                                                                <ExecutionDetailsSection execution={dayExe} />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-20 flex flex-col items-center justify-center opacity-40">
                            <History size={48} className="text-surface-300 mb-4 stroke-[1.5]" />
                            <p className="text-sm font-bold tracking-tight">未检测到有效计划数据</p>
                        </div>
                    )}
                </div>
            </Dialog>

            {/* 3. 视频 */}
            <Dialog visible={videoModalVisible} onHide={() => setVideoModalVisible(false)} style={{ width: '90vw', maxWidth: '450px' }} header="训练录像" modal>
                {currentVideoUrl && <video src={currentVideoUrl} controls autoPlay className="w-full rounded-lg bg-black" />}
            </Dialog>
        </>
    );
};

export default StudentPlanExecutionView;