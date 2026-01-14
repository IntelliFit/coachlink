'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { ProgressBar } from 'primereact/progressbar';
import { Skeleton } from 'primereact/skeleton';
import { InputNumber } from 'primereact/inputnumber';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dialog } from 'primereact/dialog';
import { ArrowLeft, Play, Video, Check, Star, ChevronUp, ChevronDown, Timer, Upload } from 'lucide-react';
import { executionService } from '@/app/service/executionService';
import { planLibService } from '@/app/service/planLibService';
import { useToastContext } from '@/context/ToastContext';
import ShareCardGenerator from '@/components/share/ShareCardGenerator';

interface SetData {
    set_number: number;
    status: 'pending' | 'completed' | 'skipped';
    planned_reps?: string;
    planned_weight?: string;
    actual_weight?: number;
    actual_reps?: number;
    rpe?: number;
    notes?: string;
    has_video?: boolean;
    video_url?: string;
    is_pr?: boolean;
    // Auto e1RM fields
    e1rm?: number;
    is_auto_pr?: boolean;
    // Polymorphic fields
    actual_distance?: number; // meters
    actual_duration?: number; // seconds
    diet_content?: string;
    calories?: number;
}

interface ActionExecution {
    action_id: string;
    action_name: string;
    action_order: number;
    sets: SetData[];
    total_sets: number;
    completed_sets: number;
}

function TrainingExecutionContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session } = useSession();
    const { showToast } = useToastContext();

    const instanceId = params.instanceId as string;
    const dayIndex = parseInt(searchParams.get('dayIndex') || '1');

    const [loading, setLoading] = useState(true);
    const [execution, setExecution] = useState<any>(null);
    const [actions, setActions] = useState<Record<string, any>>({});
    const [expandedAction, setExpandedAction] = useState<number>(0);
    const [currentSetIndex, setCurrentSetIndex] = useState(0);
    const [showOptionalFields, setShowOptionalFields] = useState(false);
    const [expandedSetKey, setExpandedSetKey] = useState<string | null>(null); // 用于已完成组“展开详情”
     const [completing, setCompleting] = useState(false);
    const [restTimer, setRestTimer] = useState(0);
    const [isResting, setIsResting] = useState(false);
    const [sessionNotes, setSessionNotes] = useState('');

    // Form state for current set
    const [weight, setWeight] = useState<number | null>(null);
    const [reps, setReps] = useState<number | null>(null);
    const [rpe, setRpe] = useState<number | null>(null);
    const [setNotes, setSetNotes] = useState('');
    const [markAsPR, setMarkAsPR] = useState(false);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    
    // Video modal state
    const [videoModalVisible, setVideoModalVisible] = useState(false);
    const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

    // Share modal state
    const [shareModalVisible, setShareModalVisible] = useState(false);

    // Polymorphic Item State
    const [dietContent, setDietContent] = useState('');
    const [dietCalories, setDietCalories] = useState<number | null>(null);
    const [cardioDistance, setCardioDistance] = useState<number | null>(null); // km
    const [cardioDuration, setCardioDuration] = useState<number | null>(null); // minutes
    const [editingSetKey, setEditingSetKey] = useState<string | null>(null);

    useEffect(() => {
        if (session?.user?.id && instanceId) {
            startTraining();
        }
    }, [session?.user?.id, instanceId]);

    // Rest timer effect
    useEffect(() => {
        if (isResting && restTimer > 0) {
            const interval = setInterval(() => {
                setRestTimer(prev => {
                    if (prev <= 1) {
                        setIsResting(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [isResting, restTimer]);

    // 预填充推荐值：当切换到新组时自动填入教练计划的重量和次数
    useEffect(() => {
        if (!execution) return;
        const actionExecutions = execution.action_executions || [];
        const currentAction = actionExecutions[expandedAction];
        if (!currentAction) return;
        
        const currentSet = currentAction.sets[currentSetIndex];
        if (currentSet && currentSet.status === 'pending') {
            // 解析 planned_weight (去掉 "kg" 后缀)
            const weightStr = String(currentSet.planned_weight || '');
            
            console.log('预填充调试:', {
                planned_weight: currentSet.planned_weight,
                planned_reps: currentSet.planned_reps,
                weightStr
            });
            
            // 只有当包含 "kg" 时才预填充重量（避免把 RM 值填进去）
            // 注意：支持负数（辅助重量），例如 "-10kg"
            if (weightStr.includes('kg') && weight === null) {
                const match = weightStr.match(/-?\d+(\.\d+)?/);
                const numericWeight = match ? parseFloat(match[0]) : NaN;
                if (Number.isFinite(numericWeight) && numericWeight !== 0) {
                    setWeight(numericWeight);
                }
            }
            
            // 预填充次数
            const repsStr = String(currentSet.planned_reps || '0');
            const plannedReps = parseInt(repsStr.replace(/[^0-9]/g, ''));
            if (plannedReps > 0 && reps === null) {
                setReps(plannedReps);
            }
        }
    }, [expandedAction, currentSetIndex, execution]);

    const isWeightRequiredForSet = (setData: SetData) => {
        // 如果计划里是 “xxkg”/数字重量，重量是必填；如果是 “RM/%” 这类强度描述，允许先不填重量（更贴合手机端快打卡）
        const planned = String(setData.planned_weight || '').toLowerCase();
        if (!planned) return true;
        if (planned.includes('kg')) return true;
        // 纯数字（例如 "100"）也当作重量必填
        const numeric = parseFloat(planned.replace(/[^0-9.]/g, ''));
        if (Number.isFinite(numeric) && numeric > 0 && planned.replace(/[^0-9.]/g, '').length > 0) return true;
        // 其他情况（RM / %1RM / RPE 等）先不强制
        return false;
    };

    const setKeyOf = (actionIndex: number, setIndex: number) => `${actionIndex}:${setIndex}`;

    const startTraining = async () => {
        try {
            setLoading(true);
            
            // Get plan instance for action details
            const instanceRes = await planLibService.getInstance({ id: instanceId });
            if (instanceRes?.actions) {
                setActions(instanceRes.actions);
            }

            // Start or resume execution
            const res = await executionService.startExecution({
                instanceId,
                dayIndex
            });

            if (res.success && res.data) {
                setExecution(res.data);
                
                // Find first incomplete set
                const actionExecutions = res.data.action_executions || [];
                for (let i = 0; i < actionExecutions.length; i++) {
                    const action = actionExecutions[i];
                    const pendingSetIndex = action.sets.findIndex((s: SetData) => s.status === 'pending');
                    if (pendingSetIndex !== -1) {
                        setExpandedAction(i);
                        setCurrentSetIndex(pendingSetIndex);
                        break;
                    }
                }
            } else {
                showToast({
                    severity: 'error',
                    summary: '加载失败',
                    detail: res.message || '无法开始训练'
                });
            }
        } catch (error) {
            console.error('Start training failed:', error);
            showToast({
                severity: 'error',
                summary: '错误',
                detail: '开始训练失败'
            });
        } finally {
            setLoading(false);
        }
    };

    const canPlayInlineVideo = (url?: string | null) => {
        if (!url) return false;
        if (url.startsWith("blob:")) return true;

        const lower = url.toLowerCase();
        // 常见可被 <video> 直接播放的直链扩展名
        if (
            lower.endsWith(".mp4") ||
            lower.endsWith(".webm") ||
            lower.endsWith(".mov") ||
            lower.endsWith(".m4v") ||
            lower.endsWith(".ogg") ||
            lower.includes(".mp4?") ||
            lower.includes(".webm?") ||
            lower.includes(".mov?") ||
            lower.includes(".m4v?") ||
            lower.includes(".ogg?")
        ) {
            return true;
        }

        // Supabase Storage public / signed URL 一般可直接播放
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (
            (supabaseUrl && url.includes(supabaseUrl)) ||
            url.includes("/storage/v1/object/")
        ) {
            return true;
        }

        return false;
    };

    const openVideo = (url?: string | null) => {
        if (!url) return;

        if (canPlayInlineVideo(url)) {
            setCurrentVideoUrl(url);
            setVideoModalVisible(true);
            return;
        }

        // 外站页面链接（B站/抖音/YouTube 等）无法用 <video> 播放：直接跳转
        showToast({
            severity: "info",
            summary: "外部视频链接",
            detail: "该链接无法在页面内播放，已为你打开新窗口观看",
        });
        window.open(url, "_blank");
    };

    const handleCompleteSet = async (actionIndex: number, setIndex: number) => {
        if (!execution) return;

        try {
            const actionExecution = execution.action_executions[actionIndex];
            const setData = actionExecution.sets[setIndex];
            const isEditing = setData.status === 'completed';

            // 1. Upload video first if selected (so API can retrieve video_url)
            let uploadedVideoUrl: string | undefined;
            let uploadedVideoId: string | undefined;
            let hasVideo = false;
            if (videoFile) {
                try {
                    setUploading(true);
                    const uploadRes = await executionService.uploadSetVideo(
                        videoFile,
                        execution.id,
                        actionExecution.action_id,
                        setIndex + 1
                    );
                    if (uploadRes?.success && uploadRes?.data?.video_url) {
                        uploadedVideoUrl = uploadRes.data.video_url;
                        uploadedVideoId = uploadRes.data.id;
                        hasVideo = true;
                    } else {
                        const msg = uploadRes?.message || '视频上传失败';
                        showToast({
                            severity: 'warn',
                            summary: '视频上传失败',
                            detail: msg,
                        });
                    }
                } catch (err) {
                    console.error('Video upload failed:', err);
                    showToast({
                        severity: 'warn',
                        summary: '视频上传失败',
                        detail: '视频上传失败，但组数据仍会保存'
                    });
                } finally {
                    setUploading(false);
                }
            }

            // 2. Complete set via API (with is_pr, has_video, actionId for persistence)
            const res = await executionService.completeSet({
                executionId: execution.id,
                actionIndex,
                setIndex,
                actionId: actionExecution.action_id,
                actualWeight: weight || undefined,
                actualReps: reps || undefined,
                rpe: rpe || undefined,
                notes: setNotes || undefined,
                is_pr: markAsPR,
                has_video: hasVideo
            });

            if (res.success) {
                // Check for auto-detected PR (e1RM system)
                if (res.data?.autoE1RM?.isPR) {
                    const e1rm = res.data.autoE1RM.e1rm;
                    const previousPR = res.data.autoE1RM.previousPR;
                    const improvement = previousPR ? (e1rm - previousPR).toFixed(1) : null;
                    
                    showToast({
                        severity: 'success',
                        summary: '🎉 新纪录！',
                        detail: improvement 
                            ? `${actionExecution.action_name} e1RM: ${e1rm}kg (+${improvement}kg)`
                            : `${actionExecution.action_name} e1RM: ${e1rm}kg`,
                        life: 4000
                    });
                }

                // 3. Create PR record if marked (manual marking)
                if (markAsPR && weight && reps) {
                    await executionService.createPR({
                        executionId: execution.id,
                        actionId: actionExecution.action_id,
                        actionName: actionExecution.action_name,
                        setNumber: setIndex + 1,
                        weight,
                        reps,
                        rpe: rpe || undefined,
                        notes: setNotes || undefined,
                        videoId: uploadedVideoId
                    });
                }

                // 4. Update local state
                const updatedExecution = { ...execution };
                updatedExecution.action_executions[actionIndex].sets[setIndex] = {
                    ...setData,
                    status: 'completed',
                    actual_weight: weight,
                    actual_reps: reps,
                    rpe,
                    notes: setNotes,
                    is_pr: markAsPR,
                    has_video: hasVideo,
                    video_url: uploadedVideoUrl,
                    // Add e1RM info
                    e1rm: res.data?.autoE1RM?.e1rm,
                    is_auto_pr: res.data?.autoE1RM?.isPR
                };
            // Recalculate completion counts (editing should not "++" counts)
            updatedExecution.action_executions[actionIndex].completed_sets =
                updatedExecution.action_executions[actionIndex].sets.filter((s: any) => s.status === 'completed').length;
            updatedExecution.completed_sets = res.data?.completedSets ?? updatedExecution.action_executions.reduce(
                (sum: number, ae: any) => sum + (ae.completed_sets || 0),
                0
            );
                setExecution(updatedExecution);

                // Reset form
                setWeight(null);
                setReps(null);
                setRpe(null);
                setSetNotes('');
                setMarkAsPR(false);
                setVideoFile(null);
                setShowOptionalFields(false);
            setEditingSetKey(null);
            // Keep details expanded for edited set so user can confirm changes
            setExpandedSetKey(setKeyOf(actionIndex, setIndex));

            // Editing a completed set should not trigger rest timer or auto-advance
            if (!isEditing) {
                // Start rest timer if configured
                const restSeconds = setData.planned_rest_seconds || 90;
                if (restSeconds > 0) {
                    setRestTimer(restSeconds);
                    setIsResting(true);
                }
            }

            if (!isEditing) {
                // Move to next set
                const nextSetIndex = setIndex + 1;
                if (nextSetIndex < actionExecution.sets.length) {
                    setCurrentSetIndex(nextSetIndex);
                } else {
                    // Check for next action
                    const nextActionIndex = actionIndex + 1;
                    if (nextActionIndex < execution.action_executions.length) {
                        setExpandedAction(nextActionIndex);
                        setCurrentSetIndex(0);
                        setShowOptionalFields(false);
                        showToast({
                            severity: 'success',
                            summary: '动作完成',
                            detail: `${actionExecution.action_name} 已完成！进入下一个动作`
                        });
                    }
                }
            }
            }
        } catch (error) {
            console.error('Complete set failed:', error);
            showToast({
                severity: 'error',
                summary: '错误',
                detail: '保存失败'
            });
        }
    };

    const handleCompleteItem = async (actionIndex: number) => {
        if (!execution) return;

        try {
            const actionExecution = execution.action_executions[actionIndex];
            const action = actions[actionExecution.action_id];
            
            // Determine type
            const itemType = action?.type || 'STRENGTH';
            
            // Call API
            const res = await executionService.completeItem({
                executionId: execution.id,
                actionIndex,
                itemType: itemType as any,
                completed: true,
                actualContent: itemType === 'DIET' ? dietContent : undefined,
                actualDistance: itemType === 'CARDIO' && cardioDistance ? cardioDistance * 1000 : undefined, // to meters
                actualDuration: itemType === 'CARDIO' && cardioDuration ? cardioDuration * 60 : undefined, // to seconds
                notes: sessionNotes // Reuse session notes or add specific field if needed
            });

            if (res.success) {
                // Update local state
                const updatedExecution = { ...execution };
                const setData = updatedExecution.action_executions[actionIndex].sets[0];
                
                // Update the single set to completed
                updatedExecution.action_executions[actionIndex].sets[0] = {
                    ...setData,
                    status: 'completed',
                    diet_content: dietContent,
                    actual_distance: itemType === 'CARDIO' && cardioDistance ? cardioDistance * 1000 : undefined,
                    actual_duration: itemType === 'CARDIO' && cardioDuration ? cardioDuration * 60 : undefined,
                };
                
                updatedExecution.action_executions[actionIndex].completed_sets = 1;
                updatedExecution.completed_sets = res.data?.completedSets || execution.completed_sets + 1;
                setExecution(updatedExecution);

                // Reset forms
                setDietContent('');
                setDietCalories(null);
                setCardioDistance(null);
                setCardioDuration(null);

                showToast({
                    severity: 'success',
                    summary: '完成',
                    detail: `${action?.name || '项目'} 已完成`
                });

                // Move to next action
                const nextActionIndex = actionIndex + 1;
                if (nextActionIndex < execution.action_executions.length) {
                    setExpandedAction(nextActionIndex);
                } else {
                     showToast({
                        severity: 'success',
                        summary: '训练完成',
                        detail: '所有项目已完成！'
                    });
                }
            }
        } catch (error) {
            console.error('Complete item failed:', error);
            showToast({
                severity: 'error',
                summary: '错误',
                detail: '保存失败'
            });
        }
    };

    const handleFinishTraining = async () => {
        if (!execution) return;

        try {
            const res = await executionService.finishTraining({
                executionId: execution.id,
                sessionNotes: sessionNotes || undefined
            });

            if (res.success) {
                showToast({
                    severity: 'success',
                    summary: '训练完成',
                    detail: `完成 ${res.data?.completed_sets}/${res.data?.total_sets} 组`
                });
                // Instead of immediate redirect, show share card
                setShareModalVisible(true);
            }
        } catch (error) {
            console.error('Finish training failed:', error);
        }
    };

    const handleSkipRest = () => {
        setRestTimer(0);
        setIsResting(false);
    };

    const handleAddTime = (seconds: number) => {
        setRestTimer(prev => prev + seconds);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-50 p-4">
                <Skeleton height="60px" className="mb-4" />
                <Skeleton height="200px" className="mb-4" />
                <Skeleton height="300px" />
            </div>
        );
    }

    if (!session?.user?.id) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface-50">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2 text-surface-900">未登录</h2>
                    <p className="text-surface-500">请先登录</p>
                </div>
            </div>
        );
    }

    if (!execution) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface-50">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2 text-surface-900">加载失败</h2>
                    <Button label="返回" onClick={() => router.back()} />
                </div>
            </div>
        );
    }

    const actionExecutions = execution.action_executions || [];
    const progress = execution.total_sets > 0 
        ? Math.round((execution.completed_sets / execution.total_sets) * 100) 
        : 0;

    return (
        <div className="min-h-screen bg-surface-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 sticky top-0 z-10">
                <div className="flex items-center justify-between mb-3">
                    <button onClick={() => router.back()} className="p-2 hover:bg-white/20 rounded-lg">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-lg font-bold text-white">训练执行</h1>
                    <div className="text-sm text-white/90">
                        {execution.completed_sets}/{execution.total_sets} 组
                    </div>
                </div>
                <ProgressBar value={progress} showValue={false} style={{ height: '8px' }} />
            </div>

            {/* Rest Timer Overlay */}
            {isResting && (
                <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center">
                    <Timer className="w-16 h-16 text-blue-400 mb-4 animate-pulse" />
                    <div className="text-6xl font-bold mb-4 text-white">
                        {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, '0')}
                    </div>
                    <p className="text-white/70 mb-6">组间休息</p>
                    <div className="flex gap-4">
                        <Button 
                            label="+30s" 
                            outlined 
                            onClick={() => handleAddTime(30)} 
                        />
                        <Button 
                            label="跳过休息" 
                            severity="secondary"
                            onClick={handleSkipRest} 
                        />
                    </div>
                </div>
            )}

            {/* Actions List */}
            <div className="p-4 space-y-4">
                {actionExecutions.map((actionExec: ActionExecution, actionIndex: number) => {
                    const action = actions[actionExec.action_id];
                    const demoVideoUrl = action?.url || action?.video_url;
                    const isExpanded = expandedAction === actionIndex;
                    const isCompleted = actionExec.completed_sets === actionExec.total_sets;

                    return (
                        <Card 
                            key={actionIndex}
                            className={`${isCompleted ? 'opacity-60' : ''} rounded-2xl`}
                        >
                            {/* Action Header */}
                            <div 
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => setExpandedAction(isExpanded ? -1 : actionIndex)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                                        isCompleted ? 'bg-green-500' : 'bg-orange-500'
                                    }`}>
                                        {isCompleted ? <Check className="w-5 h-5" /> : actionExec.action_order}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-surface-900">{action?.name || actionExec.action_name}</h3>
                                        <p className="text-sm text-surface-500">
                                            {actionExec.completed_sets}/{actionExec.total_sets} 组完成
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!isExpanded && demoVideoUrl && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openVideo(demoVideoUrl);
                                            }}
                                            className="p-2 hover:bg-surface-100 rounded-lg"
                                            title="查看动作演示视频"
                                        >
                                            <Video className="w-5 h-5 text-primary" />
                                        </button>
                                    )}
                                    {isExpanded ? <ChevronUp /> : <ChevronDown />}
                                </div>
                            </div>

                            {/* Sets or Item Content */}
                            {isExpanded && (
                                <div className="mt-4 space-y-4">
                                    {(action?.detail || demoVideoUrl) && (
                                        <div className="border border-surface-200 rounded-xl bg-surface-50 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="text-xs font-bold uppercase tracking-widest text-surface-400">
                                                        动作要点
                                                    </div>
                                                    {action?.detail ? (
                                                        <div className="mt-2 text-sm text-surface-700 whitespace-pre-wrap">
                                                            {action.detail}
                                                        </div>
                                                    ) : (
                                                        <div className="mt-2 text-sm text-surface-500">
                                                            暂无动作备注
                                                        </div>
                                                    )}
                                                </div>

                                                {demoVideoUrl && (
                                                    <Button
                                                        type="button"
                                                        icon="pi pi-video"
                                                        label="演示视频"
                                                        className="p-button-outlined rounded-xl shrink-0"
                                                        onClick={() => {
                                                            openVideo(demoVideoUrl);
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {(!action?.type || action.type === 'STRENGTH') ? (
                                        // 力量训练：显示组列表
                                        actionExec.sets.map((setData: SetData, setIndex: number) => {
                                            const isCurrentSet = setIndex === currentSetIndex && actionIndex === expandedAction;
                                            const isSetCompleted = setData.status === 'completed';
                                            const isSelectedSet = actionIndex === expandedAction && setIndex === currentSetIndex;
                                            const key = setKeyOf(actionIndex, setIndex);
                                            const isDetailsExpanded = expandedSetKey === key;
                                            const isEditingThisSet = editingSetKey === key;
                                            const showSetForm = isCurrentSet && (!isSetCompleted || isEditingThisSet);
                                            const allowNegativeWeight = !!(action?.includesBodyWeight ?? (action as any)?.includes_body_weight);
                                            const plannedText = `${setData.planned_weight || '-'} × ${setData.planned_reps || '-'}次`;
                                            const actualText = `${setData.actual_weight ?? '-'}kg · ${setData.actual_reps ?? '-'}次`;

                                            return (
                                                <div 
                                                    key={setIndex}
                                                    className={`border rounded-2xl ${
                                                        isSetCompleted 
                                                            ? 'border-green-500/40 bg-green-500/5'
                                                            : isCurrentSet
                                                            ? 'border-purple-500 bg-purple-500/5'
                                                            : 'border-surface-200 bg-surface'
                                                    }`}
                                                >
                                                    {/* 组标题行：默认紧凑；点击可切换/展开 */}
                                                                    <button 
                                                        type="button"
                                                                        onClick={() => {
                                                            // 未完成组：点击直接切换为当前编辑组
                                                            if (!isSetCompleted) {
                                                                setExpandedAction(actionIndex);
                                                                setCurrentSetIndex(setIndex);
                                                                setShowOptionalFields(false);
                                                                return;
                                                            }
                                                            // 已完成组：点击展开/收起详情
                                                            setExpandedSetKey(prev => (prev === key ? null : key));
                                                                        }}
                                                        className="w-full px-4 py-3 flex items-center justify-between gap-3"
                                                    >
                                                        <div className="min-w-0 text-left">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-sm font-black tracking-tight ${isSelectedSet ? 'text-purple-700' : 'text-surface-900'}`}>
                                                                    第 {setData.set_number} 组
                                                                </span>
                                                                {setData.is_pr && (
                                                                    <span className="inline-flex items-center gap-1 text-amber-500 text-xs font-bold">
                                                                        <Star className="w-3.5 h-3.5" /> PR
                                                                    </span>
                                                                )}
                                                                {setData.is_auto_pr && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-[10px] rounded-full font-bold">
                                                                        🏆 新纪录
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="mt-1 text-xs text-surface-500 truncate">
                                                                {/* 当前组展开时避免重复展示计划重量：页面里已有输入框预填 */} 
                                                                {!isSetCompleted && isCurrentSet ? (
                                                                    <span className="font-medium text-surface-500">正在填写…</span>
                                                                ) : (
                                                                    <span className="font-bold text-surface-600">📋 {plannedText}</span>
                                                                )}
                                                                {isSetCompleted && <span className="ml-2">✅ {actualText}</span>}
                                                                {!isSetCompleted && !isSelectedSet && <span className="ml-2">点击开始填写</span>}
                                                            </div>
                                                            </div>

                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {setData.has_video && (
                                                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                                                                    有视频
                                                                </span>
                                                            )}
                                                            <ChevronDown className={`w-5 h-5 text-surface-400 transition-transform ${isSetCompleted && isDetailsExpanded ? 'rotate-180' : ''}`} />
                                                            </div>
                                                    </button>

                                                    {/* 当前组才展示完整表单（减少单组占屏面积） */}
                                                    {showSetForm && (
                                                        <div className="px-4 pb-4">
                                                            {/* 只展示：重量 / 次数 / RPE + 进步组勾选（其余折叠） */}
                                                            {/* iPhone 14 Pro Max 等较宽机型：避免 RPE 被挤到下一行，强制 4 列同排 */}
                                                            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_72px_72px_52px] items-end gap-2">
                                                                <div className="min-w-0">
                                                                    <label className="text-xs text-surface-600 font-bold">
                                                                        {allowNegativeWeight ? '外加重量(kg)' : '重量(kg)'}
                                                                    </label>
                                                                    <InputNumber 
                                                                        value={weight}
                                                                        onValueChange={(e) => setWeight(e.value ?? null)}
                                                                        min={allowNegativeWeight ? -300 : 0}
                                                                        max={500}
                                                                        className="w-full"
                                                                        inputClassName="w-full text-center font-bold"
                                                                        placeholder={
                                                                            allowNegativeWeight
                                                                                ? (isWeightRequiredForSet(setData) ? '必填，可填负数=辅助' : '可选，可填负数=辅助')
                                                                                : (isWeightRequiredForSet(setData) ? '必填' : '可选')
                                                                        }
                                                                    />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <label className="text-xs text-surface-600 font-bold">次数</label>
                                                                    <InputNumber 
                                                                        value={reps}
                                                                        onValueChange={(e) => setReps(e.value ?? null)}
                                                                        className="w-full"
                                                                        inputClassName="w-full text-center font-bold"
                                                                    />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <label className="text-xs text-surface-600 font-bold">RPE</label>
                                                                    <InputNumber 
                                                                        value={rpe}
                                                                        onValueChange={(e) => setRpe(e.value ?? null)}
                                                                        min={1}
                                                                        max={10}
                                                                        className="w-full"
                                                                        inputClassName="w-full text-center font-bold"
                                                                    />
                                                                </div>

                                                                {/* 大方框：勾选即完成（替代大按钮） */}
                                                                <button
                                                                    type="button"
                                                                    className="flex flex-col items-center gap-1 select-none w-[52px]"
                                                                    onClick={async () => {
                                                                        if (completing || uploading) return;

                                                                        if (!reps) {
                                                                            showToast({
                                                                                severity: 'warn',
                                                                                summary: '还差一步',
                                                                                detail: '请先填写次数',
                                                                            });
                                                                            return;
                                                                        }
                                                                        if (isWeightRequiredForSet(setData) && !weight) {
                                                                            showToast({
                                                                                severity: 'warn',
                                                                                summary: '还差一步',
                                                                                detail: '请先填写重量',
                                                                            });
                                                                            return;
                                                                        }

                                                                        try {
                                                                            setCompleting(true);
                                                                            await handleCompleteSet(actionIndex, setIndex);
                                                                        } finally {
                                                                            setCompleting(false);
                                                                        }
                                                                    }}
                                                                    aria-label={isEditingThisSet ? "保存本组" : "完成本组"}
                                                                >
                                                                    <span className="text-[11px] font-bold text-surface-500">{isEditingThisSet ? '保存' : '完成'}</span>
                                                                    <div
                                                                        className={`
                                                                            w-12 h-12 rounded-xl border-2 flex items-center justify-center
                                                                            transition-all active:scale-[0.98]
                                                                            ${completing || uploading ? 'bg-surface-50 border-surface-200 text-surface-300' : 'bg-surface border-surface-300 text-surface-400 hover:border-emerald-400 hover:text-emerald-600'}
                                                                        `}
                                                                        title={isEditingThisSet ? "保存本组修改" : "勾选完成本组"}
                                                                    >
                                                                        <Check className={`w-6 h-6 ${completing || uploading ? 'opacity-40' : ''}`} />
                                                                    </div>
                                                                </button>
                                                            </div>

                                                            <label className="mt-3 flex items-center gap-2 cursor-pointer select-none">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={markAsPR}
                                                                    onChange={(e) => setMarkAsPR(e.target.checked)}
                                                                    className="w-4 h-4"
                                                                />
                                                                <Star className="w-4 h-4 text-yellow-400" />
                                                                <span className="text-sm text-surface-700 font-medium">标记为进步组</span>
                                                            </label>

                                                            {/* 次要字段折叠：备注/视频 */}
                                                            <div className="mt-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowOptionalFields(v => !v)}
                                                                    className="w-full flex items-center justify-between px-3 py-2 rounded-2xl bg-surface-50 border border-surface-200 text-surface-700 font-medium"
                                                                >
                                                                    <span className="text-sm">备注 / 视频（可选）</span>
                                                                    <ChevronDown className={`w-5 h-5 text-surface-400 transition-transform ${showOptionalFields ? 'rotate-180' : ''}`} />
                                                                </button>

                                                                {showOptionalFields && (
                                                                    <div className="mt-3 space-y-3">
                                                            <InputTextarea 
                                                                value={setNotes}
                                                                onChange={(e) => setSetNotes(e.target.value)}
                                                                placeholder="添加备注（可选）"
                                                                rows={2}
                                                                className="w-full"
                                                            />

                                                            <div className="flex items-center gap-4 flex-wrap">
                                                                <input
                                                                    type="file"
                                                                    ref={fileInputRef}
                                                                    accept="video/*"
                                                                    onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                                                                    className="hidden"
                                                                />
                                                                <Button 
                                                                    icon={<Upload className="w-4 h-4" />}
                                                                                label={videoFile ? "已选择视频" : "选择视频"}
                                                                    outlined
                                                                    size="small"
                                                                    onClick={() => fileInputRef.current?.click()}
                                                                    severity={videoFile ? "success" : "secondary"}
                                                                />
                                                                {videoFile && (
                                                                    <button 
                                                                                    type="button"
                                                                        onClick={() => setVideoFile(null)}
                                                                        className="text-xs text-red-400 hover:text-red-300"
                                                                    >
                                                                        删除
                                                                    </button>
                                                                )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* 完成动作由右侧大方框触发：不再展示大按钮 */}
                                                        </div>
                                                    )}

                                                    {/* 已完成组的详情区域（可折叠） */}
                                                    {isSetCompleted && isDetailsExpanded && (
                                                        <div className="px-4 pb-4 pt-1 space-y-3">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <button
                                                                    type="button"
                                                                    className="px-3 py-2 rounded-xl bg-surface-50 border border-surface-200 text-surface-700 text-sm font-medium hover:bg-surface-100"
                                                                    onClick={() => {
                                                                        // Enter edit mode for this set (even if whole day is completed)
                                                                        setExpandedAction(actionIndex);
                                                                        setCurrentSetIndex(setIndex);
                                                                        setExpandedSetKey(key);
                                                                        setEditingSetKey(key);
                                                                        setWeight(setData.actual_weight ?? null);
                                                                        setReps(setData.actual_reps ?? null);
                                                                        setRpe(setData.rpe ?? null);
                                                                        setSetNotes(setData.notes ?? '');
                                                                        setMarkAsPR(!!setData.is_pr);
                                                                        setVideoFile(null);
                                                                        setShowOptionalFields(true);
                                                                    }}
                                                                >
                                                                    编辑本组
                                                                </button>
                                                                {isEditingThisSet && (
                                                                    <button
                                                                        type="button"
                                                                        className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium hover:bg-red-100"
                                                                        onClick={() => {
                                                                            setEditingSetKey(null);
                                                                            setWeight(null);
                                                                            setReps(null);
                                                                            setRpe(null);
                                                                            setSetNotes('');
                                                                            setMarkAsPR(false);
                                                                            setVideoFile(null);
                                                                            setShowOptionalFields(false);
                                                                        }}
                                                                    >
                                                                        取消编辑
                                                                    </button>
                                                                )}
                                                            </div>

                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                                <div>
                                                                    <label className="text-xs text-surface-500">重量(kg)</label>
                                                                    <div className="bg-green-50 border border-green-200 rounded-xl p-2 text-green-700 font-medium">
                                                                        {setData.actual_weight ?? '-'}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="text-xs text-surface-500">次数</label>
                                                                    <div className="bg-green-50 border border-green-200 rounded-xl p-2 text-green-700 font-medium">
                                                                        {setData.actual_reps ?? '-'}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="text-xs text-surface-500">RPE</label>
                                                                    <div className="bg-green-50 border border-green-200 rounded-xl p-2 text-green-700 font-medium">
                                                                        {setData.rpe ?? '-'}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {setData.notes && (
                                                                <div className="bg-surface-50 border border-surface-200 rounded-xl p-2 text-sm text-surface-700">
                                                                    📝 {setData.notes}
                                                                </div>
                                                            )}

                                                            <div className="flex items-center gap-3 flex-wrap">
                                                                {setData.has_video && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (setData.video_url) {
                                                                                openVideo(setData.video_url);
                                                                            } else {
                                                                                showToast({
                                                                                    severity: 'info',
                                                                                    summary: '视频查看',
                                                                                    detail: '视频链接不可用，请刷新页面'
                                                                                });
                                                                            }
                                                                        }}
                                                                        className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm hover:bg-blue-100"
                                                                    >
                                                                        <Video className="w-4 h-4" /> 查看视频
                                                                    </button>
                                                                )}
                                                                {setData.e1rm && (
                                                                    <span className="text-surface-500 text-xs">
                                                                        e1RM: {setData.e1rm}kg
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        // 非力量训练 (饮食/有氧/习惯)
                                        <div className="border rounded-lg p-4 border-purple-500 bg-purple-500/10">
                                            {actionExec.completed_sets > 0 ? (
                                                // 已完成状态
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <span className="text-green-600 font-medium">✓ 已打卡完成</span>
                                                        <div className="mt-2 text-sm text-surface-600">
                                                            {actionExec.sets[0]?.diet_content && <div>内容: {actionExec.sets[0].diet_content}</div>}
                                                            {actionExec.sets[0]?.actual_distance && <div>距离: {actionExec.sets[0].actual_distance / 1000} km</div>}
                                                            {actionExec.sets[0]?.actual_duration && <div>时长: {actionExec.sets[0].actual_duration / 60} 分钟</div>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                // 未完成 - 填写表单
                                                <div className="space-y-4">
                                                    <h3 className="font-bold text-surface-900 border-b pb-2">
                                                        {action.type === 'DIET' ? '🍽️ 饮食打卡' : action.type === 'CARDIO' ? '🏃 有氧打卡' : '✅ 习惯打卡'}
                                                    </h3>
                                                    
                                                    {/* Plan Detail Reminder */}
                                                    {action?.item_schema && (
                                                        <div className="bg-surface-100 p-3 rounded text-sm text-surface-600">
                                                             {action.type === 'DIET' && <div>建议: {action.item_schema.calories} kcal</div>}
                                                             {action.type === 'CARDIO' && (
                                                                 <div>目标: {(action.item_schema.distance / 1000).toFixed(1)} km / {(action.item_schema.duration / 60).toFixed(0)} 分钟</div>
                                                             )}
                                                             {action.type === 'HABIT' && <div>说明: {action.detail}</div>}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Diet Form */}
                                                    {action.type === 'DIET' && (
                                                        <div className="space-y-3">
                                                            <label className="text-sm font-medium">记录内容 (可选)</label>
                                                            <InputTextarea 
                                                                value={dietContent}
                                                                onChange={(e) => setDietContent(e.target.value)}
                                                                rows={3}
                                                                placeholder="吃了什么？(例如: 鸡胸肉, 西兰花...)"
                                                                className="w-full"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Cardio Form */}
                                                    {action.type === 'CARDIO' && (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="text-sm font-medium">距离 (km)</label>
                                                                <InputNumber 
                                                                    value={cardioDistance}
                                                                    onValueChange={(e) => setCardioDistance(e.value ?? null)}
                                                                    min={0}
                                                                    max={100}
                                                                    minFractionDigits={1}
                                                                    placeholder="0.0"
                                                                    className="w-full"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-sm font-medium">时长 (分钟)</label>
                                                                <InputNumber 
                                                                    value={cardioDuration}
                                                                    onValueChange={(e) => setCardioDuration(e.value ?? null)}
                                                                    min={0}
                                                                    max={300}
                                                                    placeholder="0"
                                                                    className="w-full"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Submit Button */}
                                                    <Button 
                                                        label="完成打卡"
                                                        icon="pi pi-check"
                                                        onClick={() => handleCompleteItem(actionIndex)}
                                                        className="w-full"
                                                        severity="success"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>

            {/* Finish Section */}
            {/* Finish Section */}
            <div className="p-4 border-t border-surface-200 bg-white">
                {execution?.status === 'completed' ? (
                    <>
                        <div className="text-center mb-4 text-green-600 font-medium flex items-center justify-center gap-2">
                            <Check className="w-5 h-5" />
                            <span>本训练日已完成</span>
                        </div>
                        <Button 
                            label="分享训练成果"
                            icon="pi pi-share-alt"
                            onClick={() => setShareModalVisible(true)}
                            className="w-full"
                            severity="info"
                            size="large"
                        />
                    </>
                ) : (
                    <>
                        <InputTextarea 
                            value={sessionNotes}
                            onChange={(e) => setSessionNotes(e.target.value)}
                            placeholder="训练备注（可选）"
                            rows={2}
                            className="w-full mb-4"
                        />
                        <Button 
                            label="完成训练"
                            onClick={handleFinishTraining}
                            className="w-full"
                            severity="success"
                            size="large"
                        />
                    </>
                )}
            </div>

        {/* Video Modal */}
        <Dialog
            visible={videoModalVisible}
            onHide={() => {
                setVideoModalVisible(false);
                setCurrentVideoUrl(null);
            }}
            header="查看视频"
            style={{ width: '90vw', maxWidth: '800px' }}
            modal
            dismissableMask
        >
            {currentVideoUrl && (
                <div className="flex justify-center">
                    <video 
                        src={currentVideoUrl}
                        controls
                        autoPlay
                        className="w-full max-h-[70vh] rounded-lg"
                        style={{ backgroundColor: '#000' }}
                    >
                        您的浏览器不支持视频播放
                    </video>
                </div>
            )}
        </Dialog>

        {/* Share Card Modal */}
        <ShareCardGenerator 
            visible={shareModalVisible}
            onHide={() => {
                setShareModalVisible(false);
                router.push('/today-training');
            }}
            executionId={execution.id}
        />
    </div>
);
}

export default function TrainingExecutionPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <Skeleton width="4rem" height="4rem" shape="circle" />
            </div>
        }>
            <TrainingExecutionContent />
        </Suspense>
    );
}
