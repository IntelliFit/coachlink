/**
 * RestTimer 组件 - 休息计时器
 * 
 * 显示休息倒计时，并提供控制功能
 */

'use client';

import React, { useEffect } from 'react';
import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react';
import { useRestTimer } from '../hooks/useRestTimer';
import type { RestTimerProps } from '@/types/training-execution';

const RestTimer: React.FC<RestTimerProps> = ({
  seconds,
  onComplete,
  onSkip,
  autoStart = true
}) => {
  const {
    timeLeft,
    isRunning,
    isPaused,
    isCompleted,
    start,
    pause,
    resume,
    reset,
    skip
  } = useRestTimer(seconds);
  
  // 自动开始
  useEffect(() => {
    if (autoStart) {
      start();
    }
  }, [autoStart, start]);
  
  // 完成时回调
  useEffect(() => {
    if (isCompleted) {
      onComplete();
    }
  }, [isCompleted, onComplete]);
  
  // 格式化时间显示
  const formatTime = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // 计算进度百分比
  const progress = seconds > 0 ? ((seconds - timeLeft) / seconds) * 100 : 0;
  
  // 获取颜色（根据剩余时间）
  const getColor = () => {
    const percentage = (timeLeft / seconds) * 100;
    if (percentage > 60) return 'text-green-600';
    if (percentage > 30) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  const handleSkip = () => {
    skip();
    if (onSkip) {
      onSkip();
    }
  };
  
  if (isCompleted) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
        <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4">
          <div className="text-center">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-2xl font-bold text-green-600 mb-2">
              休息结束！
            </h3>
            <p className="text-gray-600 mb-6">
              准备好开始下一组了吗？
            </p>
            <button
              onClick={onComplete}
              className="w-full py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
            >
              开始训练
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4">
        {/* 标题 */}
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">休息时间</h3>
          <p className="text-sm text-gray-500 mt-1">
            恢复体力，准备下一组
          </p>
        </div>
        
        {/* 圆形进度条 */}
        <div className="relative w-48 h-48 mx-auto mb-6">
          {/* 背景圆 */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="88"
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="8"
            />
            {/* 进度圆 */}
            <circle
              cx="96"
              cy="96"
              r="88"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 88}`}
              strokeDashoffset={`${2 * Math.PI * 88 * (1 - progress / 100)}`}
              className={`transition-all duration-1000 ${getColor()}`}
            />
          </svg>
          
          {/* 时间显示 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-5xl font-bold ${getColor()}`}>
              {formatTime(timeLeft)}
            </div>
            <div className="text-sm text-gray-500 mt-2">
              {Math.round(progress)}%
            </div>
          </div>
        </div>
        
        {/* 控制按钮 */}
        <div className="flex items-center justify-center space-x-3">
          {/* 开始/暂停 */}
          {isRunning ? (
            <button
              onClick={pause}
              className="w-14 h-14 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center hover:bg-yellow-200 transition-colors"
              title="暂停"
            >
              <Pause className="w-6 h-6" />
            </button>
          ) : (
            <button
              onClick={isPaused ? resume : start}
              className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200 transition-colors"
              title={isPaused ? '继续' : '开始'}
            >
              <Play className="w-6 h-6" />
            </button>
          )}
          
          {/* 重置 */}
          <button
            onClick={reset}
            className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition-colors"
            title="重置"
          >
            <RotateCcw className="w-6 h-6" />
          </button>
          
          {/* 跳过 */}
          <button
            onClick={handleSkip}
            className="w-14 h-14 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"
            title="跳过"
          >
            <SkipForward className="w-6 h-6" />
          </button>
        </div>
        
        {/* 提示文字 */}
        <div className="mt-6 text-center text-sm text-gray-500">
          {isPaused ? (
            <p>⏸️ 已暂停</p>
          ) : isRunning ? (
            <p>⏱️ 计时中...</p>
          ) : (
            <p>点击开始按钮开始休息</p>
          )}
        </div>
        
        {/* 快速完成按钮（可选） */}
        <button
          onClick={handleSkip}
          className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          跳过休息，立即开始
        </button>
      </div>
    </div>
  );
};

export default RestTimer;

