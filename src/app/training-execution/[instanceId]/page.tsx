'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { ProgressBar } from 'primereact/progressbar';
import { Skeleton } from 'primereact/skeleton';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputText } from 'primereact/inputtext';
import { Dialog } from 'primereact/dialog';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { ArrowLeft, Play, Video, Check, Star, ChevronUp, ChevronDown, Timer, Upload, Plus, Trash2 } from 'lucide-react';
import { executionService } from '@/app/service/executionService';
import { impromptuTrainingService } from '@/app/service/impromptuTrainingService';
import { planLibService } from '@/app/service/planLibService';
import { videoService } from '@/app/service/videoService';
import { studentActionLibService } from '@/app/service/studentActionLibService';
import { useToastContext } from '@/context/ToastContext';
import ShareCardGenerator from '@/components/share/ShareCardGenerator';
import { AeroInputNumber } from '@/components/AeroInputNumber';
import { useAnalytics } from '@/hooks/useAnalytics';
import ActionPicker from '@/app/today-training/ActionPicker';
import ExecutionPlanNoticeDialog from '@/components/plan/ExecutionPlanNoticeDialog';
import {
    hasReadExecutionPlanNotice,
    markExecutionPlanNoticeRead,
} from '@/lib/executionPlanNotice';
import { isOneRMEligibleAction } from '@/lib/oneRmEligibility';
import { normalizePlannedRestSeconds } from '@/lib/restTime';

interface SetData {
    set_number: number;
    status: 'pending' | 'completed' | 'skipped';
    source?: string; // 'student_extra' = 学员自行添加
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
    source?: string; // 'student_extra' = 学员自行添加
    sets: SetData[];
    total_sets: number;
    completed_sets: number;
}

