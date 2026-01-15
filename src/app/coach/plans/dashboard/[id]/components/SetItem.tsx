/**
 * SetItem 组件 - 单组训练项
 * 
 * 显示和管理单组训练的所有交互
 * 遵守 PrimeReact 规范和主题色系统
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Check, X, Video, TrendingUp, Edit2, Trash2, Award, Star, Upload, ExternalLink } from 'lucide-react';
import { Button } from 'primereact/button';
import { InputNumber } from 'primereact/inputnumber';
import { confirmDialog } from 'primereact/confirmdialog';
import { trainingService } from '@/app/service/trainingService';
import { useToastContext } from '@/context/ToastContext';
import SetVideoUploader from './SetVideoUploader';
import type { SetItemProps, SetRecord } from '@/types/training-execution';

const parseMinReps = (plannedReps: string | number | undefined): number => {
    if (!plannedReps) return 5;
    const repsStr = String(plannedReps);
    if (repsStr.includes('-')) {
        const parts = repsStr.split('-');
        const min = parseInt(parts[0].trim());
        return isNaN(min) ? 5 : min;
    }
    const value = parseInt(repsStr);
    return isNaN(value) ? 5 : value;
};

const parseMinWeight = (plannedWeight: string | number | undefined): number => {
    if (!plannedWeight) return 0;
    const weightStr = String(plannedWeight);
    if (weightStr.includes('-')) {
        const parts = weightStr.split('-');
        const min = parseFloat(parts[0].trim());
        return isNaN(min) ? 0 : min;
    }
    const value = parseFloat(weightStr);
    return isNaN(value) ? 0 : value;
};

const SetItem: React.FC<SetItemProps> = ({
    set,
    setIndex,
    exerciseIndex,
    exerciseCategory,
    userId,
    trainingRecordId,
    onComplete,
    onSkip,
    onUpdate,
    onDelete,
    showVideo = true,
    showPR = true,
    disabled = false,
    readOnly = false
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [weight, setWeight] = useState<number>(
        set.actual_weight ?? parseMinWeight(set.planned_weight)
    );
    const [reps, setReps] = useState<number>(
        set.actual_reps ?? parseMinReps(set.planned_reps)
    );

    // 视频相关状态
    const [showVideoUploader, setShowVideoUploader] = useState(false);
    const [currentVideoId, setCurrentVideoId] = useState<string | undefined>(set.video_id);
    const [currentVideoUrl, setCurrentVideoUrl] = useState<string | undefined>();
    const [hasVideo, setHasVideo] = useState<boolean>(set.has_video || false);

    const { showToast } = useToastContext();
    const weightInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && weightInputRef.current) {
            weightInputRef.current.focus();
            weightInputRef.current.select();
        }
    }, [isEditing]);

    const getStatusStyle = () => {
        switch (set.status) {
            case 'completed':
                return {
                    bg: 'bg-primary-50',
                    border: 'border-primary-300',
                    text: 'text-primary-700',
                    icon: Check,
                    iconColor: 'text-primary-600'
                };
            case 'skipped':
                return {
                    bg: 'bg-yellow-50',
                    border: 'border-yellow-300',
                    text: 'text-yellow-700',
                    icon: X,
                    iconColor: 'text-yellow-600'
                };
            case 'in_progress':
                return {
                    bg: 'bg-blue-50',
                    border: 'border-blue-300',
                    text: 'text-blue-700',
                    icon: Edit2,
                    iconColor: 'text-blue-600'
                };
            default:
                return {
                    bg: 'bg-surface',
                    border: 'border-surface-border',
                    text: 'text-surface-foreground',
                    icon: null,
                    iconColor: 'text-surface-foreground'
                };
        }
    };

    const statusStyle = getStatusStyle();
    const StatusIcon = statusStyle.icon;

    const handleComplete = useCallback(() => {
        if (disabled) return;
        onUpdate({
            actual_weight: weight,
            actual_reps: reps
        });
        setIsEditing(false);
    }, [weight, reps, onUpdate, disabled]);

    const handleMarkCompleted = useCallback(() => {
        if (disabled) return;
        const completedData: SetRecord = {
            ...set,
            actual_weight: weight,
            actual_reps: reps,
            status: 'completed',
            completed_at: new Date().toISOString()
        };
        onComplete(completedData);
        setIsEditing(false);
    }, [set, weight, reps, onComplete, disabled]);

    const handleSkip = useCallback(() => {
        if (disabled || readOnly) return;
        if (confirm('确定要跳过这组训练吗？')) {
            onSkip();
        }
    }, [onSkip, disabled, readOnly]);

    const startEditing = useCallback(() => {
        if (disabled || readOnly || set.status === 'completed' || set.status === 'skipped') return;
        setIsEditing(true);
        if (set.status !== 'in_progress') {
            onUpdate({ status: 'in_progress' });
        }
    }, [disabled, readOnly, set.status, onUpdate]);

    const cancelEdit = useCallback(() => {
        setWeight(set.actual_weight ?? parseMinWeight(set.planned_weight));
        setReps(set.actual_reps ?? parseMinReps(set.planned_reps));
        setIsEditing(false);
        if (set.status === 'in_progress') {
            onUpdate({ status: 'pending' });
        }
    }, [set, onUpdate]);

    const renderCheckbox = () => (
        <button
            onClick={set.status === 'completed' || readOnly ? undefined : startEditing}
            disabled={disabled || readOnly}
            className={`w-6 h-6 border-round border-2 flex align-items-center justify-content-center transition-all ${set.status === 'completed'
                    ? 'bg-primary border-primary'
                    : 'border-surface-border hover:border-primary'
                } ${(disabled || readOnly) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            {set.status === 'completed' && (
                <Check className="w-4 h-4 text-white" />
            )}
        </button>
    );

    const renderParams = () => {
        if (isEditing) {
            return (
                <div className="flex align-items-center gap-2">
                    <InputNumber
                        inputRef={weightInputRef}
                        value={weight}
                        onValueChange={(e) => setWeight(e.value ?? 0)}
                        min={0}
                        step={2.5}
                        suffix=" kg"
                        className="w-5rem"
                    />
                    <span className="text-surface-foreground">×</span>
                    <InputNumber
                        value={reps}
                        onValueChange={(e) => setReps(e.value ?? 0)}
                        min={0}
                        step={1}
                        suffix=" 次"
                        className="w-5rem"
                    />
                </div>
            );
        }

        return (
            <div
                onClick={startEditing}
                className={`flex align-items-center gap-2 ${(set.status === 'pending' || set.status === 'in_progress') && !disabled && !readOnly
                        ? 'cursor-pointer hover:text-primary' : ''
                    }`}
            >
                <span className="font-medium">
                    {weight ? `${weight}kg` : '-'}
                </span>
                <span className="text-surface-foreground">×</span>
                <span className="font-medium">
                    {reps ? `${reps}次` : '-'}
                </span>
            </div>
        );
    };

    const handleMarkBreakthrough = useCallback(() => {
        if (disabled || readOnly || set.status !== 'completed') return;
        const newBreakthroughState = !set.is_breakthrough;
        onUpdate({ is_breakthrough: newBreakthroughState });
    }, [set.is_breakthrough, set.status, disabled, readOnly, onUpdate]);

    // 视频上传成功回调
    const handleVideoUploadSuccess = useCallback((videoId: string, videoUrl: string) => {
        setCurrentVideoId(videoId);
        setCurrentVideoUrl(videoUrl);
        setHasVideo(true);
        onUpdate({
            video_id: videoId,
            has_video: true
        });
    }, [onUpdate]);

    // 删除视频
    const handleDeleteVideo = useCallback(() => {
        if (!currentVideoId) return;

        confirmDialog({
            message: '确定要删除这个视频吗？视频文件将被永久删除，此操作无法撤销。',
            header: '删除确认',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: '删除',
            rejectLabel: '取消',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try {
                    const success = await trainingService.deleteSetVideo({
                        video_id: currentVideoId
                    });

                    if (success) {
                        setCurrentVideoId(undefined);
                        setCurrentVideoUrl(undefined);
                        setHasVideo(false);
                        onUpdate({
                            video_id: undefined,
                            has_video: false
                        });
                        showToast({ severity: 'success', summary: '视频已删除' });
                    } else {
                        showToast({ severity: 'error', summary: '删除视频失败' });
                    }
                } catch (error) {
                    console.error('删除视频失败:', error);
                    showToast({ severity: 'error', summary: '删除视频失败' });
                }
            }
        });
    }, [currentVideoId, onUpdate, showToast]);

    // 查看视频
    const handleViewVideo = useCallback(async () => {
        if (!currentVideoId || !trainingRecordId || trainingRecordId === 'preview') return;

        // 如果已有缓存的 URL，直接打开
        if (currentVideoUrl) {
            window.open(currentVideoUrl, '_blank');
            return;
        }

        // 否则从服务器获取
        try {
            const videos = await trainingService.getSetVideos({
                training_record_id: trainingRecordId
            });

            if (videos && Array.isArray(videos) && videos.length > 0) {
                const video = videos.find((v) => v.id === currentVideoId);
                if (video && video.video_url) {
                    setCurrentVideoUrl(video.video_url);
                    window.open(video.video_url, '_blank');
                } else {
                    showToast({ severity: 'warn', summary: '未找到视频' });
                }
            } else {
                showToast({ severity: 'warn', summary: '没有可用的视频' });
            }
        } catch (error) {
            console.error('获取视频失败:', error);
            showToast({ severity: 'error', summary: '获取视频失败' });
        }
    }, [currentVideoId, currentVideoUrl, trainingRecordId, showToast]);

    const renderActions = () => {
        if (set.status === 'completed' || set.status === 'skipped') {
            return (
                <div className="flex align-items-center gap-2">
                    {set.is_pr && showPR && (
                        <span className="flex align-items-center gap-1 text-orange-600 text-xs font-medium bg-orange-50 px-2 py-1 border-round">
                            <TrendingUp className="w-3 h-3" />
                            <span>PR</span>
                        </span>
                    )}

                    {set.status === 'completed' && !readOnly && (exerciseCategory === 'main' || exerciseCategory === 'accessory') && (
                        <Button
                            onClick={handleMarkBreakthrough}
                            disabled={disabled}
                            severity={set.is_breakthrough ? 'warning' : 'secondary'}
                            size="small"
                            icon={set.is_breakthrough ? <Award className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                            label={set.is_breakthrough ? '进步组' : '标记进步'}
                            tooltip={set.is_breakthrough ? '已标记为进步组！' : '标记为进步组✨'}
                            tooltipOptions={{ position: 'top' }}
                        />
                    )}

                    {showVideo && (
                        <>
                            {hasVideo ? (
                                <div className="flex align-items-center gap-1">
                                    <Button
                                        onClick={handleViewVideo}
                                        icon={<ExternalLink className="w-4 h-4" />}
                                        severity="info"
                                        size="small"
                                        label="查看视频"
                                        tooltip="在新窗口打开视频"
                                        tooltipOptions={{ position: 'top' }}
                                    />
                                    {!readOnly && (
                                        <Button
                                            onClick={handleDeleteVideo}
                                            icon={<X className="w-4 h-4" />}
                                            severity="danger"
                                            text
                                            size="small"
                                            tooltip="删除视频"
                                            tooltipOptions={{ position: 'top' }}
                                        />
                                    )}
                                </div>
                            ) : !readOnly && (
                                <Button
                                    onClick={() => setShowVideoUploader(true)}
                                    icon={<Upload className="w-4 h-4" />}
                                    severity="secondary"
                                    size="small"
                                    label="添加视频"
                                    tooltip="上传训练视频或粘贴链接"
                                    tooltipOptions={{ position: 'top' }}
                                />
                            )}
                        </>
                    )}

                    {onDelete && (
                        <Button
                            onClick={onDelete}
                            icon={<Trash2 className="w-4 h-4" />}
                            severity="danger"
                            text
                            size="small"
                            tooltip="删除这组"
                            tooltipOptions={{ position: 'top' }}
                        />
                    )}
                </div>
            );
        }

        if (isEditing) {
            return (
                <div className="flex align-items-center gap-1">
                    <Button
                        onClick={handleComplete}
                        label="保存"
                        size="small"
                        severity="info"
                    />
                    <Button
                        onClick={handleMarkCompleted}
                        label="完成"
                        size="small"
                        severity="success"
                    />
                    <Button
                        onClick={cancelEdit}
                        label="取消"
                        size="small"
                        severity="secondary"
                        outlined
                    />
                </div>
            );
        }

        if (readOnly) {
            return (
                <div className="text-sm text-surface-foreground">
                    只读🔒
                </div>
            );
        }

        return (
            <div className="flex align-items-center gap-1">
                <Button
                    onClick={startEditing}
                    disabled={disabled}
                    label="开始"
                    size="small"
                    severity="info"
                />
                <Button
                    onClick={handleSkip}
                    disabled={disabled}
                    label="跳过"
                    size="small"
                    severity="warning"
                />
                {onDelete && (
                    <Button
                        onClick={onDelete}
                        disabled={disabled}
                        icon={<Trash2 className="w-4 h-4" />}
                        severity="danger"
                        text
                        size="small"
                        tooltip="删除这组"
                        tooltipOptions={{ position: 'top' }}
                    />
                )}
            </div>
        );
    };

    return (
        <>
            <div
                className={`flex align-items-center justify-content-between p-3 border-round border-2 transition-all ${statusStyle.bg
                    } ${statusStyle.border} ${isEditing ? 'ring-2 ring-primary-300' : ''}`}
            >
                <div className="flex align-items-center gap-3">
                    {renderCheckbox()}

                    <div className="flex align-items-center gap-2">
                        <span className={`text-sm font-medium ${statusStyle.text}`}>
                            组{setIndex + 1}
                        </span>
                        {StatusIcon && (
                            <StatusIcon className={`w-4 h-4 ${statusStyle.iconColor}`} />
                        )}
                    </div>
                </div>

                <div className="flex-1 mx-4">
                    {renderParams()}
                </div>

                <div className="flex align-items-center gap-2">
                    {renderActions()}
                </div>
            </div>


            {/* 视频上传组件 */}
            <SetVideoUploader
                trainingRecordId={trainingRecordId}
                exerciseIndex={exerciseIndex}
                setIndex={setIndex}
                currentVideoId={currentVideoId}
                visible={showVideoUploader}
                onHide={() => setShowVideoUploader(false)}
                onUploadSuccess={handleVideoUploadSuccess}
            />
        </>
    );
};

export default SetItem;

