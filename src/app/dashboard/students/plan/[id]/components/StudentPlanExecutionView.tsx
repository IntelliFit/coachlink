'use client';

import React, { useState, useEffect } from 'react';
import { Button } from 'primereact/button';
import { Badge } from 'primereact/badge';
import { Dialog } from 'primereact/dialog';
import { Skeleton } from 'primereact/skeleton';
import { ClipboardList, ChevronRight, Bolt, Moon, CheckCircle2, History, Dumbbell, Coffee } from 'lucide-react';
import { planLibService } from '@/app/service/planLibService';
import { CoachPlanInstanceRow, CoachActionRow } from '@/types';
import { CoachPlanAction } from '@/app/api/plan-lib/create-template/entity';
import { Divider } from 'primereact/divider';
import ExecutionDetails from '@/app/dashboard/plan-lib/components/ExecutionDetails';

interface StudentPlanExecutionViewProps {
    subscriptionId: string;
    // 新增：直接接收数据
    instance: CoachPlanInstanceRow | null;
    executions: Record<number, any>;
    actionsMap?: Record<string, any>;
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
    actionsMap = {},
    loading = false,
    planName = '学员执行情况',
    planDescription = '查看详细执行记录',
    isCompleted = false
}) => {

    const [detailVisible, setDetailVisible] = useState(false);

    const completedExecutionsCount = Object.values(executions || {}).filter(
        (e: any) => e?.status === 'completed',
    ).length;

    const ActionItem = ({ actionSet }: { actionSet: CoachPlanAction }) => {
        const actionId = (actionSet as any).actionId || (actionSet as any).action_id;
        // 优先从 actionsMap（后端返回的动作库映射）获取动作名称
        const actionName =
            (actionId && actionsMap?.[actionId]?.name) ||
            (actionSet as any).actionName ||
            (actionSet as any).action_name ||
            (actionSet as any).name ||
            (actionSet as any).title ||
            // setName 是“组名”，不应作为动作名展示，但兜底时可显示
            (actionSet as any).setName ||
            (actionSet as any).set_name ||
            '未知动作';
        // 获取参数
        const params = (actionSet as any).params || {};
        const sets = params['组数'] ?? params.sets ?? (actionSet as any).sets ?? null;
        const repsRaw = params['次数'] ?? params.reps ?? (actionSet as any).reps ?? null;
        const durationSeconds = params['持续时间'] ?? (actionSet as any).durationSeconds ?? null;
        const reps = (() => {
            if (repsRaw === null || repsRaw === undefined || repsRaw === '') return null;
            const n = Number(repsRaw);
            return Number.isFinite(n) ? n : null;
        })();
        const note = params.note ?? (actionSet as any).note ?? '';

        // 计划侧“重量”常见来源：load（推荐/固定重量），其次才是历史字段
        const weightValue =
            params.load ??
            params['重量'] ??
            params.weight ??
            params['目标重量'] ??
            params.targetWeight ??
            (actionSet as any).weight;
        const weightUnit = params.loadUnit || params.unit || 'kg';

        const restTime =
            // ActionSetForm 里用的是 '休息时间'，单位：秒
            params['休息时间'] ??
            params['组间休息'] ??
            params.restTime ??
            params.rest_seconds ??
            params.restSeconds ??
            (actionSet as any).rest_seconds;
        
        // 格式化休息时间显示（计划侧通常以 0.5 分钟步进输入，但存为秒）
        const formatRestTime = (seconds: number | undefined) => {
            if (!seconds || typeof seconds !== 'number' || seconds <= 0) return null;
            const minutes = Math.round((seconds / 60) * 10) / 10; // 1位小数
            const text = String(minutes).endsWith('.0') ? String(minutes).slice(0, -2) : String(minutes);
            return `${text}分钟`;
        };
        
        return (
            <div className="flex items-center justify-between gap-3 py-2 px-3 bg-surface-50 rounded-xl border border-surface-100 mb-2">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* 组数×次数 */}
                    <div className="flex items-center gap-1 text-surface-500 text-xs font-medium flex-shrink-0">
                        <i className="pi pi-th-large text-[10px]" />
                        <span title={note || undefined}>
                            {typeof sets === 'number' ? `${sets}组` : '-'}
                            {typeof durationSeconds === 'number'
                                ? `×${durationSeconds}秒`
                                : `×${typeof reps === 'number' ? `${reps}次` : '自选'}`}
                        </span>
                    </div>
                    {/* 重量 */}
                    {typeof weightValue === 'number' && weightValue > 0 && (
                        <div className="flex items-center gap-1 text-amber-600 text-xs font-bold flex-shrink-0">
                            <i className="pi pi-bolt text-[10px]" />
                            <span>{Number(weightValue).toFixed(1).replace(/\.0$/, '')}{weightUnit}</span>
                        </div>
                    )}
                    {/* 休息时间 */}
                    {restTime && (
                        <div className="flex items-center gap-1 text-surface-400 text-xs flex-shrink-0">
                            <i className="pi pi-clock text-[10px]" />
                            <span>休息{formatRestTime(restTime)}</span>
                        </div>
                    )}
                </div>
                {/* 动作名称 */}
                <div className="flex items-center gap-1.5 text-surface-700 font-semibold text-sm truncate">
                    <i className="pi pi-circle text-[6px] text-primary-400" />
                    <span className="truncate">{actionName}</span>
                </div>
            </div>
        );
    };

    const rawDays = (instance?.training_days as unknown as any[] | undefined) || [];
    const trainingDays = (rawDays as TrainingDay[])
        .map((d: any) => ({
            ...d,
            dayIndex: d.dayIndex ?? d.day_index,
        }))
        .filter((d: any) => typeof d.dayIndex === 'number')
        .sort((a: any, b: any) => a.dayIndex - b.dayIndex);

    return (
        <>
            {/* 1. 外部展示卡片 (Aero 风格版) */}
            <div
                className="group relative bg-surface rounded-[24px] p-5 cursor-pointer transition-all duration-500 ease-out border border-surface-200/70 hover:bg-surface hover:border-primary-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] active:scale-[0.98] mb-6"
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
                                    学员执行情况
                                </span>
                                {isCompleted && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-black uppercase tracking-tight rounded-full border border-green-100/50">
                                        <CheckCircle2 size={10} strokeWidth={3} />
                                        已完成
                                    </span>
                                )}
                            </div>
                            <span className="text-xs font-medium text-surface-500 mt-1 opacity-80 leading-snug">
                                {completedExecutionsCount > 0
                                    ? `已完成 ${completedExecutionsCount} 次训练`
                                    : '查看训练计划与执行记录'}
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
                                            {isCompleted ? 0 : completedExecutionsCount}
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
                                        // 如果计划已完成，不显示执行状态
                                        const dayExe = isCompleted ? null : executions[day.dayIndex];
                                        const isDayCompleted = !!dayExe && dayExe.status === 'completed';

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
                                                            {isRest ? <Coffee size={16} /> : <Dumbbell size={16} strokeWidth={2.5} />}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-surface-900 tracking-tight">第 {day.dayIndex} 天</span>
                                                            <span className={`text-[10px] font-bold uppercase ${isRest ? 'text-blue-400' : 'text-primary-400'}`}>
                                                                {isRest ? '休息' : '训练'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {isDayCompleted && (
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
                                                            {day.actionSets?.map((as: any, i: number) => {
                                                                if (!as) return null;
                                                                // one-filter 类型：展示其 actions 列表
                                                                if (as.type === 'one-filter' && Array.isArray(as.actions)) {
                                                                    return (
                                                                        <div key={i} className="space-y-2">
                                                                            {as.actions.map((sub: any, j: number) => (
                                                                                <ActionItem key={`${i}-${j}`} actionSet={sub} />
                                                                            ))}
                                                                        </div>
                                                                    );
                                                                }
                                                                return <ActionItem key={i} actionSet={as} />;
                                                            })}
                                                        </div>

                                                        {isDayCompleted && (
                                                            <div className="mt-4 pt-4 border-t border-dashed border-surface-100/60">
                                                                <div className="text-[10px] font-black text-surface-300 tracking-widest mb-2">执行反馈详情</div>
                                                                <ExecutionDetails execution={dayExe} collapsed={true} />
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
        </>
    );
};

export default StudentPlanExecutionView;