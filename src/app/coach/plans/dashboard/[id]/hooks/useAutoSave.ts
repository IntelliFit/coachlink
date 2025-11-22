/**
 * 自动保存 Hook
 * 
 * 提供自动保存功能，防止数据丢失
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { UseAutoSaveReturn } from '@/types/training-execution';

interface UseAutoSaveOptions {
  interval?: number; // 自动保存间隔（毫秒）
  enabled?: boolean; // 是否启用自动保存
  onSave?: () => Promise<void>; // 保存回调函数
  onError?: (error: Error) => void; // 错误回调
}

export const useAutoSave = (
  data: unknown,
  options: UseAutoSaveOptions = {}
): UseAutoSaveReturn => {
  const {
    interval = 10000, // 默认10秒
    enabled = true,
    onSave,
    onError
  } = options;
  
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isEnabled, setIsEnabled] = useState(enabled);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<string>(JSON.stringify(data));
  
  // 执行保存
  const save = useCallback(async () => {
    if (!onSave) return;
    
    setSaving(true);
    setError(null);
    
    try {
      await onSave();
      setLastSaved(new Date());
      lastDataRef.current = JSON.stringify(data);
    } catch (err) {
      const error = err as Error;
      console.error('自动保存失败:', error);
      setError(error);
      if (onError) {
        onError(error);
      }
    } finally {
      setSaving(false);
    }
  }, [data, onSave, onError]);
  
  // 强制保存
  const forceSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await save();
  }, [save]);
  
  // 启用自动保存
  const enableAutoSave = useCallback(() => {
    setIsEnabled(true);
  }, []);
  
  // 禁用自动保存
  const disableAutoSave = useCallback(() => {
    setIsEnabled(false);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
  }, []);
  
  // 监听数据变化，延迟保存
  useEffect(() => {
    if (!isEnabled) return;
    
    const currentData = JSON.stringify(data);
    const hasChanged = currentData !== lastDataRef.current;
    
    if (!hasChanged) return;
    
    // 清除之前的定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // 设置新的定时器
    saveTimeoutRef.current = setTimeout(() => {
      save();
    }, interval);
    
    // 清理函数
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [data, interval, isEnabled, save]);
  
  // 组件卸载时保存
  useEffect(() => {
    return () => {
      if (isEnabled && onSave) {
        const currentData = JSON.stringify(data);
        if (currentData !== lastDataRef.current) {
          try {
            localStorage.setItem('unsaved_training_data', currentData);
          } catch (error) {
            console.error('保存到localStorage失败:', error);
          }
        }
      }
    };
  }, [data, isEnabled, onSave]);
  
  // 页面关闭/刷新前保存
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentData = JSON.stringify(data);
      if (currentData !== lastDataRef.current && isEnabled) {
        try {
          localStorage.setItem('unsaved_training_data', currentData);
        } catch (error) {
          console.error('保存失败:', error);
        }
        
        e.preventDefault();
        e.returnValue = '有未保存的训练数据，确定要离开吗？';
        return e.returnValue;
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [data, isEnabled]);
  
  return {
    saving,
    lastSaved,
    error,
    forceSave,
    enableAutoSave,
    disableAutoSave
  };
};

