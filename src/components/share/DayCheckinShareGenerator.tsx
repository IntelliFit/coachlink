'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useToastContext } from '@/context/ToastContext';

interface DayCheckinShareData {
    dateLabel: string;
    planName: string;
    nickname: string;
    avatarUrl?: string | null;
    completedAt?: string | null;
    dayIndex: number;
    moduleCount: number;
    completedModuleCount: number;
    lightweightCompletedCount: number;
    lightweightTotalCount: number;
    trainingCompleted: boolean;
    strengthTaskCount: number;
    strengthCompletedSetCount: number;
    strengthTotalSetCount: number;
}

interface DayCheckinShareGeneratorProps {
    visible: boolean;
    onHide: () => void;
    data: DayCheckinShareData | null;
}

const DayCheckinShareGenerator: React.FC<DayCheckinShareGeneratorProps> = ({
    visible,
    onHide,
    data,
}) => {
    const { showToast } = useToastContext();
    const cardRef = useRef<HTMLDivElement>(null);
    const [generating, setGenerating] = useState(false);
    const remainingModuleCount = Math.max(0, (data?.moduleCount || 0) - (data?.completedModuleCount || 0));

    const shareTitle = useMemo(() => {
        if (!data) return '今日整日打卡';
        return `Day ${data.dayIndex} · 今日整日打卡`;
    }, [data]);

    const completedAtLabel = useMemo(() => {
        const rawValue = data?.completedAt || new Date().toISOString();
        try {
            return format(new Date(rawValue), 'yyyy年MM月dd日 HH:mm', { locale: zhCN });
        } catch {
            return data?.dateLabel || '';
        }
    }, [data]);

    const handleDownload = async () => {
        if (!cardRef.current || !data) return;

        try {
            setGenerating(true);
            const canvas = await html2canvas(cardRef.current, {
                useCORS: true,
                scale: 2,
                backgroundColor: null,
            });

            const dataUrl = canvas.toDataURL('image/png');

            if (navigator.share && /mobile/i.test(navigator.userAgent)) {
                const blob = await (await fetch(dataUrl)).blob();
                const file = new File([blob], `CoachLink_Day_${data.dayIndex}.png`, { type: 'image/png' });
                await navigator.share({
                    files: [file],
                    title: shareTitle,
                    text: '这是我今天的整日打卡状态。',
                });
                return;
            }

            const link = document.createElement('a');
            link.download = `CoachLink_Day_${data.dayIndex}.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Failed to generate day share image:', error);
            showToast({
                severity: 'error',
                summary: '生成整日打卡图失败',
                detail: '请稍后重试或直接截图分享',
            });
        } finally {
            setGenerating(false);
        }
    };

    return (
        <Dialog
            visible={visible}
            onHide={onHide}
            header="分享整日打卡"
            style={{ width: '95vw', maxWidth: '500px' }}
            modal
            breakpoints={{ '960px': '75vw', '641px': '95vw' }}
        >
            {!data ? (
                <div className="py-12 text-center text-surface-500">暂无可分享的数据</div>
            ) : (
                <div className="flex flex-col gap-6">
                    <div className="bg-surface-100 rounded-2xl p-4 flex justify-center overflow-hidden">
                        <div ref={cardRef} className="w-[350px] overflow-hidden rounded-[28px] border border-surface-100 bg-white shadow-2xl">
                            <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-500 to-surface-900 px-6 pb-8 pt-6 text-white">
                                <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
                                <div className="absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-black/15 blur-2xl" />

                                <div className="relative flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/70">
                                            DAILY CHECK-IN
                                        </div>
                                        <div className="mt-2 text-3xl font-black tracking-tight">
                                            Day {data.dayIndex}
                                        </div>
                                        <div className="mt-1 text-sm text-white/80">
                                            {data.dateLabel}
                                        </div>
                                    </div>
                                    <div className="h-14 w-14 overflow-hidden rounded-2xl border border-white/20 bg-white/10">
                                        {data.avatarUrl ? (
                                            <img
                                                src={data.avatarUrl}
                                                alt={data.nickname}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-xl font-black text-white/80">
                                                {data.nickname.charAt(0) || 'C'}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="relative mt-6 rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                                    <div className="text-xs font-semibold text-white/75">今日整日安排</div>
                                    <div className="mt-2 text-2xl font-black leading-tight">
                                        {data.completedModuleCount}/{data.moduleCount} 模块已完成
                                    </div>
                                    <div className="mt-2 text-sm text-white/80">
                                        {data.completedModuleCount >= data.moduleCount
                                            ? '今天的安排已经全部收尾，这是一张完整打卡快照。'
                                            : data.completedModuleCount > 0
                                                ? `今天已经完成 ${data.completedModuleCount} 个模块，还有 ${remainingModuleCount} 个模块待继续。`
                                                : '今天的安排还没收尾，但已经可以先记录此刻的完成状态。'}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 px-6 py-6">
                                <div>
                                    <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-surface-400">
                                        Plan
                                    </div>
                                    <div className="mt-2 text-lg font-black tracking-tight text-surface-900">
                                        {data.planName || '今日安排'}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-3xl border border-surface-100 bg-surface-50 px-4 py-4">
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-surface-500">训练模块</div>
                                        <div className="mt-2 text-lg font-black text-surface-900">
                                            {data.trainingCompleted ? '已完成' : (data.strengthTaskCount > 0 ? '未完成' : '今日无训练')}
                                        </div>
                                        <div className="mt-1 text-xs text-surface-500">
                                            {data.strengthTaskCount > 0
                                                ? `${data.strengthCompletedSetCount}/${data.strengthTotalSetCount} 组`
                                                : '以轻量任务为主'}
                                        </div>
                                    </div>
                                    <div className="rounded-3xl border border-green-100 bg-green-50 px-4 py-4">
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-green-700">轻量任务</div>
                                        <div className="mt-2 text-lg font-black text-green-800">
                                            {data.lightweightCompletedCount}/{data.lightweightTotalCount}
                                        </div>
                                        <div className="mt-1 text-xs text-green-700/80">
                                            饮食 / 有氧 / 习惯
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-3xl border border-primary-100 bg-primary-50 px-4 py-4">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-primary-700">今日结论</div>
                                    <div className="mt-2 text-base font-black text-primary-900">
                                        {data.completedModuleCount >= data.moduleCount
                                            ? '今天不仅练到了，也把整天安排都推进完了。'
                                            : data.completedModuleCount > 0
                                                ? '今天已经推进了一部分计划，进度本身也值得记录。'
                                                : '就算今天还没完全展开，整日状态也可以先留下一张记录。'}
                                    </div>
                                    <div className="mt-2 text-xs text-primary-800/80">
                                        状态时间 · {completedAtLabel}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between border-t border-surface-100 pt-4">
                                    <div>
                                        <div className="text-xs font-black italic tracking-tight text-surface-900">COACHLINK</div>
                                        <div className="mt-1 text-[11px] text-surface-500">
                                            今日整日打卡
                                        </div>
                                    </div>
                                    <div className="rounded-2xl bg-surface-900 px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white">
                                        {data.completedModuleCount >= data.moduleCount ? 'ALL DONE' : 'DAY STATUS'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Button
                        label={generating ? '生成中...' : '保存图片'}
                        icon={generating
                            ? <ProgressSpinner style={{ width: '18px', height: '18px' }} />
                            : <Download className="w-4 h-4 mr-2" />}
                        className="w-full py-4 font-bold rounded-2xl"
                        onClick={handleDownload}
                        disabled={generating}
                    />
                </div>
            )}
        </Dialog>
    );
};

export default DayCheckinShareGenerator;
