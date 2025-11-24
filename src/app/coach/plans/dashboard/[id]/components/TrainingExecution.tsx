/**
 * TrainingExecution 组件 - 训练执行主组件
 * 
 * 整合所有训练执行功能的主界面
 * 遵守 PrimeReact 规范和主题色系统
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { Card } from 'primereact/card';
import { ProgressBar } from 'primereact/progressbar';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { useTrainingState } from '../hooks/useTrainingState';
import { useAutoSave } from '../hooks/useAutoSave';
import ExerciseItem from './ExerciseItem';
import RestTimer from './RestTimer';
import type { SetRecord, ExerciseRecord } from '@/types/training-execution';

interface TrainingExecutionProps {
  userId: string;
  planId: string;
  weekNumber: number;
  dayNumber: number;
  onBack: () => void;
  onFinish?: () => void;
  readOnly?: boolean;
}

const TrainingExecution: React.FC<TrainingExecutionProps> = ({
  userId,
  planId,
  weekNumber,
  dayNumber,
  onBack,
  onFinish,
  readOnly = false
}) => {
  const {
    record,
    exercises,
    loading,
    saving: stateSaving,
    error,
    completedSets,
    totalSets,
    progress,
    updateSet,
    markComplete,
    skipSet,
    addSet,
    deleteSet,
    updateExerciseNotes,
    saveRecord,
    finishTraining,
    abandonTraining
  } = useTrainingState(userId, planId, weekNumber, dayNumber, readOnly);
  
  const { saving: autoSaving, lastSaved } = useAutoSave(exercises, {
    interval: 10000,
    enabled: !readOnly,
    onSave: saveRecord
  });
  
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restDuration, setRestDuration] = useState(0);
  const [expandedExercises, setExpandedExercises] = useState<Set<number>>(new Set([0]));
  const [showSummary, setShowSummary] = useState(false);
  const [autoJumpNotification, setAutoJumpNotification] = useState<string | null>(null);
  const [justCompletedExercise, setJustCompletedExercise] = useState<number | null>(null);
  const [currentTrainingExercise, setCurrentTrainingExercise] = useState<number>(0);
  const [sessionNotes, setSessionNotes] = useState('');
  
  const exerciseRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pendingCheckRef = useRef<number | null>(null);
  
  const saving = stateSaving || autoSaving;
  
  const isPreview = readOnly && record?.id === 'preview';
  const isHistoryRecord = readOnly && (record?.id !== 'preview' && record?.id !== null);
  
  const isExerciseFullyCompleted = useCallback((exercise: ExerciseRecord): boolean => {
    if (!exercise.sets || exercise.sets.length === 0) return false;
    return exercise.sets.every(set => 
      set.status === 'completed' || set.status === 'skipped'
    );
  }, []);
  
  const scrollExerciseToCenter = useCallback((exerciseIndex: number) => {
    const element = exerciseRefs.current[exerciseIndex];
    if (!element) return;
    
    const elementRect = element.getBoundingClientRect();
    const absoluteElementTop = elementRect.top + window.pageYOffset;
    const middle = absoluteElementTop - (window.innerHeight / 2) + (elementRect.height / 2);
    
    window.scrollTo({
      top: middle,
      behavior: 'smooth'
    });
  }, []);
  
  useEffect(() => {
    if (readOnly || justCompletedExercise === null) return;
    
    const exerciseIndex = justCompletedExercise;
    const currentExercise = exercises[exerciseIndex];
    
    if (!currentExercise) {
      setJustCompletedExercise(null);
      return;
    }
    
    const isCompleted = isExerciseFullyCompleted(currentExercise);
    
    if (!isCompleted) {
      setJustCompletedExercise(null);
      return;
    }
    
    const nextExerciseIndex = exercises.findIndex((ex, idx) => 
      idx > exerciseIndex && !isExerciseFullyCompleted(ex)
    );
    
    if (nextExerciseIndex !== -1) {
      setAutoJumpNotification(`✅ 恭喜你，${currentExercise.exercise_name} 完成！`);
      setCurrentTrainingExercise(nextExerciseIndex);
      
      setExpandedExercises(prev => {
        const newSet = new Set(prev);
        newSet.delete(exerciseIndex);
        newSet.add(nextExerciseIndex);
        return newSet;
      });
      
      setTimeout(() => {
        scrollExerciseToCenter(nextExerciseIndex);
      }, 300);
      
      setTimeout(() => {
        setAutoJumpNotification(null);
      }, 3000);
    }
    
    setJustCompletedExercise(null);
  }, [exercises, justCompletedExercise, readOnly, isExerciseFullyCompleted, scrollExerciseToCenter]);
  
  const handleSetComplete = (exerciseIndex: number, setIndex: number, data: SetRecord) => {
    setCurrentTrainingExercise(exerciseIndex);
    markComplete(exerciseIndex, setIndex, data);
    
    if (data.planned_rest_seconds > 0) {
      setRestDuration(data.planned_rest_seconds);
      setRestTimerActive(true);
    } else {
      pendingCheckRef.current = exerciseIndex;
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (pendingCheckRef.current === exerciseIndex) {
            setJustCompletedExercise(exerciseIndex);
            pendingCheckRef.current = null;
          }
        }, 100);
      });
    }
  };
  
  const handleRestComplete = useCallback(() => {
    setRestTimerActive(false);
    pendingCheckRef.current = currentTrainingExercise;
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (pendingCheckRef.current === currentTrainingExercise) {
          setJustCompletedExercise(currentTrainingExercise);
          pendingCheckRef.current = null;
        }
      }, 100);
    });
  }, [currentTrainingExercise]);
  
  const handleRestSkip = useCallback(() => {
    setRestTimerActive(false);
    pendingCheckRef.current = currentTrainingExercise;
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (pendingCheckRef.current === currentTrainingExercise) {
          setJustCompletedExercise(currentTrainingExercise);
          pendingCheckRef.current = null;
        }
      }, 100);
    });
  }, [currentTrainingExercise]);
  
  const toggleExerciseExpand = (exerciseIndex: number) => {
    setExpandedExercises(prev => {
      const newSet = new Set(prev);
      if (newSet.has(exerciseIndex)) {
        newSet.delete(exerciseIndex);
      } else {
        newSet.add(exerciseIndex);
      }
      return newSet;
    });
  };
  
  const handleFinishTraining = async (notes?: string) => {
    if (completedSets < totalSets) {
      const remaining = totalSets - completedSets;
      if (!confirm(`还有 ${remaining} 组未完成，确定要结束训练吗？`)) {
        return;
      }
    }
    
    try {
      await finishTraining(notes);
      setShowSummary(true);
    } catch (err) {
      console.error('完成训练失败:', err);
      alert('完成训练失败，请重试');
    }
  };
  
  const handleAbandon = async () => {
    if (!confirm('确定要放弃本次训练吗？数据将不会保存。')) {
      return;
    }
    
    try {
      await abandonTraining();
      onBack();
    } catch (err) {
      console.error('放弃训练失败:', err);
      alert('操作失败，请重试');
    }
  };
  
  const formatLastSaved = (date: Date | null) => {
    if (!date) return '未保存';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return '刚刚保存';
    const minutes = Math.floor(diff / 60000);
    return `${minutes}分钟前保存`;
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex align-items-center justify-content-center bg-surface">
        <div className="text-center">
          <Skeleton width="4rem" height="4rem" shape="circle" className="mx-auto mb-4" />
          <Skeleton width="10rem" height="1.5rem" />
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex align-items-center justify-content-center bg-surface">
        <Card className="text-center max-w-md p-6">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-900 mb-2">加载失败</h2>
          <p className="text-600 mb-4">{error.message}</p>
          <Button
            onClick={onBack}
            label="返回"
            severity="info"
          />
        </Card>
      </div>
    );
  }
  
  if (showSummary) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex align-items-center justify-content-center p-4">
        <Card className="max-w-md w-full">
          <div className="text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold text-900 mb-2">训练完成！</h2>
            <p className="text-600 mb-6">恭喜你完成了今天的训练</p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card className="bg-green-50">
                <div className="text-3xl font-bold text-green-600">{completedSets}</div>
                <div className="text-sm text-600">完成组数</div>
              </Card>
              <Card className="bg-blue-50">
                <div className="text-3xl font-bold text-blue-600">{exercises.length}</div>
                <div className="text-sm text-600">训练动作</div>
              </Card>
            </div>
            
            <div className="flex flex-column gap-3">
              <Button
                onClick={() => {
                  if (onFinish) {
                    onFinish();
                  } else {
                    onBack();
                  }
                }}
                label="完成"
                severity="success"
                className="w-full"
              />
              <Button
                onClick={() => setShowSummary(false)}
                label="查看详情"
                outlined
                className="w-full"
              />
            </div>
          </div>
        </Card>
      </div>
    );
  }
  
  return (
    <>
      <ConfirmDialog />
      <div className="min-h-screen bg-surface">
        <div className="bg-surface shadow-sm border-bottom-1 surface-border sticky top-0 z-1">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex align-items-center justify-content-between">
              <Button
                onClick={onBack}
                icon={<ArrowLeft className="w-5 h-5" />}
                text
                label="返回"
              />
            
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold text-900 m-0">
                {isPreview ? '📋 训练计划' : isHistoryRecord ? '📖 历史记录' : `第${weekNumber}周 第${dayNumber}天`}
              </h1>
              <p className="text-sm text-500 mt-1 m-0">
                {readOnly 
                  ? `第${weekNumber}周 第${dayNumber}天 · ${completedSets}/${totalSets} 组${isPreview ? '' : '已完成'}`
                  : `${completedSets}/${totalSets} 组完成 · ${Math.round(progress)}%`
                }
              </p>
            </div>
            
            <div className="flex align-items-center gap-2">
              {readOnly ? (
                <span className="px-3 py-1 bg-surface text-600 border-round text-sm font-medium">
                  只读🔒
                </span>
              ) : saving ? (
                <div className="flex align-items-center gap-2 text-primary">
                  <i className="pi pi-spin pi-spinner"></i>
                  <span className="text-sm">保存中</span>
                </div>
              ) : (
                <div className="flex align-items-center gap-2 text-500">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">{formatLastSaved(lastSaved)}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-3">
            <ProgressBar value={progress} className="h-2" />
          </div>
        </div>
      </div>
      
      {record?.notes && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <Card className="bg-amber-50 border-amber-200 mb-4">
            <div className="flex align-items-start gap-3">
              <div className="text-2xl">📝</div>
              <div>
                <h3 className="font-semibold text-amber-900 mb-1 m-0">训练提示</h3>
                <p className="text-sm text-amber-800 m-0 white-space-pre-wrap">{record.notes}</p>
              </div>
            </div>
          </Card>
        </div>
      )}
      
      {readOnly && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <Card className={`${isPreview ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200'} mb-4`}>
            <div className="flex align-items-center gap-3">
              <div className="text-2xl">{isPreview ? '📋' : 'ℹ️'}</div>
              <div>
                <h3 className={`font-semibold ${isPreview ? 'text-purple-900' : 'text-blue-900'} m-0`}>
                  {isPreview ? '训练计划查看模式' : '历史记录查看模式'}
                </h3>
                <p className={`text-sm ${isPreview ? 'text-purple-700' : 'text-blue-700'} mt-1 m-0`}>
                  {isPreview 
                    ? '您正在查看未来的训练计划，所有内容为只读状态，无法修改。'
                    : '您正在查看过去的训练记录，所有内容为只读状态，无法修改。'
                  }
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto px-4 py-6 pb-32">
        <div className="space-y-4">
          {exercises.map((exercise, index) => (
            <ExerciseItem
              key={index}
              ref={(el) => (exerciseRefs.current[index] = el)}
              userId={userId}
              trainingRecordId={record?.id || 'preview'}
              exercise={exercise}
              exerciseIndex={index}
              onSetComplete={(setIndex, data) => handleSetComplete(index, setIndex, data)}
              onSetSkip={(setIndex) => skipSet(index, setIndex)}
              onSetUpdate={(setIndex, data) => updateSet(index, setIndex, data)}
              onSetDelete={(setIndex) => deleteSet(index, setIndex)}
              onAddSet={() => addSet(index)}
              onUpdateNotes={(notes) => updateExerciseNotes(index, notes)}
              expanded={expandedExercises.has(index)}
              onToggleExpand={() => toggleExerciseExpand(index)}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>
      
      {!readOnly && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface border-top-1 surface-border shadow-lg">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="grid gap-3">
              {/* 训练备注输入 */}
              <div>
                <label className="text-xs text-600 block mb-1">训练备注</label>
                <input
                  type="text"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="记录感受..."
                  className="w-full p-2 border border-surface-border rounded-md text-sm"
                />
              </div>
              
              {/* 按钮行 */}
              <div className="flex align-items-center justify-content-between gap-3">
                <Button
                  onClick={handleAbandon}
                  label="放弃"
                  severity="danger"
                  text
                />
                
                <div className="flex-1 text-center">
                  <div className="text-sm text-600">
                    已完成 {completedSets}/{totalSets} 组
                  </div>
                  <div className="text-xs text-500 mt-1">
                    {progress === 100 ? '全部完成！' : `还剩 ${totalSets - completedSets} 组`}
                  </div>
                </div>
                
                <Button
                  onClick={() => handleFinishTraining(sessionNotes)}
                  disabled={completedSets === 0}
                  label="完成训练"
                  icon={<CheckCircle className="w-5 h-5" />}
                  severity="success"
                />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {restTimerActive && (
        <RestTimer
          seconds={restDuration}
          onComplete={handleRestComplete}
          onSkip={handleRestSkip}
          autoStart={true}
        />
      )}
      
      {autoJumpNotification && (
        <div className="fixed top-20 left-50 transform -translate-x-50 z-5 animate-bounce">
          <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4 shadow-2xl flex align-items-center gap-3 border-2 border-white">
            <span className="text-2xl">🎯</span>
            <span className="font-semibold text-lg">{autoJumpNotification}</span>
          </Card>
        </div>
      )}
      </div>
    </>
  );
};

export default TrainingExecution;

