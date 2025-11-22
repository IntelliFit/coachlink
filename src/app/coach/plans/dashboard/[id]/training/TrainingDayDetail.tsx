/**
 * TrainingDayDetail 组件 - 训练日详情弹窗
 * 
 * 显示训练日的完整信息
 */

'use client';

import React from 'react';
import { X, Zap, Check, Clock, Target } from 'lucide-react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';

interface TrainingDayDetailProps {
  dayDetail: {
    week_number: number;
    day_of_week: string;
    session_focus: string;
    main_exercises: any[];
    accessory_exercises: any[];
    warmup?: any[];
    cooldown?: any[];
    notes?: string;
  };
  visible: boolean;
  onClose: () => void;
}

const TrainingDayDetail: React.FC<TrainingDayDetailProps> = ({ dayDetail, visible, onClose }) => {
  const dayMap: Record<string, string> = {
    'Mon': '周一',
    'Tue': '周二',
    'Wed': '周三',
    'Thu': '周四',
    'Fri': '周五',
    'Sat': '周六',
    'Sun': '周日'
  };

  const renderExerciseList = (exercises: any[], title: string, icon: React.ReactNode, bgColor: string) => {
    if (!exercises || exercises.length === 0) return null;

    return (
      <div className="mb-6">
        <h4 className="text-lg font-semibold text-surface-foreground flex items-center mb-3">
          {icon}
          <span className="ml-2">{title}</span>
        </h4>
        <div className="space-y-3">
          {exercises.map((exercise: any, idx: number) => (
            <div key={idx} className={`${bgColor} rounded-lg p-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-surface-foreground">{exercise.name || exercise.exercise_name || '未命名动作'}</span>
                {(exercise.sets || exercise.reps) && (
                  <span className="text-sm font-medium text-surface-foreground bg-surface px-3 py-1 rounded-full">
                    {exercise.sets}组 × {exercise.reps}次
                  </span>
                )}
              </div>
              
              {/* 负重信息 */}
              {exercise.load_value && (
                <div className="text-sm text-surface-foreground mb-1">
                  <span className="font-medium">负重:</span> {exercise.load_value}kg
                  {exercise.load_type && <span className="text-surface-foreground opacity-70"> ({exercise.load_type})</span>}
                </div>
              )}
              
              {/* 节奏和暂停 */}
              {(exercise.tempo || exercise.pause) && (
                <div className="text-sm text-surface-foreground mb-1">
                  {exercise.tempo && <span className="mr-3"><span className="font-medium">节奏:</span> {exercise.tempo}</span>}
                  {exercise.pause && <span><span className="font-medium">暂停:</span> {exercise.pause}秒</span>}
                </div>
              )}
              
              {/* 休息时间 */}
              {exercise.rest_sec && (
                <div className="text-sm text-surface-foreground mb-1 flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  <span>休息 {exercise.rest_sec}秒</span>
                </div>
              )}
              
              {/* 备注 */}
              {exercise.notes && (
                <div className="text-sm text-surface-foreground opacity-80 mt-2 p-2 bg-surface bg-opacity-60 rounded">
                  💡 {exercise.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const header = (
    <div className="bg-gradient-to-r from-primary to-primary-600 text-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-1">
            第 {dayDetail.week_number} 周 {dayMap[dayDetail.day_of_week] || dayDetail.day_of_week}
          </h2>
          <p className="text-primary-100">{dayDetail.session_focus || '训练日'}</p>
        </div>
        <Button
          onClick={onClose}
          icon={<X className="w-6 h-6" />}
          text
          rounded
          className="text-white hover:bg-white hover:bg-opacity-20"
          tooltip="关闭"
          tooltipOptions={{ position: 'left' }}
        />
      </div>
    </div>
  );

  const footer = (
    <Button
      onClick={onClose}
      label="关闭"
      className="w-full"
      severity="info"
    />
  );

  return (
    <Dialog
      visible={visible}
      onHide={onClose}
      header={header}
      footer={footer}
      className="w-full max-w-4xl"
      modal
      dismissableMask
    >
      <div className="flex-1 overflow-y-auto p-6">
        {/* 训练重点说明 */}
        {dayDetail.notes && (
          <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
            <h4 className="font-semibold text-yellow-900 mb-2">📋 训练重点</h4>
            <p className="text-yellow-800">{dayDetail.notes}</p>
          </div>
        )}

        {/* 热身 */}
        {renderExerciseList(
          dayDetail.warmup || [],
          '热身',
          <Target className="w-5 h-5 text-orange-500" />,
          'bg-orange-50'
        )}

        {/* 主项训练 */}
        {renderExerciseList(
          dayDetail.main_exercises || [],
          '主项训练',
          <Zap className="w-5 h-5 text-yellow-500" />,
          'bg-yellow-50'
        )}

        {/* 辅项训练 */}
        {renderExerciseList(
          dayDetail.accessory_exercises || [],
          '辅助训练',
          <Check className="w-5 h-5 text-green-500" />,
          'bg-green-50'
        )}

        {/* 放松 */}
        {renderExerciseList(
          dayDetail.cooldown || [],
          '放松/拉伸',
          <Target className="w-5 h-5 text-blue-500" />,
          'bg-blue-50'
        )}

        {/* 空状态 */}
        {(!dayDetail.main_exercises || dayDetail.main_exercises.length === 0) &&
         (!dayDetail.accessory_exercises || dayDetail.accessory_exercises.length === 0) && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-surface-foreground opacity-50" />
            </div>
            <p className="text-surface-foreground">该训练日暂无训练内容</p>
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default TrainingDayDetail;


