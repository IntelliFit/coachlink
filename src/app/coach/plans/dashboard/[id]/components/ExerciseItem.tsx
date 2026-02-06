/**
 * ExerciseItem 组件 - 单个动作卡片
 * 
 * 显示一个完整的动作，包含所有组
 * 遵守 PrimeReact 规范和主题色系统
 */

'use client';

import React, { useState, forwardRef } from 'react';
import { ChevronDown, ChevronUp, Plus, StickyNote, Trophy, UserPlus } from 'lucide-react';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { Card } from 'primereact/card';
import { ProgressBar } from 'primereact/progressbar';
import { Toast } from 'primereact/toast';
import { trainingService } from '@/app/service/trainingService';
import SetItem from './SetItem';
import type { ExerciseItemProps } from '@/types/training-execution';
import { AeroInputNumber } from '@/components/AeroInputNumber';

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
    const [show1RM, setShow1RM] = useState(false);
    const [rm1Weight, setRm1Weight] = useState<number | null>(null);
    const [rm1Reps, setRm1Reps] = useState<number>(1);
    const [saving1RM, setSaving1RM] = useState(false);
    const toastRef = React.useRef<Toast>(null);

    const completedSets = exercise.sets.filter(set => set.status === 'completed').length;
    const totalSets = exercise.sets.length;
    const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

    const handleSaveNotes = () => {
        onUpdateNotes(notes);
        setShowNotes(false);
    };

    const handleSave1RM = async () => {
        if (!rm1Weight || rm1Weight <= 0) {
            toastRef.current?.show({
                severity: 'warn',
                summary: '提示',
                detail: '请输入有效的重量',
                life: 3000
            });
            return;
        }

        setSaving1RM(true);

        try {
            const result = await trainingService.save1RMRecord({
                exercise_name: exercise.exercise_name,
                max_weight: rm1Weight,
                max_reps: rm1Reps,
                notes: `第${exerciseIndex + 1}个动作的1RM记录`
            });

            if (result) {
                toastRef.current?.show({
                    severity: 'success',
                    summary: result.is_new_record ? '🎉 恭喜！' : '成功',
                    detail: result.is_new_record
                        ? '打破个人记录！继续保持！'
                        : '1RM记录已保存',
                    life: 3000
                });
                setShow1RM(false);
                setRm1Weight(null);
                setRm1Reps(1);
            } else {
                toastRef.current?.show({
                    severity: 'error',
                    summary: '错误',
                    detail: '保存失败，请重试',
                    life: 3000
                });
            }
        } catch (error) {
            console.error('保存1RM记录失败:', error);
            toastRef.current?.show({
                severity: 'error',
                summary: '错误',
                detail: '保存1RM记录失败，请重试',
                life: 3000
            });
        } finally {
            setSaving1RM(false);
        }
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
            className={`bg-surface border-round shadow-sm border overflow-hidden transition-all duration-300 ${isJustActivated
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
                            {(exercise as any).source === 'student_extra' && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs border-round font-medium">
                                    <UserPlus className="w-3 h-3" />
                                    学员添加
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

                    {/* 1RM 记录区域 - 只在非只读模式下显示 */}
                    {!readOnly && (
                        <div className="mt-4 pt-4 border-top-1 surface-border">
                            {show1RM ? (
                                <div className="space-y-3">
                                    <div className="flex align-items-center gap-2 mb-2">
                                        <Trophy className="w-5 h-5 text-yellow-500" />
                                        <h4 className="text-sm font-semibold text-900 m-0">记录 1RM</h4>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-600 mb-1">重量 (kg)</label>
                                            <AeroInputNumber
                                                value={rm1Weight}
                                                onValueChange={(e) => setRm1Weight(e.value)}
                                                mode="decimal"
                                                minFractionDigits={0}
                                                maxFractionDigits={2}
                                                min={0}
                                                placeholder="输入重量"
                                                className="w-full"
                                                disabled={saving1RM}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-600 mb-1">次数</label>
                                            <AeroInputNumber
                                                value={rm1Reps}
                                                onValueChange={(e) => setRm1Reps(e.value || 1)}
                                                mode="decimal"
                                                minFractionDigits={0}
                                                maxFractionDigits={0}
                                                min={1}
                                                placeholder="次数"
                                                className="w-full"
                                                disabled={saving1RM}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-content-end gap-2">
                                        <Button
                                            onClick={() => {
                                                setShow1RM(false);
                                                setRm1Weight(null);
                                                setRm1Reps(1);
                                            }}
                                            label="取消"
                                            outlined
                                            severity="secondary"
                                            size="small"
                                            disabled={saving1RM}
                                        />
                                        <Button
                                            onClick={handleSave1RM}
                                            label="保存记录"
                                            icon="pi pi-check"
                                            severity="success"
                                            size="small"
                                            loading={saving1RM}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <Button
                                    onClick={() => setShow1RM(true)}
                                    icon={<Trophy className="w-4 h-4" />}
                                    label="记录 1RM"
                                    text
                                    size="small"
                                    severity="warning"
                                />
                            )}
                        </div>
                    )}
                </div>
            )}

            <Toast ref={toastRef} />
        </div>
    );
});

ExerciseItem.displayName = 'ExerciseItem';

export default ExerciseItem;

