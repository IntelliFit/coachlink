/**
 * ExerciseItem 组件 - 单个动作卡片
 * 
 * 显示一个完整的动作，包含所有组
 * 遵守 PrimeReact 规范和主题色系统
 */

'use client';

import React, { useState, forwardRef } from 'react';
import { ChevronDown, ChevronUp, Plus, StickyNote } from 'lucide-react';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { Card } from 'primereact/card';
import { ProgressBar } from 'primereact/progressbar';
import SetItem from './SetItem';
import type { ExerciseItemProps } from '@/types/training-execution';

const ExerciseItem = forwardRef<HTMLDivElement, ExerciseItemProps>(({
  userId,
  trainingRecordId,
  exercise,
  exerciseIndex,
  onSetComplete,
  onSetSkip,
  onSetUpdate,
  onSetDelete,
  onAddSet,
  onUpdateNotes,
  expanded = true,
  onToggleExpand,
  readOnly = false
}, ref) => {
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(exercise.notes || '');
  
  const completedSets = exercise.sets.filter(set => set.status === 'completed').length;
  const totalSets = exercise.sets.length;
  const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
  
  const handleSaveNotes = () => {
    onUpdateNotes(notes);
    setShowNotes(false);
  };
  
  const isJustActivated = expanded && progress === 0 && completedSets === 0;
  
  const categoryLabels: Record<string, string> = {
    'main': '主项',
    'accessory': '副项',
    'warmup': '热身',
    'cooldown': '放松'
  };
  
  return (
    <div 
      ref={ref} 
      className={`bg-surface border-round shadow-sm border overflow-hidden transition-all duration-300 ${
        isJustActivated 
          ? 'border-primary ring-2 ring-primary-200' 
          : 'border-surface-border'
      }`}
    >
      <div className="p-4 bg-gradient-to-r from-primary-50 to-primary-100">
        <div className="flex align-items-center justify-content-between">
          <div className="flex-1">
            <div className="flex align-items-center gap-3">
              <h3 className="text-lg font-bold text-surface-foreground m-0">
                {exerciseIndex + 1}. {exercise.exercise_name}
              </h3>
              {exercise.exercise_category && (
                <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs border-round">
                  {categoryLabels[exercise.exercise_category] || exercise.exercise_category}
                </span>
              )}
            </div>
            
            <div className="mt-2">
              <div className="flex align-items-center justify-content-between text-sm text-surface-foreground mb-1">
                <span>{completedSets}/{totalSets} 组完成</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <ProgressBar value={progress} className="h-2" />
            </div>
          </div>
          
          {onToggleExpand && (
            <Button
              onClick={onToggleExpand}
              icon={expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              text
              rounded
              className="ml-4"
            />
          )}
        </div>
      </div>
      
      {expanded && (
        <div className="p-4">
          <div className="space-y-2">
            {exercise.sets.map((set, setIndex) => (
              <SetItem
                key={`ex-${exerciseIndex}-set-${setIndex}`}
                userId={userId}
                trainingRecordId={trainingRecordId}
                set={set}
                exerciseIndex={exerciseIndex}
                setIndex={setIndex}
                exerciseName={exercise.exercise_name}
                exerciseCategory={exercise.exercise_category}
                onComplete={(data) => onSetComplete(setIndex, data)}
                onSkip={() => onSetSkip(setIndex)}
                onUpdate={(data) => onSetUpdate(setIndex, data)}
                onDelete={
                  !readOnly && exercise.sets.length > 1
                    ? () => {
                        if (confirm('确定要删除这组吗？')) {
                          if (onSetDelete) {
                            onSetDelete(setIndex);
                          }
                        }
                      }
                    : undefined
                }
                readOnly={readOnly}
              />
            ))}
          </div>
          
          {!readOnly && (
            <Button
              onClick={onAddSet}
              label="添加一组"
              icon={<Plus className="w-4 h-4" />}
              outlined
              className="w-full mt-3"
              severity="secondary"
            />
          )}
          
          <div className="mt-4">
            {showNotes ? (
              <div className="space-y-2">
                <InputTextarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="记录这个动作的感受、技巧或注意事项..."
                  rows={3}
                  readOnly={readOnly}
                  disabled={readOnly}
                  className="w-full"
                />
                <div className="flex justify-content-end gap-2">
                  <Button
                    onClick={() => {
                      setNotes(exercise.notes || '');
                      setShowNotes(false);
                    }}
                    label="取消"
                    outlined
                    severity="secondary"
                    size="small"
                  />
                  <Button
                    onClick={handleSaveNotes}
                    label="保存笔记"
                    severity="info"
                    size="small"
                  />
                </div>
              </div>
            ) : (
              <Button
                onClick={() => setShowNotes(true)}
                icon={<StickyNote className="w-4 h-4" />}
                label={exercise.notes ? '编辑笔记' : '添加笔记'}
                text
                size="small"
              />
            )}
            
            {!showNotes && exercise.notes && (
              <div className="mt-2 p-3 bg-primary-50 border border-primary-200 border-round text-sm text-surface-foreground">
                📝 {exercise.notes}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

ExerciseItem.displayName = 'ExerciseItem';

export default ExerciseItem;