/** 可折叠的"动作要点"面板，默认收起，节省手机屏幕空间 */
function ActionDetailPanel({
    detail,
    demoVideoUrl,
    onOpenVideo,
}: {
    detail?: string | null;
    demoVideoUrl?: string | null;
    onOpenVideo: (url: string) => void;
}) {
    const [expanded, setExpanded] = React.useState(false);

    return (
        <div className="rounded-xl border border-surface-200 bg-surface-50 overflow-hidden">
            <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 text-left gap-2"
                onClick={() => setExpanded(v => !v)}
            >
                <span className="text-xs font-bold uppercase tracking-widest text-surface-500">
                    动作要点
                </span>
                <div className="flex items-center gap-2 shrink-0">
                    {demoVideoUrl && !expanded && (
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded-lg border border-primary-200"
                            onClick={(e) => { e.stopPropagation(); onOpenVideo(demoVideoUrl); }}
                        >
                            <Play className="w-3.5 h-3.5" />
                            演示
                        </button>
                    )}
                    <ChevronDown className={`w-4 h-4 text-surface-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-surface-200">
                    {detail ? (
                        <p className="mt-3 text-sm text-surface-700 whitespace-pre-wrap leading-relaxed">
                            {detail}
                        </p>
                    ) : (
                        <p className="mt-3 text-sm text-surface-500">暂无动作备注</p>
                    )}
                    {demoVideoUrl && (
                        <Button
                            type="button"
                            icon="pi pi-video"
                            label="演示视频"
                            className="p-button-outlined rounded-xl"
                            onClick={() => onOpenVideo(demoVideoUrl)}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

function TrainingExecutionContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, update: updateSession } = useSession();
    const { showToast } = useToastContext();
    const { trackEvent } = useAnalytics();
    const calibrationToastShownRef = useRef(false);
    const underPlanToastShownRef = useRef(false);
    const focusHandledRef = useRef(false);
    const startTrainingRequestedRef = useRef(false);

    const instanceId = params.instanceId as string;
    const dayIndex = parseInt(searchParams.get('dayIndex') || '1');
    const impromptuId = searchParams.get('impromptuId');
    const focusActionQuery = searchParams.get('focusAction');
    const focusActionIndex = focusActionQuery !== null ? Number(focusActionQuery) : NaN;
    const isImpromptuMode = !!impromptuId;
    const extraContentApiBase = isImpromptuMode
        ? '/api/impromptu/extra-content'
        : '/api/execution/extra-content';

    const [loading, setLoading] = useState(true);
    const [execution, setExecution] = useState<any>(null);
    const [actions, setActions] = useState<Record<string, any>>({});
    const [planInstance, setPlanInstance] = useState<any>(null);
    const [planDescExpanded, setPlanDescExpanded] = useState(false);
    const [expandedAction, setExpandedAction] = useState<number>(0);
    const [currentSetIndex, setCurrentSetIndex] = useState(0);
    const [showOptionalFields, setShowOptionalFields] = useState(false);
    const [expandedSetKey, setExpandedSetKey] = useState<string | null>(null); // 用于已完成组“展开详情”
    const [completing, setCompleting] = useState(false);
    const [quickFinishLoading, setQuickFinishLoading] = useState(false);
    const [restTimer, setRestTimer] = useState(0);
    const [isResting, setIsResting] = useState(false);
    const [sessionNotes, setSessionNotes] = useState('');
    const restEndAtRef = useRef<number | null>(null);
    const restTimerStorageKey = `coachlink:rest-timer:${session?.user?.id || 'anonymous'}:${isImpromptuMode ? `impromptu:${impromptuId || instanceId}` : `plan:${instanceId}`}:day:${dayIndex}`;

    // Query-based focus: used by “去输入并校准”入口
    useEffect(() => {
        if (focusHandledRef.current) return;
        const focus = searchParams?.get('focus');
        if (focus === 'weight') {
            focusHandledRef.current = true;
            setTimeout(() => {
                const el = document.querySelector('#guide-weight-input') as HTMLElement | null;
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const parsePlannedWeightKg = (planned?: string | null): number | null => {
        const s = String(planned || '');
        if (!s.toLowerCase().includes('kg')) return null;
        const m = s.match(/-?\d+(\.\d+)?/);
        if (!m) return null;
        const n = Number(m[0]);
        return Number.isFinite(n) ? n : null;
    };

    const parsePlannedReps = (planned?: string | null): number | null => {
        const s = String(planned || '').trim();
        if (!s) return null;
        const m = s.match(/\d+/);
        if (!m) return null;
        const n = Number(m[0]);
        return Number.isFinite(n) ? n : null;
    };

    const getExecutionActionType = (actionExec: any) => {
        const rawType = String(
            actionExec?.item_type ||
            actions[actionExec?.action_id]?.type ||
            'STRENGTH',
        ).toUpperCase();
        return rawType === 'DIET' || rawType === 'CARDIO' || rawType === 'HABIT'
            ? rawType
            : 'STRENGTH';
    };

    const isStrengthAction = (actionExec: any) => getExecutionActionType(actionExec) === 'STRENGTH';

    const resolveFocusExecutionIndex = (actionExecutions: any[], rawFocusIndex: number) => {
        if (!Number.isInteger(rawFocusIndex) || rawFocusIndex < 0) return -1;
        if (actionExecutions[rawFocusIndex] && isStrengthAction(actionExecutions[rawFocusIndex])) {
            return rawFocusIndex;
        }
        return actionExecutions.findIndex((item) =>
            Number.isInteger(item?.source_action_index) &&
            Number(item.source_action_index) === rawFocusIndex &&
            isStrengthAction(item),
        );
    };

    const findNextStrengthActionIndex = (actionExecutions: any[], startIndex: number) => {
        for (let i = startIndex + 1; i < actionExecutions.length; i += 1) {
            if (isStrengthAction(actionExecutions[i])) {
                return i;
            }
        }
        return -1;
    };

    // 超时未结束提醒（in_progress 挂太久）
    const [staleReminderVisible, setStaleReminderVisible] = useState(false);
    const [staleHours, setStaleHours] = useState<number>(0);
    const [staleExecutionId, setStaleExecutionId] = useState<string | null>(null);
    const STALE_THRESHOLD_HOURS = 10; // 可按产品调整：10/24

    // Form state for current set
    const [weight, setWeight] = useState<number | null>(null);
    const [reps, setReps] = useState<number | null>(null);
    const [rpe, setRpe] = useState<number | null>(null);
    const [setNotes, setSetNotes] = useState('');
    const [markAsPR, setMarkAsPR] = useState(false);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [oneRMDialogVisible, setOneRMDialogVisible] = useState(false);
    const [oneRMSettingAction, setOneRMSettingAction] = useState<any | null>(null);
    const [oneRMSettingValue, setOneRMSettingValue] = useState<number | null>(null);
    const [oneRMSettingSaving, setOneRMSettingSaving] = useState(false);
    
    // Video modal state
    const [videoModalVisible, setVideoModalVisible] = useState(false);
    const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

    // Share modal state
    const [shareModalVisible, setShareModalVisible] = useState(false);

    // 训练反馈弹窗 state
    const [feedbackDialogVisible, setFeedbackDialogVisible] = useState(false);
    const [feedbackContent, setFeedbackContent] = useState('');
    const [feedbackDifficulty, setFeedbackDifficulty] = useState<number>(3);
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

    // Polymorphic Item State - 按动作索引管理，支持多个不同类型的动作
    const [itemStates, setItemStates] = useState<Record<number, {
        dietContent?: string;
        cardioDistance?: number | null;
        cardioDuration?: number | null;
    }>>({});
    const [editingSetKey, setEditingSetKey] = useState<string | null>(null);
    const [videoLink, setVideoLink] = useState<string>('');
    const [linkedVideo, setLinkedVideo] = useState<{ id: string; url: string } | null>(null);
    const [addingExtraSet, setAddingExtraSet] = useState(false);
    const [addingExtraAction, setAddingExtraAction] = useState(false);
    const [removingSet, setRemovingSet] = useState(false);
    const [removingAction, setRemovingAction] = useState(false);
    const [showActionPicker, setShowActionPicker] = useState(false);
    const [executionNoticeVisible, setExecutionNoticeVisible] = useState(false);
    const [executionNoticeStarting, setExecutionNoticeStarting] = useState(false);
    const [noticeReviewVisible, setNoticeReviewVisible] = useState(false);

    useEffect(() => {
        if (!session?.user?.id || !instanceId || startTrainingRequestedRef.current) return;

        let cancelled = false;

        const prepareExecution = async () => {
            if (!isImpromptuMode && !hasReadExecutionPlanNotice({
                instanceId,
                userId: session.user.id,
            })) {
                try {
                    const instanceRes = await planLibService.getInstance({ id: instanceId });
                    if (cancelled) return;
                    if (instanceRes?.instance) {
                        setPlanInstance(instanceRes.instance);
                    }
                    if (instanceRes?.actions) {
                        setActions(instanceRes.actions);
                    }
                } catch (error) {
                    console.warn('[training-execution] Failed to preload execution notice context:', error);
                }

                if (cancelled) return;
                setLoading(false);
                setExecutionNoticeVisible(true);
                return;
            }

            startTrainingRequestedRef.current = true;
            await startTraining();
        };

        void prepareExecution();

        return () => {
            cancelled = true;
        };
    }, [session?.user?.id, instanceId, impromptuId]);

    useEffect(() => {
        if (!execution || !Number.isInteger(focusActionIndex) || focusActionIndex < 0) return;
        const actionExecutions = execution.action_executions || [];
        const targetIndex = resolveFocusExecutionIndex(actionExecutions, focusActionIndex);
        if (targetIndex < 0) return;
        const frameId = window.requestAnimationFrame(() => {
            document
                .getElementById(`execution-action-${targetIndex}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        return () => window.cancelAnimationFrame(frameId);
    }, [execution, focusActionIndex]);

    const clearPersistedRestTimer = useCallback(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.removeItem(restTimerStorageKey);
    }, [restTimerStorageKey]);

    const persistRestTimer = useCallback((endAt: number | null, executionId?: string | null) => {
        if (typeof window === 'undefined') return;

        if (!endAt || endAt <= Date.now()) {
            window.localStorage.removeItem(restTimerStorageKey);
            return;
        }

        window.localStorage.setItem(restTimerStorageKey, JSON.stringify({
            endAt,
            executionId: executionId ?? execution?.id ?? null,
            savedAt: Date.now(),
        }));
    }, [execution?.id, restTimerStorageKey]);

    const readPersistedRestTimer = useCallback(() => {
        if (typeof window === 'undefined') return null;

        try {
            const raw = window.localStorage.getItem(restTimerStorageKey);
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed.endAt !== 'number') {
                window.localStorage.removeItem(restTimerStorageKey);
                return null;
            }

            return {
                endAt: parsed.endAt,
                executionId: typeof parsed.executionId === 'string' ? parsed.executionId : null,
            };
        } catch {
            window.localStorage.removeItem(restTimerStorageKey);
            return null;
        }
    }, [restTimerStorageKey]);

    const syncRestTimer = useCallback(() => {
        const restEndAt = restEndAtRef.current;
        if (!restEndAt) return;

        const rawRemainingSeconds = Math.max(0, Math.ceil((restEndAt - Date.now()) / 1000));
        const remainingSeconds = normalizePlannedRestSeconds(rawRemainingSeconds, 0);

        if (rawRemainingSeconds !== remainingSeconds) {
            const correctedEndAt = Date.now() + remainingSeconds * 1000;
            restEndAtRef.current = correctedEndAt;
            persistRestTimer(correctedEndAt);
        }

        setRestTimer(remainingSeconds);

        if (remainingSeconds <= 0) {
            restEndAtRef.current = null;
            setIsResting(false);
            clearPersistedRestTimer();
        }
    }, [clearPersistedRestTimer, persistRestTimer]);

    const beginRestTimer = useCallback((seconds: number) => {
        const normalizedSeconds = normalizePlannedRestSeconds(seconds, 0);
        if (normalizedSeconds <= 0) {
            restEndAtRef.current = null;
            setRestTimer(0);
            setIsResting(false);
            clearPersistedRestTimer();
            return;
        }

        const endAt = Date.now() + normalizedSeconds * 1000;
        restEndAtRef.current = endAt;
        setRestTimer(normalizedSeconds);
        setIsResting(true);
        persistRestTimer(endAt);
    }, [clearPersistedRestTimer, persistRestTimer]);

    useEffect(() => {
        if (!execution?.id) return;

        if (execution.status === 'completed' || execution.status === 'abandoned') {
            restEndAtRef.current = null;
            setRestTimer(0);
            setIsResting(false);
            clearPersistedRestTimer();
            return;
        }

        const persistedTimer = readPersistedRestTimer();
        if (!persistedTimer) return;

        if (persistedTimer.executionId && persistedTimer.executionId !== execution.id) {
            clearPersistedRestTimer();
            return;
        }

        if (persistedTimer.endAt <= Date.now()) {
            clearPersistedRestTimer();
            return;
        }

        restEndAtRef.current = persistedTimer.endAt;
        setIsResting(true);
        syncRestTimer();
    }, [clearPersistedRestTimer, execution?.id, execution?.status, readPersistedRestTimer, syncRestTimer]);

    // Rest timer effect
    useEffect(() => {
        if (!isResting) return;

        syncRestTimer();

        const interval = window.setInterval(syncRestTimer, 1000);
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                syncRestTimer();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', syncRestTimer);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', syncRestTimer);
        };
    }, [isResting, syncRestTimer]);

    // 当展开非力量训练类型的动作时，回填已完成的数据
    useEffect(() => {
        if (!execution || expandedAction === -1) return;
        const actionExecutions = execution.action_executions || [];
        const currentAction = actionExecutions[expandedAction];
        if (!currentAction) return;
        
        const action = actions[currentAction.action_id];
        const actionType = action?.type || 'STRENGTH';
        
        // 只处理非力量训练类型
        if (actionType !== 'STRENGTH' && currentAction.sets && currentAction.sets.length > 0) {
            const setData = currentAction.sets[0];
            // 如果已完成，回填数据
            if (setData.status === 'completed') {
                setItemStates(prev => ({
                    ...prev,
                    [expandedAction]: {
                        dietContent: setData.diet_content || '',
                        cardioDistance: setData.actual_distance ? setData.actual_distance / 1000 : null,
                        cardioDuration: setData.actual_duration ? setData.actual_duration / 60 : null,
                    }
                }));
            }
        }
    }, [expandedAction, execution, actions]);

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
            
            // 预填充重量：
            // 1) "80kg" / "-10kg" 等显式 kg
            // 2) 纯数字字符串（例如即兴训练保存的 "80"）
            // 不把 "5RM" / "80%" 这类相对强度当作重量
            if (weight === null) {
                const normalized = weightStr.trim().toLowerCase();
                const isPureNumber = /^-?\d+(\.\d+)?$/.test(normalized);
                if (normalized.includes('kg') || isPureNumber) {
                    const match = normalized.match(/-?\d+(\.\d+)?/);
                    const numericWeight = match ? parseFloat(match[0]) : NaN;
                    if (Number.isFinite(numericWeight)) {
                        setWeight(numericWeight);
                    }
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

    const isActionOneRMEligible = (action: any) => {
        return isOneRMEligibleAction({
            type: action?.type,
            attrs: action?.attrs,
            enableAutoWeightCompute: action?.enableAutoWeightCompute ?? action?.enable_auto_weight_compute,
        });
    };

    const shouldPromptOneRM = (action: any, setData: SetData) => {
        if (!planInstance?.coach_subscription_id) return false;
        if (!isActionOneRMEligible(action)) return false;
        const plannedWeightRaw = String(setData?.planned_weight || '').toLowerCase();
        const usesRelativeIntensity = plannedWeightRaw.includes('rm') || plannedWeightRaw.includes('%');
        const alreadyHasKgLoad = plannedWeightRaw.includes('kg');
        const hasReferenceOneRM = typeof action?.reference_1rm === 'number' &&
            Number.isFinite(action.reference_1rm) &&
            action.reference_1rm > 0;
        return usesRelativeIntensity && !alreadyHasKgLoad && !hasReferenceOneRM;
    };

    const handleSaveQuickOneRM = async () => {
        if (!oneRMSettingAction || oneRMSettingValue === null || oneRMSettingValue <= 0) {
            showToast({ severity: 'warn', summary: '请输入有效1RM', detail: '1RM 需大于 0' });
            return;
        }
        try {
            setOneRMSettingSaving(true);
            const searchRes = await studentActionLibService.listActions({
                search: oneRMSettingAction.name,
                page: 1,
                limit: 50,
            });
            const candidates = searchRes?.actions || [];
            const matched = candidates.find((a) =>
                oneRMSettingAction.canonical_action_id &&
                a.canonical_action_id &&
                a.canonical_action_id === oneRMSettingAction.canonical_action_id
            ) || candidates.find((a) => a.name === oneRMSettingAction.name);

            if (matched?.id) {
                await studentActionLibService.updateAction({
                    id: matched.id,
                    reference_1rm: oneRMSettingValue,
                } as any);
            } else {
                await studentActionLibService.addAction({
                    name: oneRMSettingAction.name,
                    detail: oneRMSettingAction.detail || null,
                    url: oneRMSettingAction.url || oneRMSettingAction.video_url || null,
                    positions: oneRMSettingAction.positions || ['全身'],
                    attrs: oneRMSettingAction.attrs || ['组数', '次数', '强度', '休息时间'],
                    type: oneRMSettingAction.type || 'STRENGTH',
                    enableAutoWeightCompute: !!(oneRMSettingAction.enableAutoWeightCompute ?? oneRMSettingAction.enable_auto_weight_compute),
                    includesBodyWeight: !!(oneRMSettingAction.includesBodyWeight ?? oneRMSettingAction.includes_body_weight),
                    canonical_action_id: oneRMSettingAction.canonical_action_id || null,
                    reference_1rm: oneRMSettingValue,
                } as any);
            }

            setActions((prev) => ({
                ...prev,
                [oneRMSettingAction.id]: {
                    ...prev[oneRMSettingAction.id],
                    reference_1rm: oneRMSettingValue,
                },
            }));

            showToast({
                severity: 'success',
                summary: '1RM 已保存',
                detail: `${oneRMSettingAction.name} 已更新全局参考1RM`,
            });
            setOneRMDialogVisible(false);
            await startTraining();
        } catch (error: any) {
            showToast({
                severity: 'error',
                summary: '保存失败',
                detail: error?.message || '无法保存动作1RM',
            });
        } finally {
            setOneRMSettingSaving(false);
        }
    };

    const setKeyOf = (actionIndex: number, setIndex: number) => `${actionIndex}:${setIndex}`;

    const selectAction = (nextActionIndex: number) => {
        if (nextActionIndex === -1) {
            setExpandedAction(-1);
            return;
        }
        if (nextActionIndex !== expandedAction) {
            // 关键保护：切换动作时必须重置输入状态，避免重量/次数串联到下一个动作
            const actionExecutions = execution?.action_executions || [];
            const nextAction = actionExecutions[nextActionIndex];
            const pendingIndex = nextAction?.sets?.findIndex(
                (setData: SetData) => setData.status === 'pending',
            );
            const nextSetIndex = pendingIndex !== undefined && pendingIndex !== -1 ? pendingIndex : 0;
            setCurrentSetIndex(nextSetIndex);
            setExpandedSetKey(null);
            setEditingSetKey(null);
            setWeight(null);
            setReps(null);
            setRpe(null);
            setSetNotes('');
            setMarkAsPR(false);
            setVideoFile(null);
            setLinkedVideo(null);
            setVideoLink('');
            setShowOptionalFields(false);
        }
        setExpandedAction(nextActionIndex);
    };

    const startTraining = async () => {
        try {
            setLoading(true);

            let res: any = null;
            if (isImpromptuMode && impromptuId) {
                const impromptuExecution = await impromptuTrainingService.get({
                    id: impromptuId,
                });
                res = impromptuExecution
                    ? { success: true, data: impromptuExecution, message: "ok" }
                    : { success: false, data: null, message: "无法加载即兴执行记录" };
                setPlanInstance({
                    id: "impromptu",
                    name: "即兴锻炼",
                    description: "即兴训练模式（可临时加组/加动作）",
                    source: "impromptu",
                });
            } else {
                // Get plan instance for action details
                const instanceRes = await planLibService.getInstance({ id: instanceId });
                if (instanceRes?.actions) {
                    setActions(instanceRes.actions);
                }
                if (instanceRes?.instance) {
                    setPlanInstance(instanceRes.instance);
                }

                // Start or resume execution
                res = await executionService.startExecution({
                    instanceId,
                    dayIndex,
                });
            }

            if (res.success && res.data) {
                setExecution(res.data);
                trackEvent('student_training_start', 'training', { 
                    planId: (res.data as any).plan_id, 
                    executionId: (res.data as any).id,
                    instanceId 
                });

                // 超时提醒：只要该训练日存在 in_progress 且 started_at 距今超过阈值，就弹出提醒
                try {
                    const exec = res.data as any;
                    if (exec?.status === 'in_progress' && exec?.started_at) {
                        const startedAtMs = new Date(exec.started_at).getTime();
                        const nowMs = Date.now();
                        const hours = Math.floor((nowMs - startedAtMs) / (1000 * 60 * 60));
                        const snoozeKey = `coachlink:stale-exec-snooze:${exec.id}`;
                        const snoozeUntil = Number(localStorage.getItem(snoozeKey) || 0);

                        if (Number.isFinite(hours) && hours >= STALE_THRESHOLD_HOURS && nowMs >= snoozeUntil) {
                            setStaleHours(hours);
                            setStaleExecutionId(exec.id);
                            setStaleReminderVisible(true);
                        }
                    }
                } catch {
                    // best-effort
                }
                
                // 即兴模式下为动作填充最小元信息，避免 UI 因缺少 actions map 退化
                if (isImpromptuMode) {
                    const actionMap: Record<string, any> = {};
                    (res.data.action_executions || []).forEach((item: any) => {
                        if (!item?.action_id) return;
                        actionMap[item.action_id] = {
                            id: item.action_id,
                            name: item.action_name || "动作",
                            type: String(item?.type || "STRENGTH").toUpperCase(),
                            attrs: ["组数", "次数", "强度", "休息时间"],
                        };
                    });
                    Object.values(actionMap).forEach((action: any) => {
                        const itemType = String(action?.type || "STRENGTH").toUpperCase();
                        if (itemType === "STRENGTH") {
                            if (!Array.isArray(action?.attrs) || action.attrs.length === 0) {
                                action.attrs = ["缁勬暟", "娆℃暟", "寮哄害", "浼戞伅鏃堕棿"];
                            }
                            return;
                        }
                        action.attrs = [];
                    });
                    setActions(actionMap);
                }

                // Find first incomplete set
                const actionExecutions = res.data.action_executions || [];
                const resolvedFocusIndex = resolveFocusExecutionIndex(actionExecutions, focusActionIndex);
                if (resolvedFocusIndex >= 0) {
                    const focusAction = actionExecutions[resolvedFocusIndex];
                    const pendingSetIndex = Array.isArray(focusAction?.sets)
                        ? focusAction.sets.findIndex((s: SetData) => s.status === 'pending')
                        : -1;
                    setExpandedAction(resolvedFocusIndex);
                    setCurrentSetIndex(pendingSetIndex !== -1 ? pendingSetIndex : 0);
                } else {
                    for (let i = 0; i < actionExecutions.length; i++) {
                        const action = actionExecutions[i];
                        if (!isStrengthAction(action)) continue;
                        const pendingSetIndex = action.sets.findIndex((s: SetData) => s.status === 'pending');
                        if (pendingSetIndex !== -1) {
                            setExpandedAction(i);
                            setCurrentSetIndex(pendingSetIndex);
                            break;
                        }
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

    const confirmExecutionNoticeAndStart = async () => {
        markExecutionPlanNoticeRead({
            instanceId,
            userId: session?.user?.id,
        });
        setExecutionNoticeVisible(false);
        setExecutionNoticeStarting(true);
        startTrainingRequestedRef.current = true;

        try {
            await startTraining();
        } finally {
            setExecutionNoticeStarting(false);
        }
    };

    const snoozeStaleReminder = (hours: number) => {
        if (!staleExecutionId) {
            setStaleReminderVisible(false);
            return;
        }
        try {
            const key = `coachlink:stale-exec-snooze:${staleExecutionId}`;
            localStorage.setItem(key, String(Date.now() + hours * 60 * 60 * 1000));
        } catch {
            // ignore
        } finally {
            setStaleReminderVisible(false);
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

        // Supabase Storage public / signed URL 一般可直接播放（不依赖前端 env）
        if (url.includes("/storage/v1/object/")) return true;

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

    // 选择文件后立即上传并绑定到当前组（避免“必须点完成才上传”的困惑）
    const handleSelectAndUploadVideo = async (
        file: File | null | undefined,
        actionId: string,
        setNumber: number,
    ) => {
        if (!execution) return;
        if (!file) return;

        // reset previous state for this set
        setVideoFile(file);
        setLinkedVideo(null);
        setVideoLink("");
        setUploadProgress(0);

        try {
            setUploading(true);

            const uploadedVideo = await videoService.uploadVideoFile(
                file,
                {
                    type: "training",
                    requires_review: false,
                } as any,
                (p) => setUploadProgress(p.percentage),
            );

            const uploadedUrl = (uploadedVideo as any)?.video_url || null;
            if (!uploadedUrl) {
                throw new Error("视频上传失败，未返回视频URL");
            }

            const bindRes = await executionService.addSetVideoLink({
                executionId: execution.id,
                actionId,
                setNumber,
                videoUrl: uploadedUrl,
            });

            if (bindRes?.id && bindRes.video_url) {
                setLinkedVideo({ id: bindRes.id, url: bindRes.video_url });
                setVideoLink(bindRes.video_url);
                showToast({
                    severity: "success",
                    summary: "上传成功",
                    detail: "已上传并绑定到本组",
                });

                // 清理 file input，允许重复选择同一文件
                setVideoFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
            } else {
                setVideoLink(uploadedUrl);
                showToast({
                    severity: "warn",
                    summary: "绑定失败",
                    detail:
                        "视频已上传，但未成功绑定到本组；已为你回填到链接框，可点击“绑定链接”重试",
                });
            }
        } catch (err) {
            console.error("[execution] auto upload video failed:", err);
            showToast({
                severity: "error",
                summary: "视频上传失败",
                detail: err instanceof Error ? err.message : "请稍后重试",
            });
            // keep selected file so user can retry on completion
        } finally {
            setUploading(false);
        }
    };

    const handleCompleteSet = async (actionIndex: number, setIndex: number) => {
        if (!execution) return;

        try {
            const actionExecution = execution.action_executions[actionIndex];
            const setData = actionExecution.sets[setIndex];
            const isEditing = setData.status === 'completed';
            const plannedKg = parsePlannedWeightKg(setData.planned_weight);
            const plannedReps = parsePlannedReps(setData.planned_reps);
            const weightChangedFromPlanned =
                plannedKg !== null &&
                weight !== null &&
                weight !== undefined &&
                Math.abs(Number(weight) - Number(plannedKg)) >= 0.1;
            const isCoachSubscriptionPlan = !!planInstance?.coach_subscription_id;
            const underPlannedWeight =
                plannedKg !== null &&
                weight !== null &&
                weight !== undefined &&
                Number(weight) < Number(plannedKg) - 0.1;
            const underPlannedReps =
                plannedReps !== null &&
                reps !== null &&
                reps !== undefined &&
                Number(reps) < Number(plannedReps);

            // 1. Upload video first if selected (so API can retrieve video_url)
            let uploadedVideoUrl: string | undefined;
            let uploadedVideoId: string | undefined;
            let hasVideo = false;

            // 1.0 If user pasted a link but didn't click "绑定链接", auto-bind on completion.
            if (!isImpromptuMode && !linkedVideo?.url && videoLink.trim()) {
                try {
                    setUploading(true);
                    const res = await executionService.addSetVideoLink({
                        executionId: execution.id,
                        actionId: actionExecution.action_id,
                        setNumber: setIndex + 1,
                        videoUrl: videoLink.trim(),
                    });
                    if (res && res.id && res.video_url) {
                        setLinkedVideo({ id: res.id, url: res.video_url });
                        uploadedVideoUrl = res.video_url;
                        uploadedVideoId = res.id;
                        hasVideo = true;
                    } else {
                        showToast({
                            severity: "warn",
                            summary: "链接绑定失败",
                            detail: "将继续保存本组，但不会附带视频链接",
                        });
                    }
                } finally {
                    setUploading(false);
                }
            }

            // 1.1 If user pasted a link, use it as the attached video
            if (linkedVideo?.url) {
                uploadedVideoUrl = linkedVideo.url;
                uploadedVideoId = linkedVideo.id;
                hasVideo = true;
            }
            // 兜底：如果用户选择了文件但未自动上传成功，可在“完成本组”时重试
            if (!isImpromptuMode && videoFile && !linkedVideo?.url) {
                try {
                    setUploading(true);
                    setUploadProgress(0);

                    // 统一上传方案：signed token -> 浏览器直传 Supabase -> 返回 public URL
                    const uploadedVideo = await videoService.uploadVideoFile(
                        videoFile,
                        {
                            type: 'training',
                            requires_review: false,
                        } as any,
                        (p) => setUploadProgress(p.percentage),
                    );

                    const uploadedUrl = (uploadedVideo as any)?.video_url || null;
                    if (!uploadedUrl) {
                        throw new Error("视频上传失败，未返回视频URL");
                    }

                    // 绑定到当前 execution/action/set
                    const bindRes = await executionService.addSetVideoLink({
                        executionId: execution.id,
                        actionId: actionExecution.action_id,
                        setNumber: setIndex + 1,
                        videoUrl: uploadedUrl,
                    });

                    if (bindRes?.id && bindRes.video_url) {
                        setLinkedVideo({ id: bindRes.id, url: bindRes.video_url });
                        uploadedVideoUrl = bindRes.video_url;
                        uploadedVideoId = bindRes.id;
                        hasVideo = true;

                        // Track video upload
                        trackEvent('student_video_upload', 'training', {
                            execution_id: execution.id,
                            action_id: actionExecution.action_id,
                            set_index: setIndex,
                        });

                        // 清理本地选择，避免重复上传
                        setVideoFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                    } else {
                        // 已上传但绑定失败：回填到输入框，允许手动点“绑定链接”
                        setVideoLink(uploadedUrl);
                        showToast({
                            severity: 'warn',
                            summary: '绑定失败',
                            detail: '视频已上传，但未成功绑定到本组；已为你回填到链接框，可点击“绑定链接”重试',
                        });
                    }
                } catch (err) {
                    console.error('Video upload failed:', err);
                    showToast({
                        severity: 'warn',
                        summary: '视频上传失败',
                        detail: (err instanceof Error ? err.message : '视频上传失败，但组数据仍会保存')
                    });
                } finally {
                    setUploading(false);
                    setUploadProgress(0);
                }
            }

            // 2. Complete set via API (with is_pr, has_video, actionId for persistence)
            const res: any = isImpromptuMode
                ? await impromptuTrainingService.completeSet({
                    executionId: execution.id,
                    actionIndex,
                    setIndex,
                    actualWeight: weight ?? undefined,
                    actualReps: reps ?? undefined,
                    notes: setNotes || undefined,
                })
                : await executionService.completeSet({
                    executionId: execution.id,
                    actionIndex,
                    setIndex,
                    actionId: actionExecution.action_id,
                    // NOTE: allow 0kg (e.g. unloaded movements); only treat null/undefined as "not provided"
                    actualWeight: weight ?? undefined,
                    actualReps: reps ?? undefined,
                    rpe: rpe ?? undefined,
                    notes: setNotes || undefined,
                    is_pr: markAsPR,
                    has_video: hasVideo
                });

            if (res) {
                // Track set completion
                trackEvent('student_set_complete', 'training', {
                    execution_id: execution.id,
                    action_id: actionExecution.action_id,
                    set_index: setIndex,
                    weight: weight,
                    reps: reps,
                    rpe: rpe,
                    is_pr: markAsPR || res.autoE1RM?.isPR,
                    has_video: hasVideo
                });

                // Check for auto-detected PR (e1RM system)
                if (res.autoE1RM?.isPR) {
                    const e1rm = res.autoE1RM.e1rm;
                    const previousPR = res.autoE1RM.previousPR;
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
                if (!isImpromptuMode && markAsPR && weight && reps) {
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

                    trackEvent('student_pr_record', 'training', {
                        execution_id: execution.id,
                        action_id: actionExecution.action_id,
                        type: 'manual',
                        weight: weight,
                        reps: reps
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
                    e1rm: res.autoE1RM?.e1rm,
                    is_auto_pr: res.autoE1RM?.isPR
                };
            // Recalculate completion counts (editing should not "++" counts)
            updatedExecution.action_executions[actionIndex].completed_sets =
                updatedExecution.action_executions[actionIndex].sets.filter((s: any) => s.status === 'completed').length;
            updatedExecution.completed_sets = res.completedSets ?? updatedExecution.action_executions.reduce(
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
            setVideoLink('');
            setLinkedVideo(null);
                setShowOptionalFields(false);
            setEditingSetKey(null);

            // One-time feedback: explain why input matters (calibration + next-time smarter)
            if (!calibrationToastShownRef.current && weightChangedFromPlanned) {
                calibrationToastShownRef.current = true;
                const e1rmText = res.autoE1RM?.e1rm
                    ? `已更新 e1RM≈${res.autoE1RM.e1rm}kg，`
                    : '';
                showToast({
                    severity: 'info',
                    summary: '已完成校准',
                    detail: `已记录真实重量。${e1rmText}本次后续组会联动；下次同动作自动算重量也会更贴合。`,
                });
            }

            // 教练订阅计划：如果实际完成低于计划目标，提醒学员去动作库/当前页快捷更新 1RM。
            if (
                isCoachSubscriptionPlan &&
                !isEditing &&
                (underPlannedWeight || underPlannedReps) &&
                !underPlanToastShownRef.current
            ) {
                underPlanToastShownRef.current = true;
                showToast({
                    severity: 'warn',
                    summary: '当前状态低于计划目标',
                    detail: '建议在当前页快捷设置，或前往“我的-动作库”调整该动作1RM（系统自动只会上调，手动可下调）。',
                    life: 6000,
                });
            }

            // Keep details expanded for edited set so user can confirm changes
            setExpandedSetKey(setKeyOf(actionIndex, setIndex));

            // Bug 4 fix: 提供完成组的即时反馈
            if (!isEditing) {
                showToast({
                    severity: 'success',
                    summary: '✓ 完成',
                    detail: `第${setData.set_number}组 已记录`,
                    life: 1500
                });
            }

            // Editing a completed set should not trigger rest timer or auto-advance
            if (!isEditing) {
                // Start rest timer if configured
                const restSeconds = setData.planned_rest_seconds || 90;
                if (restSeconds > 0) {
                    beginRestTimer(restSeconds);
                }
            }

            if (!isEditing) {
                // Move to next set
                const nextSetIndex = setIndex + 1;
                if (nextSetIndex < actionExecution.sets.length) {
                    setCurrentSetIndex(nextSetIndex);
                } else {
                    const nextActionIndex = findNextStrengthActionIndex(execution.action_executions || [], actionIndex);
                    if (nextActionIndex !== -1) {
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
            
            // Determine type - 优先使用 action.type，如果没有则默认为 STRENGTH
            const itemType = action?.type || 'STRENGTH';
            
            // 获取当前动作的状态
            const currentState = itemStates[actionIndex] || {};
            const dietContent = currentState.dietContent || '';
            const cardioDistance = currentState.cardioDistance;
            const cardioDuration = currentState.cardioDuration;
            
            // Call API
            const res = isImpromptuMode
                ? await impromptuTrainingService.completeItem({
                    executionId: execution.id,
                    actionIndex,
                    itemType: itemType as any,
                    completed: true,
                    actualContent: itemType === 'DIET' ? dietContent : undefined,
                    actualDistance: itemType === 'CARDIO' && cardioDistance ? cardioDistance * 1000 : undefined,
                    actualDuration: itemType === 'CARDIO' && cardioDuration ? cardioDuration * 60 : undefined,
                    notes: sessionNotes,
                })
                : await executionService.completeItem({
                    executionId: execution.id,
                    actionIndex,
                    itemType: itemType as any,
                    completed: true,
                    actualContent: itemType === 'DIET' ? dietContent : undefined,
                    actualDistance: itemType === 'CARDIO' && cardioDistance ? cardioDistance * 1000 : undefined, // to meters
                    actualDuration: itemType === 'CARDIO' && cardioDuration ? cardioDuration * 60 : undefined, // to seconds
                    notes: sessionNotes // Reuse session notes or add specific field if needed
                });

            if (res) {
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
                updatedExecution.completed_sets = res.completedItems || res.completedSets || execution.completed_sets + 1;
                setExecution(updatedExecution);

                // Reset form for this action
                setItemStates(prev => ({
                    ...prev,
                    [actionIndex]: {}
                }));

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
            const res = isImpromptuMode
                ? await impromptuTrainingService.finish({
                    executionId: execution.id,
                    sessionNotes: sessionNotes || undefined,
                })
                : await executionService.finishTraining({
                    executionId: execution.id,
                    sessionNotes: sessionNotes || undefined
                });

            if (res) {
                trackEvent('student_training_complete', 'training', { 
                    planId: execution.plan_id, 
                    executionId: execution.id
                });

                showToast({
                    severity: 'success',
                    summary: '训练完成',
                    detail: `完成 ${res.completed_sets}/${res.total_sets} 组`
                });
                handleSkipRest();
                if (isImpromptuMode) {
                    try {
                        await updateSession();
                    } catch (sessionError) {
                        console.warn('[training-execution] updateSession failed after impromptu finish:', sessionError);
                    }
                    router.push('/me/training-history');
                } else {
                    // 先弹反馈弹窗（有教练计划的场景），写完后再弹分享卡片
                    setFeedbackDialogVisible(true);
                }
            } else {
                // Bug 5 fix: 处理 API 返回失败的情况
                showToast({
                    severity: 'error',
                    summary: '完成训练失败',
                    detail: '请稍后重试'
                });
            }
        } catch (error) {
            console.error('Finish training failed:', error);
            // Bug 5 fix: 提供错误反馈
            showToast({
                severity: 'error',
                summary: '完成训练失败',
                detail: '网络错误，请稍后重试'
            });
        }
    };

    const handleQuickFinishTraining = () => {
        if (!execution || isImpromptuMode) return;
        if (execution.status === 'completed') return;

        confirmDialog({
            message: '将按计划默认值（最小值）一键完成所有组，未填写的重量/次数会自动补齐。',
            header: '确认快速完成',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: quickFinishLoading ? '处理中...' : '确认完成',
            rejectLabel: '取消',
            acceptClassName: 'p-button-success',
            accept: async () => {
                try {
                    setQuickFinishLoading(true);
                    const res = await executionService.finishTraining({
                        executionId: execution.id,
                        mode: 'quick',
                    });

                    if (res) {
                        trackEvent('student_training_complete', 'training', {
                            planId: execution.plan_id,
                            executionId: execution.id,
                            mode: 'quick',
                        });
                        showToast({
                            severity: 'success',
                            summary: '已快速完成',
                            detail: `完成 ${res.completed_sets}/${res.total_sets} 组`,
                        });
                        handleSkipRest();
                        setExecution((prev: any) => prev ? { ...prev, status: 'completed', completed_at: res.completed_at, completed_sets: res.completed_sets, total_sets: res.total_sets } : null);
                        setFeedbackDialogVisible(true);
                    } else {
                        showToast({
                            severity: 'error',
                            summary: '快速完成失败',
                            detail: '请稍后重试',
                        });
                    }
                } catch (error) {
                    console.error('Quick finish failed:', error);
                    showToast({
                        severity: 'error',
                        summary: '快速完成失败',
                        detail: '网络错误，请稍后重试',
                    });
                } finally {
                    setQuickFinishLoading(false);
                }
            },
        });
    };

    // 提交反馈并跳转分享卡片
    const handleSubmitFeedback = async () => {
        if (!execution) return;

        if (feedbackContent.trim()) {
            setFeedbackSubmitting(true);
            try {
                await executionService.submitFeedback({
                    executionId: execution.id,
                    content: feedbackContent.trim(),
                    difficultyRating: feedbackDifficulty,
                });
                showToast({
                    severity: 'success',
                    summary: '反馈已发送',
                    detail: '教练会看到你的反馈',
                });
            } catch (err) {
                console.warn('[training-execution] submit feedback failed:', err);
                // 反馈失败不阻塞主流程
            } finally {
                setFeedbackSubmitting(false);
            }
        }

        setFeedbackDialogVisible(false);
        setShareModalVisible(true);
    };

    // 跳过反馈，直接到分享卡片
    const handleSkipFeedback = () => {
        setFeedbackDialogVisible(false);
        setShareModalVisible(true);
    };

    const handleSkipRest = () => {
        restEndAtRef.current = null;
        setRestTimer(0);
        setIsResting(false);
        clearPersistedRestTimer();
    };

    const handleAddTime = (seconds: number) => {
        if (seconds <= 0) return;

        const base = restEndAtRef.current && restEndAtRef.current > Date.now()
            ? restEndAtRef.current
            : Date.now();
        const endAt = base + seconds * 1000;
        restEndAtRef.current = endAt;
        setIsResting(true);
        persistRestTimer(endAt);
        syncRestTimer();
    };

    // 添加额外组数
    const handleAddExtraSet = async (actionIndex: number) => {
        if (!execution || addingExtraSet) return;
        
        try {
            setAddingExtraSet(true);
            
            const res = await fetch(`${extraContentApiBase}/add-extra-set`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    executionId: execution.id,
                    actionIndex,
                }),
            });
            
            const data = await res.json();
            
            if (data.success && data.data) {
                // 更新本地状态
                const updatedExecution = { ...execution };
                const newSetIndex = data.data.newSetIndex;
                const actionExec = updatedExecution.action_executions[actionIndex];
                
                // 添加新组到本地状态
                actionExec.sets.push({
                    set_number: newSetIndex + 1,
                    status: 'pending',
                    planned_weight: '',
                    planned_reps: '',
                    source: 'student_extra',
                });
                actionExec.total_sets = actionExec.sets.length;
                updatedExecution.total_sets = data.data.totalSets;
                
                setExecution(updatedExecution);
                setCurrentSetIndex(newSetIndex);
                
                showToast({
                    severity: 'success',
                    summary: '已添加',
                    detail: `已添加第 ${newSetIndex + 1} 组`,
                    life: 2000,
                });
            } else {
                showToast({
                    severity: 'error',
                    summary: '添加失败',
                    detail: data.message || '无法添加额外组',
                });
            }
        } catch (error) {
            console.error('Add extra set failed:', error);
            showToast({
                severity: 'error',
                summary: '错误',
                detail: '添加额外组失败',
            });
        } finally {
            setAddingExtraSet(false);
        }
    };

    // 添加额外动作
    const handleAddExtraAction = async (action: any) => {
        if (!execution || addingExtraAction) return;
        
        try {
            setAddingExtraAction(true);
            
            const res = await fetch(`${extraContentApiBase}/add-extra-exercise`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    executionId: execution.id,
                    actionId: action.id,
                    actionName: action.name,
                    sets: [{ weight: null, reps: null }], // 默认1组
                }),
            });
            
            const data = await res.json();
            
            if (data.success && data.data) {
                // 更新本地状态
                const updatedExecution = { ...execution };
                const newActionIndex = data.data.newActionIndex;
                setActions((prev) => ({
                    ...prev,
                    [action.id]: {
                        id: action.id,
                        name: action.name || "鍔ㄤ綔",
                        type: String(action.type || "STRENGTH").toUpperCase(),
                        attrs: Array.isArray(action.attrs) ? action.attrs : [],
                    },
                }));
                
                // 添加新动作到本地状态
                updatedExecution.action_executions.push({
                    action_id: action.id,
                    action_name: action.name,
                    action_order: newActionIndex + 1,
                    source: 'student_extra',
                    source_action_id: action.id,
                    sets: [{
                        set_number: 1,
                        status: 'pending',
                        planned_weight: '',
                        planned_reps: '',
                        source: 'student_extra',
                    }],
                    total_sets: 1,
                    completed_sets: 0,
                });
                updatedExecution.total_sets = data.data.totalSets || (updatedExecution.total_sets + 1);
                
                setExecution(updatedExecution);
                setExpandedAction(newActionIndex);
                setCurrentSetIndex(0);
                
                showToast({
                    severity: 'success',
                    summary: '已添加',
                    detail: `已添加动作：${action.name}`,
                    life: 2000,
                });
                
                // Track event
                trackEvent('student_add_extra_exercise', 'training', {
                    execution_id: execution.id,
                    action_id: action.id,
                    action_name: action.name,
                });
            } else {
                showToast({
                    severity: 'error',
                    summary: '添加失败',
                    detail: data.message || '无法添加动作',
                });
            }
        } catch (error) {
            console.error('Add extra action failed:', error);
            showToast({
                severity: 'error',
                summary: '错误',
                detail: '添加动作失败',
            });
        } finally {
            setAddingExtraAction(false);
        }
    };

    // 删除学员自行添加的组
    const handleDeleteExtraSet = async (actionIndex: number, setIndex: number) => {
        if (!execution || removingSet) return;
        const actionExec = execution.action_executions[actionIndex];
        const setData = actionExec?.sets?.[setIndex];
        if (!setData || setData.source !== 'student_extra') return;

        try {
            setRemovingSet(true);
            const res = await fetch(`${extraContentApiBase}/delete-extra-set`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    executionId: execution.id,
                    actionIndex,
                    setIndex,
                }),
            });
            const data = await res.json();

            if (data.success && data.data) {
                const updatedExecution = { ...execution };
                const sets = [...updatedExecution.action_executions[actionIndex].sets];
                sets.splice(setIndex, 1);
                sets.forEach((s: any, idx: number) => {
                    s.set_number = idx + 1;
                    s.set_index = idx;
                });
                updatedExecution.action_executions[actionIndex].sets = sets;
                updatedExecution.action_executions[actionIndex].total_sets = sets.length;
                updatedExecution.total_sets = data.data.totalSets;

                setExecution(updatedExecution);
                if (currentSetIndex >= sets.length && actionIndex === expandedAction) {
                    setCurrentSetIndex(Math.max(0, sets.length - 1));
                }
                showToast({ severity: 'success', summary: '已删除', detail: '已删除该组', life: 2000 });
            } else {
                showToast({
                    severity: 'error',
                    summary: '删除失败',
                    detail: data.message || '无法删除',
                });
            }
        } catch (error) {
            console.error('Delete extra set failed:', error);
            showToast({ severity: 'error', summary: '错误', detail: '删除失败' });
        } finally {
            setRemovingSet(false);
        }
    };

    // 删除学员自行添加的动作
    const handleDeleteExtraAction = async (actionIndex: number) => {
        if (!execution || removingAction) return;
        const actionExec = execution.action_executions[actionIndex];
        if (!actionExec || actionExec.source !== 'student_extra') return;

        try {
            setRemovingAction(true);
            const res = await fetch(`${extraContentApiBase}/delete-extra-exercise`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    executionId: execution.id,
                    actionIndex,
                }),
            });
            const data = await res.json();

            if (data.success && data.data) {
                const updatedExecution = { ...execution };
                updatedExecution.action_executions.splice(actionIndex, 1);
                updatedExecution.action_executions.forEach((a: any, idx: number) => {
                    a.action_order = idx + 1;
                });
                updatedExecution.total_sets = data.data.totalSets;

                setExecution(updatedExecution);
                if (expandedAction === actionIndex) {
                    setExpandedAction(Math.max(0, actionIndex - 1));
                } else if (expandedAction > actionIndex) {
                    setExpandedAction(expandedAction - 1);
                }
                setCurrentSetIndex(0);
                showToast({ severity: 'success', summary: '已删除', detail: '已删除该动作', life: 2000 });
            } else {
                showToast({
                    severity: 'error',
                    summary: '删除失败',
                    detail: data.message || '无法删除',
                });
            }
        } catch (error) {
            console.error('Delete extra action failed:', error);
            showToast({ severity: 'error', summary: '错误', detail: '删除失败' });
        } finally {
            setRemovingAction(false);
        }
    };


    if (loading) {
        return (
            <div className="min-h-screen p-4">
                <Skeleton height="60px" className="mb-4" />
                <Skeleton height="200px" className="mb-4" />
                <Skeleton height="300px" />
            </div>
        );
    }

    if (!session?.user?.id) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2 text-surface-900">未登录</h2>
                    <p className="text-surface-500">请先登录</p>
                </div>
            </div>
        );
    }

    if (executionNoticeVisible && !execution) {
        return (
            <div className="min-h-screen bg-surface-50 px-4 py-8">
                <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
                    <div className="rounded-3xl border border-surface-200 bg-surface px-6 py-8 shadow-sm">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                            <i className="pi pi-book text-xl" />
                        </div>
                        <h2 className="text-xl font-bold text-surface-900">开始训练前先确认教练须知</h2>
                        <p className="mt-2 text-sm leading-relaxed text-surface-600">
                            确认阅读后才会创建或恢复本次训练记录，避免还没看完教练要求就进入正式执行。
                        </p>
                        <Button
                            label="返回今日安排"
                            icon="pi pi-arrow-left"
                            severity="secondary"
                            outlined
                            className="mt-5"
                            onClick={() => router.push('/today-training')}
                        />
                    </div>
                </div>
                <ExecutionPlanNoticeDialog
                    visible={executionNoticeVisible}
                    executionNotice={(planInstance as any)?.execution_notice || null}
                    planName={planInstance?.name || null}
                    onConfirm={confirmExecutionNoticeAndStart}
                    confirmLabel="我已阅读，开始训练"
                    confirmLoading={executionNoticeStarting}
                />
            </div>
        );
    }

    if (!execution) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2 text-surface-900">加载失败</h2>
                    <Button label="返回" onClick={() => router.back()} />
                </div>
            </div>
        );
    }

    const actionExecutions = execution.action_executions || [];
    const strengthActionIndexes = actionExecutions
        .map((actionExec: ActionExecution, index: number) => ({ actionExec, index }))
        .filter(({ actionExec }) => isStrengthAction(actionExec));
    const lightweightActionIndexes = actionExecutions
        .map((actionExec: ActionExecution, index: number) => ({ actionExec, index }))
        .filter(({ actionExec }) => !isStrengthAction(actionExec));
    const strengthCompletedSets = strengthActionIndexes.reduce(
        (sum, entry) => sum + Number(entry.actionExec.completed_sets || 0),
        0,
    );
    const strengthTotalSets = strengthActionIndexes.reduce(
        (sum, entry) => sum + Number(entry.actionExec.total_sets || 0),
        0,
    );
    const progress = strengthTotalSets > 0
        ? Math.round((strengthCompletedSets / strengthTotalSets) * 100)
        : 0;
    const hasPendingLightweightItems = lightweightActionIndexes.some(({ actionExec }) => {
        const completed = Number(actionExec.completed_sets || 0);
        const total = Number(actionExec.total_sets || 0);
        return completed < total;
    });

    const planDescriptionText = String(planInstance?.description || '').trim();
    const planNameText = String(planInstance?.name || '').trim();
    const planDescriptionPreview = planDescriptionText.length > 140
        ? `${planDescriptionText.slice(0, 140)}…`
        : planDescriptionText;

    return (
        <div className="min-h-screen">
            {/* 超时未结束提醒 */}
            <Dialog
                header="训练未结束提醒"
                visible={staleReminderVisible}
                onHide={() => setStaleReminderVisible(false)}
                draggable={false}
                resizable={false}
                className="w-[min(92vw,520px)]"
            >
                <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
                    <p>
                        这次训练已经开始 {staleHours} 小时了，但状态仍是 <strong>进行中</strong>。
                        如果你已经练完但忘记点击“完成训练”，可以回到今日训练页面一键完成；如果还没练完，就直接继续训练即可。
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <Button
                            label="去今日训练一键完成"
                            icon="pi pi-check"
                            onClick={() => router.push('/today-training')}
                            className="w-full sm:w-auto"
                        />
                        <Button
                            label="继续训练"
                            icon="pi pi-play"
                            onClick={() => setStaleReminderVisible(false)}
                            className="w-full sm:w-auto"
                            severity="secondary"
                            outlined
                        />
                    </div>
                    <div className="flex gap-2 pt-1">
                        <Button
                            label="6小时后再提醒"
                            onClick={() => snoozeStaleReminder(6)}
                            className="p-button-text p-button-sm"
                        />
                        <Button
                            label="今天不再提醒"
                            onClick={() => snoozeStaleReminder(24)}
                            className="p-button-text p-button-sm"
                        />
                    </div>
                    <p className="text-xs text-surface-500">
                        提醒阈值当前为 {STALE_THRESHOLD_HOURS} 小时（可配置）。
                    </p>
                </div>
            </Dialog>

            <ExecutionPlanNoticeDialog
                visible={noticeReviewVisible}
                mode="read"
                executionNotice={(planInstance as any)?.execution_notice || null}
                planName={planInstance?.name || null}
                onHide={() => setNoticeReviewVisible(false)}
                onConfirm={() => setNoticeReviewVisible(false)}
            />

            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 sticky top-0 z-10">
                <div className="flex items-center justify-between mb-3">
                    <button onClick={() => router.back()} className="p-2 hover:bg-white/20 rounded-lg">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-lg font-bold text-white">力量训练执行</h1>
                    <div className="text-sm text-white/90">
                        {strengthCompletedSets}/{strengthTotalSets} 组
                    </div>
                </div>
                <ProgressBar value={progress} showValue={false} style={{ height: '8px' }} />
            </div>

            {!isImpromptuMode && (
                <div className="px-4 pt-4">
                    <div className="rounded-2xl border border-surface-200/70 bg-surface-50 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="text-sm font-bold text-surface-900">
                                这里是力量训练执行页
                            </div>
                            <div className="text-xs text-surface-600 mt-1">
                                这里专门处理力量动作的连续训练与逐组记录。饮食、有氧和习惯任务请回到“今日安排”分别完成。
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                            <Button
                                label="执行须知"
                                icon="pi pi-info-circle"
                                severity="secondary"
                                outlined
                                onClick={() => setNoticeReviewVisible(true)}
                            />
                            <Button
                                label="返回今日安排"
                                icon="pi pi-home"
                                severity="secondary"
                                outlined
                                onClick={() => router.push('/today-training')}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Plan global description (template/instance description) */}
            {(planNameText || planDescriptionText) && (
                <div className="px-4 pt-4">
                    <div className="bg-surface-0 border border-surface-200/70 rounded-2xl p-4">
                        {planNameText ? (
                            <div className="text-sm font-bold text-surface-900 mb-1">
                                {planNameText}
                            </div>
                        ) : null}
                        {planDescriptionText ? (
                            <div className="text-sm text-surface-700 whitespace-pre-line">
                                {planDescExpanded ? planDescriptionText : planDescriptionPreview}
                            </div>
                        ) : (
                            <div className="text-sm text-surface-500">
                                暂无计划说明
                            </div>
                        )}
                        {planDescriptionText && planDescriptionText.length > 140 ? (
                            <div className="mt-3">
                                <Button
                                    label={planDescExpanded ? '收起' : '展开'}
                                    icon={planDescExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'}
                                    className="p-button-text p-button-sm"
                                    onClick={() => setPlanDescExpanded((v) => !v)}
                                />
                            </div>
                        ) : null}
                    </div>
                </div>
            )}

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
                {strengthActionIndexes.length === 0 && (
                    <Card className="rounded-2xl">
                        <div className="text-center py-6 text-surface-600">
                            当前这一天没有力量动作，请返回“今日安排”完成饮食、有氧或习惯任务。
                        </div>
                    </Card>
                )}
                {strengthActionIndexes.map(({ actionExec, index: actionIndex }) => {
                    const action = actions[actionExec.action_id];
                    const demoVideoUrl = action?.url || action?.video_url;
                    const isExpanded = expandedAction === actionIndex;
                    const isCompleted = actionExec.completed_sets === actionExec.total_sets;

                    return (
                        <Card 
                            key={actionIndex}
                            id={`execution-action-${actionIndex}`}
                            className={`${isCompleted ? 'opacity-60' : ''} rounded-2xl`}
                        >
                            {/* Action Header */}
                            <div 
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => selectAction(isExpanded ? -1 : actionIndex)}
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
                                    {actionExec.source === 'student_extra' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteExtraAction(actionIndex);
                                            }}
                                            disabled={removingAction}
                                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                            title="删除此动作"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
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
                                        <ActionDetailPanel
                                            detail={action?.detail}
                                            demoVideoUrl={demoVideoUrl}
                                            onOpenVideo={openVideo}
                                        />
                                    )}

                                    {(() => {
                                        // 确定动作类型：优先使用 action.type，如果没有则默认为 STRENGTH
                                        const actionType = action?.type || 'STRENGTH';
                                        return actionType === 'STRENGTH';
                                    })() ? (
                                        // 力量训练：显示组列表
                                        <>
                                        {actionExec.sets.map((setData: SetData, setIndex: number) => {
                                            const isCurrentSet = setIndex === currentSetIndex && actionIndex === expandedAction;
                                            const isSetCompleted = setData.status === 'completed';
                                            const isSelectedSet = actionIndex === expandedAction && setIndex === currentSetIndex;
                                            const key = setKeyOf(actionIndex, setIndex);
                                            const isDetailsExpanded = expandedSetKey === key;
                                            const isEditingThisSet = editingSetKey === key;
                                            const showSetForm = isCurrentSet && (!isSetCompleted || isEditingThisSet);
                                            const allowNegativeWeight = !!(action?.includesBodyWeight ?? (action as any)?.includes_body_weight);
                                            const plannedRepsText = setData.planned_reps === null ||
                                                setData.planned_reps === undefined ||
                                                String(setData.planned_reps).trim() === "" ||
                                                String(setData.planned_reps).trim() === "0"
                                                ? "自选"
                                                : String(setData.planned_reps);
                                            const plannedText = `${setData.planned_weight || '-'} × ${plannedRepsText}次`;
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
                                                                // Bug 3 Fix: 手动切换组时重置输入状态，防止"重量联动"
                                                                if (currentSetIndex !== setIndex) {
                                                                    setWeight(null);
                                                                    setReps(null);
                                                                    setRpe(null);
                                                                    setSetNotes('');
                                                                    setMarkAsPR(false);
                                                                }

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
                                                            {setData.source === 'student_extra' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteExtraSet(actionIndex, setIndex);
                                                                    }}
                                                                    disabled={removingSet}
                                                                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                                                    title="删除此组"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
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
                                                            {shouldPromptOneRM(action, setData) && (
                                                                <div className="mt-3 mb-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                                                                    <div className="text-xs font-bold text-amber-700">
                                                                        当前动作需要1RM
                                                                    </div>
                                                                    <div className="mt-1 text-xs text-amber-700/90">
                                                                        检测到该动作启用了智能计算且使用强度配置，建议先设置全局1RM再继续训练。
                                                                    </div>
                                                                    <div className="mt-2 flex gap-2">
                                                                        <Button
                                                                            type="button"
                                                                            label="快捷设置1RM"
                                                                            icon="pi pi-sliders-h"
                                                                            className="p-button-sm rounded-xl"
                                                                            onClick={() => {
                                                                                setOneRMSettingAction(action);
                                                                                setOneRMSettingValue(
                                                                                    typeof action?.reference_1rm === 'number' &&
                                                                                        Number.isFinite(action.reference_1rm)
                                                                                        ? action.reference_1rm
                                                                                        : null
                                                                                );
                                                                                setOneRMDialogVisible(true);
                                                                            }}
                                                                        />
                                                                        <Button
                                                                            type="button"
                                                                            label="去动作库"
                                                                            icon="pi pi-arrow-right"
                                                                            className="p-button-text p-button-sm"
                                                                            onClick={() => router.push('/me/action-lib')}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {/* 只展示：重量 / 次数 / RPE + 进步组勾选（其余折叠） */}
                                                            {/* iPhone 14 Pro Max 等较宽机型：避免 RPE 被挤到下一行，强制 4 列同排 */}
                                                            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_72px_72px_52px] items-end gap-2">
                                                                <div className="min-w-0" id="guide-weight-input">
                                                                    <label className="text-xs text-surface-600 font-bold">
                                                                        {allowNegativeWeight ? '外加重量(kg)' : '重量(kg)'}
                                                                    </label>
                                                                    <AeroInputNumber
                                                                        value={weight}
                                                                        onValueChange={(e) => setWeight(e.value ?? null)}
                                                                        min={allowNegativeWeight ? -300 : 0}
                                                                        max={500}
                                                                        className="w-full"
                                                                        inputClassName="w-full text-center font-bold"
                                                                        placeholder={
                                                                            allowNegativeWeight
                                                                                ? (isWeightRequiredForSet(setData) ? '必填' : '可选')
                                                                                : (isWeightRequiredForSet(setData) ? '必填' : '可选')
                                                                        }
                                                                    />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <label className="text-xs text-surface-600 font-bold">次数</label>
                                                                    <AeroInputNumber 
                                                                        value={reps}
                                                                        onValueChange={(e) => setReps(e.value ?? null)}
                                                                        className="w-full"
                                                                        inputClassName="w-full text-center font-bold"
                                                                    />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <label className="text-xs text-surface-600 font-bold">RPE</label>
                                                                    <AeroInputNumber 
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
                                                                        // Allow 0kg; only block when weight is missing
                                                                        if (isWeightRequiredForSet(setData) && (weight === null || weight === undefined)) {
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
                                                                    id="guide-video-upload"
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
                                                                    disabled={uploading}
                                                                    onChange={(e) =>
                                                                        handleSelectAndUploadVideo(
                                                                            e.target.files?.[0],
                                                                            actionExec.action_id,
                                                                            setIndex + 1,
                                                                        )
                                                                    }
                                                                    className="hidden"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (!uploading && fileInputRef.current) {
                                                                            fileInputRef.current.click();
                                                                        }
                                                                    }}
                                                                    disabled={uploading}
                                                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium select-none transition-colors
                                                                        ${uploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-surface-50'}
                                                                        ${(linkedVideo?.url || videoFile) ? 'border-green-300 text-green-600 bg-green-50/30' : 'border-surface-200 text-surface-700 bg-surface'}`}
                                                                >
                                                                    <Upload className="w-4 h-4" />
                                                                        <span>
                                                                        {uploading
                                                                            ? `处理中... ${uploadProgress}%`
                                                                            : (linkedVideo?.url
                                                                                ? "已上传视频"
                                                                                : (videoFile ? "已选择视频" : "选择视频"))}
                                                                    </span>
                                                                </button>
                                                                {(videoFile || linkedVideo?.url) && (
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setVideoFile(null);
                                                                            setLinkedVideo(null);
                                                                            setVideoLink("");
                                                                            setUploadProgress(0);
                                                                            if (fileInputRef.current) {
                                                                                fileInputRef.current.value = '';
                                                                            }
                                                                        }}
                                                                        className="text-xs text-red-400 hover:text-red-300"
                                                                    >
                                                                        删除
                                                                    </button>
                                                                )}
                                                                </div>

                                                            {uploading && uploadProgress < 100 && (
                                                                <div className="mt-2">
                                                                    <div className="flex justify-between text-[10px] font-black text-primary-500 uppercase tracking-widest mb-2">
                                                                        <span>视频上传中...</span>
                                                                        <span>{uploadProgress}%</span>
                                                                    </div>
                                                                    <ProgressBar value={uploadProgress} showValue={false} style={{ height: '6px' }} className="rounded-full overflow-hidden bg-surface-100" />
                                                                </div>
                                                            )}

                                                            {/* 已上传/已绑定视频：支持预览 */}
                                                            {(linkedVideo?.url || videoLink.trim()) && (
                                                                <div className="mt-2 p-3 rounded-xl bg-surface-50 border border-surface-200 flex items-center justify-between gap-2">
                                                                    <span className="text-xs text-surface-600 truncate flex-1">
                                                                        {linkedVideo?.url ? "已绑定本组视频" : "已填写链接"}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openVideo(linkedVideo?.url || videoLink.trim())}
                                                                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200"
                                                                    >
                                                                        <Play className="w-4 h-4" />
                                                                        查看视频
                                                                    </button>
                                                                </div>
                                                            )}

                                                                <div className="pt-2 border-t border-surface-100">
                                                                    <div className="text-xs text-surface-500 font-medium mb-2">
                                                                        或粘贴视频链接（不占用存储；建议 mp4 直链，外站可能无法内嵌播放）
                                                                    </div>
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <InputText
                                                                            value={videoLink}
                                                                            onChange={(e) => setVideoLink(e.target.value)}
                                                                            placeholder="粘贴视频链接（https://...）"
                                                                            className="flex-1 min-w-[220px]"
                                                                        />
                                                                        <Button
                                                                            label={linkedVideo ? "已绑定链接" : "绑定链接"}
                                                                            size="small"
                                                                            outlined
                                                                            severity={linkedVideo ? "success" : "secondary"}
                                                                            onClick={async () => {
                                                                                if (!execution) return;
                                                                                const url = videoLink.trim();
                                                                                if (!url) {
                                                                                    showToast({
                                                                                        severity: "warn",
                                                                                        summary: "还差一步",
                                                                                        detail: "请先粘贴视频链接",
                                                                                    });
                                                                                    return;
                                                                                }
                                                                                try {
                                                                                    setUploading(true);
                                                                                    const res = await executionService.addSetVideoLink({
                                                                                        executionId: execution.id,
                                                                                        actionId: execution.action_executions[actionIndex].action_id,
                                                                                        setNumber: setIndex + 1,
                                                                                        videoUrl: url,
                                                                                    });
                                                                                    if (res && res.id && res.video_url) {
                                                                                        setLinkedVideo({ id: res.id, url: res.video_url });
                                                                                        showToast({
                                                                                            severity: "success",
                                                                                            summary: "链接已绑定",
                                                                                            detail: "已绑定视频链接，完成本组时会一并保存",
                                                                                        });
                                                                                    } else {
                                                                                        showToast({
                                                                                            severity: "error",
                                                                                            summary: "绑定失败",
                                                                                            detail: "无法绑定链接",
                                                                                        });
                                                                                    }
                                                                                } finally {
                                                                                    setUploading(false);
                                                                                }
                                                                            }}
                                                                        />
                                                                        {!linkedVideo && videoLink.trim() && (
                                                                            <span className="text-[11px] font-bold text-surface-500">
                                                                                已填链接（点击完成时会自动绑定）
                                                                            </span>
                                                                        )}
                                                                        {linkedVideo && (
                                                                            <button
                                                                                type="button"
                                                                                className="text-xs text-red-400 hover:text-red-300"
                                                                                onClick={() => {
                                                                                    setLinkedVideo(null);
                                                                                    showToast({
                                                                                        severity: "info",
                                                                                        summary: "已取消",
                                                                                        detail: "已取消绑定的视频链接",
                                                                                    });
                                                                                }}
                                                                            >
                                                                                取消绑定
                                                                            </button>
                                                                        )}
                                                                    </div>
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
                                        })}
                                        
                                        {/* +1组 按钮 */}
                                        <button
                                            type="button"
                                            onClick={() => handleAddExtraSet(actionIndex)}
                                            disabled={addingExtraSet}
                                            className="w-full py-3 border-2 border-dashed border-surface-300 rounded-2xl text-surface-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span className="font-medium">{addingExtraSet ? '添加中...' : '+1 组'}</span>
                                        </button>
                                        </>
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
                                                        {(() => {
                                                            const actionType = action?.type || 'STRENGTH';
                                                            return actionType === 'DIET' ? '🍽️ 饮食打卡' : actionType === 'CARDIO' ? '🏃 有氧打卡' : '✅ 习惯打卡';
                                                        })()}
                                                    </h3>
                                                    
                                                    {/* Plan Detail Reminder */}
                                                    {action?.item_schema && (
                                                        <div className="bg-surface-100 p-3 rounded text-sm text-surface-600">
                                                             {(() => {
                                                                 const actionType = action?.type || 'STRENGTH';
                                                                 if (actionType === 'DIET') {
                                                                     return <div>建议: {action.item_schema.calories} kcal</div>;
                                                                 } else if (actionType === 'CARDIO') {
                                                                     return <div>目标: {(action.item_schema.distance / 1000).toFixed(1)} km / {(action.item_schema.duration / 60).toFixed(0)} 分钟</div>;
                                                                 } else if (actionType === 'HABIT') {
                                                                     return <div>说明: {action.detail}</div>;
                                                                 }
                                                                 return null;
                                                             })()}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Diet Form */}
                                                    {(() => {
                                                        const actionType = action?.type || 'STRENGTH';
                                                        return actionType === 'DIET';
                                                    })() && (
                                                        <div className="space-y-3">
                                                            <label className="text-sm font-medium">记录内容 (可选)</label>
                                                            <InputTextarea 
                                                                value={itemStates[actionIndex]?.dietContent || ''}
                                                                onChange={(e) => setItemStates(prev => ({
                                                                    ...prev,
                                                                    [actionIndex]: {
                                                                        ...prev[actionIndex],
                                                                        dietContent: e.target.value
                                                                    }
                                                                }))}
                                                                rows={3}
                                                                placeholder="吃了什么？(例如: 鸡胸肉, 西兰花...)"
                                                                className="w-full"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Cardio Form */}
                                                    {(() => {
                                                        const actionType = action?.type || 'STRENGTH';
                                                        return actionType === 'CARDIO';
                                                    })() && (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="text-sm font-medium">距离 (km)</label>
                                                                <AeroInputNumber 
                                                                    value={itemStates[actionIndex]?.cardioDistance ?? null}
                                                                    onValueChange={(e) => setItemStates(prev => ({
                                                                        ...prev,
                                                                        [actionIndex]: {
                                                                            ...prev[actionIndex],
                                                                            cardioDistance: e.value ?? null
                                                                        }
                                                                    }))}
                                                                    min={0}
                                                                    max={100}
                                                                    minFractionDigits={1}
                                                                    placeholder="0.0"
                                                                    className="w-full"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-sm font-medium">时长 (分钟)</label>
                                                                <AeroInputNumber 
                                                                    value={itemStates[actionIndex]?.cardioDuration ?? null}
                                                                    onValueChange={(e) => setItemStates(prev => ({
                                                                        ...prev,
                                                                        [actionIndex]: {
                                                                            ...prev[actionIndex],
                                                                            cardioDuration: e.value ?? null
                                                                        }
                                                                    }))}
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
                
                {/* 添加动作按钮 */}
                <button
                    type="button"
                    onClick={() => setShowActionPicker(true)}
                    disabled={addingExtraAction}
                    className="w-full py-4 border-2 border-dashed border-primary-300 rounded-2xl text-primary-600 hover:border-primary-500 hover:bg-primary-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <Plus className="w-5 h-5" />
                    <span className="font-bold">{addingExtraAction ? '添加中...' : '+ 添加动作'}</span>
                </button>
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
                        {hasPendingLightweightItems && !isImpromptuMode && (
                            <div className="mb-4 rounded-2xl border border-amber-100/70 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                这一天还有 {lightweightActionIndexes.length} 个轻任务需要在“今日安排”里单独完成。
                                当前页面只负责力量训练；完成后请返回首页继续处理饮食、有氧和习惯任务。
                            </div>
                        )}
                        <InputTextarea 
                            value={sessionNotes}
                            onChange={(e) => setSessionNotes(e.target.value)}
                            placeholder="力量训练备注（可选）"
                            rows={2}
                            className="w-full mb-4"
                        />
                        <div className="flex flex-col gap-2">
                            <Button 
                                label="完成训练"
                                onClick={handleFinishTraining}
                                id="guide-finish-training"
                                className="w-full"
                                severity="success"
                                size="large"
                            />
                            {!isImpromptuMode && (
                                <Button
                                    label={quickFinishLoading ? '快速完成中...' : '一键快速完成'}
                                    onClick={handleQuickFinishTraining}
                                    disabled={quickFinishLoading}
                                    severity="secondary"
                                    outlined
                                    className="w-full"
                                />
                            )}
                        </div>
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

        <Dialog
            visible={oneRMDialogVisible}
            onHide={() => setOneRMDialogVisible(false)}
            header="设置全局1RM"
            style={{ width: '92vw', maxWidth: '480px' }}
            modal
            dismissableMask
        >
            <div className="space-y-3">
                <div className="text-sm text-surface-700">
                    动作：<span className="font-bold">{oneRMSettingAction?.name || '-'}</span>
                </div>
                <div>
                    <label className="text-xs font-bold text-surface-600">参考1RM (kg)</label>
                    <AeroInputNumber
                        value={oneRMSettingValue}
                        onValueChange={(e) => setOneRMSettingValue(e.value ?? null)}
                        min={0}
                        max={500}
                        maxFractionDigits={1}
                        suffix="kg"
                        className="w-full mt-1"
                        inputClassName="w-full"
                    />
                </div>
                <div className="text-xs text-surface-500">
                    保存后会作为该动作的学员全局1RM，后续计划将直接复用。
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button
                        label="取消"
                        className="p-button-text"
                        onClick={() => setOneRMDialogVisible(false)}
                        disabled={oneRMSettingSaving}
                    />
                    <Button
                        label="保存"
                        icon="pi pi-check"
                        onClick={handleSaveQuickOneRM}
                        loading={oneRMSettingSaving}
                    />
                </div>
            </div>
        </Dialog>

        {/* 训练反馈弹窗 - 完成训练后第一步 */}
        <Dialog
            visible={feedbackDialogVisible}
            onHide={handleSkipFeedback}
            header={null}
            closable={false}
            modal
            className="w-[92vw] max-w-md"
            contentClassName="p-0"
        >
            <div className="p-5">
                <div className="text-center mb-4">
                    <div className="text-2xl mb-1">💬</div>
                    <h3 className="text-lg font-bold text-surface-800">训练感受如何？</h3>
                    <p className="text-sm text-surface-500 mt-1">简短写一句反馈，教练会看到哦</p>
                </div>

                {/* 难度评分 */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-surface-600 mb-2">今天的训练难度</label>
                    <div className="flex items-center justify-between gap-1">
                        {[
                            { val: 1, label: '太轻松', emoji: '😴' },
                            { val: 2, label: '轻松', emoji: '😊' },
                            { val: 3, label: '刚好', emoji: '💪' },
                            { val: 4, label: '有点难', emoji: '😤' },
                            { val: 5, label: '太难了', emoji: '🥵' },
                        ].map((item) => (
                            <button
                                key={item.val}
                                onClick={() => setFeedbackDifficulty(item.val)}
                                className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all text-xs
                                    ${feedbackDifficulty === item.val
                                        ? 'bg-primary-100 border-2 border-primary-400 scale-105'
                                        : 'bg-surface-50 border-2 border-transparent hover:bg-surface-100'
                                    }`}
                            >
                                <span className="text-lg">{item.emoji}</span>
                                <span className={feedbackDifficulty === item.val ? 'font-bold text-primary-700' : 'text-surface-500'}>
                                    {item.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 反馈输入 */}
                <InputTextarea
                    value={feedbackContent}
                    onChange={(e) => setFeedbackContent(e.target.value)}
                    placeholder="例如：深蹲感觉重量可以加一点，卧推姿势不太确定..."
                    rows={3}
                    maxLength={500}
                    className="w-full mb-1"
                    autoResize
                />
                <div className="text-right text-xs text-surface-400 mb-4">
                    {feedbackContent.length}/500
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-3">
                    <Button
                        label="跳过"
                        className="flex-1 p-button-text text-surface-500"
                        onClick={handleSkipFeedback}
                        disabled={feedbackSubmitting}
                    />
                    <Button
                        label="发送给教练"
                        icon="pi pi-send"
                        className="flex-1"
                        severity="success"
                        onClick={handleSubmitFeedback}
                        loading={feedbackSubmitting}
                        disabled={!feedbackContent.trim()}
                    />
                </div>
            </div>
        </Dialog>

        {/* Share Card Modal */}
        <ShareCardGenerator 
            visible={shareModalVisible}
            onHide={() => {
                setShareModalVisible(false);
                const di = Number(execution?.day_index ?? dayIndex);
                router.push(`/today-training?justConfirmed=1&dayIndex=${Number.isFinite(di) ? di : ''}`);
            }}
            executionId={execution.id}
        />
            
            {/* Action Picker Dialog */}
            <ActionPicker
                visible={showActionPicker}
                onHide={() => setShowActionPicker(false)}
                onSelect={handleAddExtraAction}
                userId={session?.user?.id || ''}
            />

            <ConfirmDialog />
    </div>
);
}

export default function TrainingExecutionPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-app-canvas flex items-center justify-center">
                <Skeleton width="4rem" height="4rem" shape="circle" />
            </div>
        }>
            <TrainingExecutionContent />
        </Suspense>
    );
}
