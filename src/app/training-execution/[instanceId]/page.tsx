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
            if (weightStr.includes('kg') && weight === null) {
                const numericWeight = parseFloat(weightStr.replace(/[^0-9.]/g, ''));
                if (numericWeight > 0) {
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

    const handleCompleteSet = async (actionIndex: number, setIndex: number) => {
        if (!execution) return;

        try {
            const actionExecution = execution.action_executions[actionIndex];
            const setData = actionExecution.sets[setIndex];

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
                    if (uploadRes?.data?.video_url) {
                        uploadedVideoUrl = uploadRes.data.video_url;
                        uploadedVideoId = uploadRes.data.id;
                        hasVideo = true;
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
                // 3. Create PR record if marked
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
                    video_url: uploadedVideoUrl
                };
                updatedExecution.action_executions[actionIndex].completed_sets++;
                updatedExecution.completed_sets = res.data?.completedSets || execution.completed_sets + 1;
                setExecution(updatedExecution);

                // Reset form
                setWeight(null);
                setReps(null);
                setRpe(null);
                setSetNotes('');
                setMarkAsPR(false);
                setVideoFile(null);

                // Start rest timer if configured
                const restSeconds = setData.planned_rest_seconds || 90;
                if (restSeconds > 0) {
                    setRestTimer(restSeconds);
                    setIsResting(true);
                }

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
                        showToast({
                            severity: 'success',
                            summary: '动作完成',
                            detail: `${actionExecution.action_name} 已完成！进入下一个动作`
                        });
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
                router.push('/today-training');
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
                    <h1 className="text-lg font-bold">训练执行</h1>
                    <div className="text-sm">
                        {execution.completed_sets}/{execution.total_sets} 组
                    </div>
                </div>
                <ProgressBar value={progress} showValue={false} style={{ height: '8px' }} />
            </div>

            {/* Rest Timer Overlay */}
            {isResting && (
                <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center">
                    <Timer className="w-16 h-16 text-blue-400 mb-4 animate-pulse" />
                    <div className="text-6xl font-bold mb-4">
                        {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, '0')}
                    </div>
                    <p className="text-gray-400 mb-6">组间休息</p>
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
                    const isExpanded = expandedAction === actionIndex;
                    const isCompleted = actionExec.completed_sets === actionExec.total_sets;

                    return (
                        <Card 
                            key={actionIndex}
                            className={`${isCompleted ? 'opacity-60' : ''}`}
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
                                    {action?.url && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                window.open(action.url, '_blank');
                                            }}
                                            className="p-2 hover:bg-gray-700 rounded-lg"
                                        >
                                            <Video className="w-5 h-5 text-blue-400" />
                                        </button>
                                    )}
                                    {isExpanded ? <ChevronUp /> : <ChevronDown />}
                                </div>
                            </div>

                            {/* Sets */}
                            {isExpanded && (
                                <div className="mt-4 space-y-4">
                                    {actionExec.sets.map((setData: SetData, setIndex: number) => {
                                        const isCurrentSet = setIndex === currentSetIndex && actionIndex === expandedAction;
                                        const isSetCompleted = setData.status === 'completed';

                                        return (
                                            <div 
                                                key={setIndex}
                                                className={`border rounded-lg p-4 ${
                                                    isSetCompleted 
                                                        ? 'border-green-500/50 bg-green-500/10' 
                                                        : isCurrentSet
                                                        ? 'border-purple-500 bg-purple-500/10'
                                                        : 'border-gray-700'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="font-bold">第 {setData.set_number} 组</span>
                                                    {setData.is_pr && (
                                                        <span className="flex items-center gap-1 text-yellow-400 text-sm">
                                                            <Star className="w-4 h-4" /> PR
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Planned values - 更醒目的显示 */}
                                                <div className="bg-orange-500/20 border border-orange-500/40 rounded-lg p-3 mb-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-orange-600 text-xs font-medium">📋 教练计划</span>
                                                    </div>
                                                    <div className="text-surface-900 text-lg font-bold">
                                                        {setData.planned_weight || '-'} × {setData.planned_reps || '-'}次
                                                    </div>
                                                </div>

                                                {isSetCompleted ? (
                                                    // Completed display - same layout as input form but readonly
                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-3 gap-3">
                                                            <div>
                                                                <label className="text-xs text-surface-500">重量(kg)</label>
                                                                <div className="bg-green-50 border border-green-200 rounded p-2 text-green-700 font-medium">
                                                                    {setData.actual_weight || '-'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-surface-500">次数</label>
                                                                <div className="bg-green-50 border border-green-200 rounded p-2 text-green-700 font-medium">
                                                                    {setData.actual_reps || '-'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-surface-500">RPE</label>
                                                                <div className="bg-green-50 border border-green-200 rounded p-2 text-green-700 font-medium">
                                                                    {setData.rpe || '-'}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {setData.notes && (
                                                            <div className="bg-surface-100 rounded p-2 text-sm text-surface-600">
                                                                📝 {setData.notes}
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-4 flex-wrap">
                                                            {setData.has_video && (
                                                                <button 
                                                                    onClick={() => {
                                                                        if (setData.video_url) {
                                                                            setCurrentVideoUrl(setData.video_url);
                                                                            setVideoModalVisible(true);
                                                                        } else {
                                                                            showToast({
                                                                                severity: 'info',
                                                                                summary: '视频查看',
                                                                                detail: '视频链接不可用，请刷新页面'
                                                                            });
                                                                        }
                                                                    }}
                                                                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded text-sm hover:bg-blue-500/30"
                                                                >
                                                                    <Video className="w-4 h-4" /> 查看视频
                                                                </button>
                                                            )}
                                                            {setData.is_pr && (
                                                                <span className="flex items-center gap-1 text-yellow-400 text-sm">
                                                                    <Star className="w-4 h-4" /> 进步组
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="text-green-400 text-sm font-medium">
                                                            ✓ 已完成
                                                        </div>
                                                    </div>
                                                ) : isCurrentSet ? (
                                                    // Input form
                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-3 gap-3">
                                                            <div>
                                                                <label className="text-xs text-surface-600 font-medium">重量(kg)</label>
                                                                <InputNumber 
                                                                    value={weight}
                                                                    onValueChange={(e) => setWeight(e.value ?? null)}
                                                                    className="w-full"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-surface-600 font-medium">次数</label>
                                                                <InputNumber 
                                                                    value={reps}
                                                                    onValueChange={(e) => setReps(e.value ?? null)}
                                                                    className="w-full"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-surface-600 font-medium">RPE</label>
                                                                <InputNumber 
                                                                    value={rpe}
                                                                    onValueChange={(e) => setRpe(e.value ?? null)}
                                                                    min={1}
                                                                    max={10}
                                                                    className="w-full"
                                                                />
                                                            </div>
                                                        </div>

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
                                                                label={videoFile ? videoFile.name.slice(0, 15) + '...' : "选择视频"}
                                                                outlined
                                                                size="small"
                                                                onClick={() => fileInputRef.current?.click()}
                                                                severity={videoFile ? "success" : "secondary"}
                                                            />
                                                            {videoFile && (
                                                                <button 
                                                                    onClick={() => setVideoFile(null)}
                                                                    className="text-xs text-red-400 hover:text-red-300"
                                                                >
                                                                    删除
                                                                </button>
                                                            )}
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input 
                                                                    type="checkbox"
                                                                    checked={markAsPR}
                                                                    onChange={(e) => setMarkAsPR(e.target.checked)}
                                                                    className="w-4 h-4"
                                                                />
                                                                <Star className="w-4 h-4 text-yellow-400" />
                                                                <span className="text-sm">标记为进步组</span>
                                                            </label>
                                                        </div>

                                                        <Button 
                                                            label="✓ 完成本组"
                                                            onClick={() => handleCompleteSet(actionIndex, setIndex)}
                                                            className="w-full"
                                                            severity="success"
                                                            disabled={!weight || !reps}
                                                        />
                                                    </div>
                                                ) : (
                                                    // Pending display
                                                    <div className="text-gray-500">待完成</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>

            {/* Finish Section */}
            <div className="p-4 border-t border-surface-200 bg-white">
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
