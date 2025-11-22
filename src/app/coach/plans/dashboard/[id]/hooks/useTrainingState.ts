/**
 * 训练状态管理 Hook
 * 
 * 管理训练执行过程中的所有状态和操作
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { trainingService } from '@/app/service/trainingService';
import type {
  TrainingRecord,
  ExerciseRecord,
  SetRecord,
  UseTrainingStateReturn
} from '@/types/training-execution';

export const useTrainingState = (
  userId: string,
  planId: string,
  weekNumber: number,
  dayNumber: number,
  readOnly: boolean = false
): UseTrainingStateReturn => {
  const [record, setRecord] = useState<TrainingRecord | null>(null);
  const [exercises, setExercises] = useState<ExerciseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const recordIdRef = useRef<string | null>(null);
  
  // 计算统计数据
  const stats = useCallback(() => {
    let totalSets = 0;
    let completedSets = 0;
    
    exercises.forEach(exercise => {
      totalSets += exercise.sets.length;
      completedSets += exercise.sets.filter(set => set.status === 'completed').length;
    });
    
    return {
      totalSets,
      completedSets,
      progress: totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0
    };
  }, [exercises]);
  
  const { totalSets, completedSets, progress } = stats();
  
  // 加载或创建训练记录
  useEffect(() => {
    loadOrCreateRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, planId, weekNumber, dayNumber, readOnly]);
  
  const loadOrCreateRecord = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (!userId || !planId) {
        throw new Error('缺少必要参数');
      }
      
      const today = new Date().toISOString().split('T')[0];
      
      // 使用 trainingService 获取训练记录
      const result = await trainingService.getTrainingRecord({
        training_plan_id: planId,
        week_number: weekNumber,
        day_number: dayNumber,
        training_date: today,
        read_only: readOnly
      });
      
      if (result?.record) {
        setRecord(result.record);
        setExercises(result.record.exercises || []);
        recordIdRef.current = result.record.id === 'preview' ? null : result.record.id;
      } else {
        setRecord(null);
        setExercises([]);
        recordIdRef.current = null;
      }
    } catch (err) {
      console.error('[useTrainingState] 加载训练记录失败:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };
  
  // 更新单组数据
  const updateSet = useCallback((
    exerciseIndex: number,
    setIndex: number,
    data: Partial<SetRecord>
  ) => {
    setExercises(prev => {
      const updated = [...prev];
      if (updated[exerciseIndex]?.sets[setIndex]) {
        updated[exerciseIndex].sets[setIndex] = {
          ...updated[exerciseIndex].sets[setIndex],
          ...data
        };
      }
      return updated;
    });
  }, []);
  
  // 标记完成
  const markComplete = useCallback(async (
    exerciseIndex: number,
    setIndex: number,
    data: SetRecord
  ) => {
    const completedData: SetRecord = {
      ...data,
      status: 'completed',
      completed_at: new Date().toISOString()
    };
    
    updateSet(exerciseIndex, setIndex, completedData);
  }, [updateSet]);
  
  // 跳过组
  const skipSet = useCallback(async (
    exerciseIndex: number,
    setIndex: number
  ) => {
    updateSet(exerciseIndex, setIndex, {
      status: 'skipped',
      completed_at: new Date().toISOString()
    });
  }, [updateSet]);
  
  // 添加组
  const addSet = useCallback((exerciseIndex: number) => {
    setExercises(prev => {
      const updated = prev.map((ex, idx) => {
        if (idx !== exerciseIndex) return ex;
        
        const lastSet = ex.sets[ex.sets.length - 1];
        const newSet: SetRecord = {
          set_index: ex.sets.length,
          planned_weight: lastSet?.planned_weight,
          planned_reps: lastSet?.planned_reps || '5',
          planned_rest_seconds: lastSet?.planned_rest_seconds || 180,
          status: 'pending',
          is_pr: false,
          is_breakthrough: false
        };
        
        return {
          ...ex,
          sets: [...ex.sets, newSet]
        };
      });
      
      return updated;
    });
  }, []);
  
  // 删除组
  const deleteSet = useCallback((exerciseIndex: number, setIndex: number) => {
    setExercises(prev => {
      const updated = prev.map((ex, idx) => {
        if (idx !== exerciseIndex) return ex;
        
        const newSets = ex.sets
          .filter((_, sIdx) => sIdx !== setIndex)
          .map((set, newIdx) => ({ ...set, set_index: newIdx }));
        
        return {
          ...ex,
          sets: newSets
        };
      });
      
      return updated;
    });
  }, []);
  
  // 更新动作笔记
  const updateExerciseNotes = useCallback((exerciseIndex: number, notes: string) => {
    setExercises(prev => {
      const updated = [...prev];
      if (updated[exerciseIndex]) {
        updated[exerciseIndex].notes = notes;
      }
      return updated;
    });
  }, []);
  
  // 保存记录
  const saveRecord = useCallback(async () => {
    if (!record) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const result = await trainingService.saveTrainingRecord({
        training_record_id: recordIdRef.current || undefined,
        training_plan_id: planId,
        week_number: weekNumber,
        day_number: dayNumber,
        training_date: today,
        exercises: exercises,
        status: 'in_progress'
      });
      
      if (result?.record) {
        recordIdRef.current = result.record.id;
        setRecord(result.record);
      }
      
      // 同时保存到localStorage作为备份
      localStorage.setItem(
        `training_cache_${userId}_${planId}_${today}`,
        JSON.stringify({ exercises, lastSaveTime: new Date().toISOString() })
      );
      
    } catch (err) {
      console.error('保存训练记录失败:', err);
      setError(err as Error);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [exercises, userId, planId, weekNumber, dayNumber, record]);
  
  // 完成训练
  const finishTraining = useCallback(async (notes?: string) => {
    if (!recordIdRef.current) return;
    
    setSaving(true);
    
    try {
      await trainingService.finishTraining({
        training_record_id: recordIdRef.current,
        notes
      });
      
      // 清除本地缓存
      const today = new Date().toISOString().split('T')[0];
      localStorage.removeItem(
        `training_cache_${userId}_${planId}_${today}`
      );
      
    } catch (err) {
      console.error('完成训练失败:', err);
      setError(err as Error);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [userId, planId]);
  
  // 放弃训练
  const abandonTraining = useCallback(async () => {
    if (!recordIdRef.current) return;
    
    setSaving(true);
    
    try {
      await trainingService.abandonTraining({
        training_record_id: recordIdRef.current
      });
      
      // 清除本地缓存
      const today = new Date().toISOString().split('T')[0];
      localStorage.removeItem(
        `training_cache_${userId}_${planId}_${today}`
      );
      
      recordIdRef.current = null;
      
    } catch (err) {
      console.error('放弃训练失败:', err);
      setError(err as Error);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [userId, planId]);
  
  return {
    record,
    exercises,
    loading,
    saving,
    error,
    currentExerciseIndex: 0,
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
  };
};
