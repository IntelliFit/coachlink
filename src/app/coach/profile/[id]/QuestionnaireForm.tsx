'use client';

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { RadioButton } from 'primereact/radiobutton';
import { Checkbox } from 'primereact/checkbox';
import { Skeleton } from 'primereact/skeleton';
import { InputNumber } from 'primereact/inputnumber';
import { planLibService } from '@/app/service/planLibService';
import { actionLibService } from '@/app/service/actionLibService';
import { useToastContext } from '@/context/ToastContext';
import type { TrainingItem } from '@/types/questionnaires';
import { CoachesRow, CoachSubscriptionRow, CoachActionRow } from '@/types';
import { subscriptionService } from '@/app/service/subscriptionService';
import { useSession } from 'next-auth/react';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';

interface QuestionnaireFormProps {
    coach: CoachesRow;
    visible: boolean;
    onHide: () => void;
    questions: TrainingItem[];
    onSubmit: (answers: TrainingItem[]) => void;
    loading: boolean;
}

const QuestionnaireForm: React.FC<QuestionnaireFormProps> = ({
    coach,
    visible,
    onHide,
    questions,
    onSubmit,
    loading
}) => {
    const { showToast } = useToastContext();
    const [answers, setAnswers] = useState<TrainingItem[]>(questions);
    const [tags, setTags] = useState<string[]>([]);
    const [loadingTags, setLoadingTags] = useState<boolean>(true);
    const [coachSubscription, setCoachSubscription] = useState<QueryCoachSubscription | null>(null);
    const [autoComputeActions, setAutoComputeActions] = useState<CoachActionRow[]>([]);
    const [loadingActions, setLoadingActions] = useState<boolean>(true);
    const { data: session } = useSession()

    useEffect(() => {
        setAnswers(questions);
        if (visible && questions) {
            loadSubscription();
        }
    }, [questions, visible]);

    useEffect(() => {
    }, [session?.user?.id, coach?.id]);

    useEffect(() => {
        if (!coach) {
            return;
        }

        const fetchTags = async () => {
            setLoadingTags(true);
            try {
                const res = await planLibService.getUniqueTemplateTags({
                    coachId: coach.id
                });
                if (res && res.tags) {
                    setTags(res.tags);
                }
            } catch (error) {
                console.error('获取训练标签失败:', error);
                setTags(['胸部训练', '背部训练', '腿部训练', '肩部训练', '手臂训练']);
            } finally {
                setLoadingTags(false);
            }
        };

        const fetchAutoComputeActions = async () => {
            setLoadingActions(true);
            try {
                const res = await actionLibService.listAutoComputeActions({
                    coachId: coach.user_id
                });
                if (res && res.actions) {
                    setAutoComputeActions(res.actions);
                }
            } catch (error) {
                console.error("获取自动计算动作失败:", error);
            } finally {
                setLoadingActions(false);
            }
        };

        if (visible) {
            fetchTags();
            fetchAutoComputeActions();
        }
    }, [visible, coach]);

    const loadSubscription = async () => {
        const res = await subscriptionService.getCoachSubscriptions({
            coachId: coach.id,
            studentId: session.user.id,
            onlyActive: false
        });

        if (res && res.subscriptions.length > 0) {
            setCoachSubscription(res.subscriptions[0]);
            const subscribeData = res.subscriptions[0].subscribe_data as unknown as TrainingItem[];
            const subscribeMap = new Map<string, any>();
            const makeKey = (item: { type: string; question?: string }) => {
                return item.question
                    ? `${item.type}::${item.question}`
                    : item.type;
            };

            subscribeData.forEach(item => {
                subscribeMap.set(makeKey(item), item);
            });

            const newAnswers = questions.map(item => {
                const key = makeKey(item);
                const sItem = subscribeMap.get(key);

                if (!sItem) return item;

                console.log(sItem);
                

                switch (item.type) {
                    case 'tags':
                        return {
                            ...item,
                            userSelections: sItem.userSelections,
                        };

                    case 'rm':
                        return {
                            ...item,
                            userInputs: sItem.userInputs,
                        };

                    case 'times':
                        return {
                            ...item,
                            userSelection: sItem.userSelection,
                        };

                    case 'option':
                        return {
                            ...item,
                            userSelection: sItem.userSelection,
                        };

                    case 'text':
                        return {
                            ...item,
                            userSelection: sItem.userSelection,
                        };

                    default:
                        return item;
                }
            });

            setAnswers(newAnswers);
        }
    }

    const updateAnswer = (questionIndex: number, value: any) => {
        setAnswers(prev => prev.map((item, idx) => {
            if (idx !== questionIndex) return item;
            switch (item.type) {
                case 'tags':
                    return { ...item, userSelections: value };
                case 'times':
                    return { ...item, userSelection: value };
                case 'rm':
                    return { ...item, userInputs: value };
                case 'option':
                    return { ...item, userSelection: value };
                case 'text':
                    return { ...item, userSelection: value };
                default:
                    return item;
            }
        }));
    };

    const handleSubmit = () => {
        // 验证: 对于每个问题，若为必填类型则检查

        for (let i = 0; i < questions.length; i++) {
            const q = answers[i];
            if (q.type === 'tags' && (!q.userSelections || q.userSelections.length === 0)) {
                showToast({ severity: 'error', summary: '提交失败', detail: `请填完 Q${i + 1}` });
                return;
            }
            if (q.type === 'times' && (![1, 2, 3, 4, 5, 6, 7].includes(q.userSelection))) {
                showToast({ severity: 'error', summary: '提交失败', detail: `请填完 Q${i + 1}` });
                return;
            }
            if (q.type === 'rm') {
                // RM 问题可以选填，不做强制验证
            }
            if (q.type === 'option' && (q.userSelection === undefined || q.userSelection === null)) {
                showToast({ severity: 'error', summary: '提交失败', detail: `请填完 Q${i + 1}` });
                return;
            }
            if (q.type === 'text' && !(q as any).userSelection && (typeof (q as any).userSelection !== 'string' || (q as any).userSelection?.trim() === '')) {
                showToast({ severity: 'error', summary: '提交失败', detail: `请填完 Q${i + 1}` });
                return;
            }
        }
        onSubmit(answers);
    };

    const renderQuestion = (question: TrainingItem, index: number) => {
        switch (question.type) {
            case 'tags':
                return (
                    <div className="mb-8" key={index}>
                        <label className="block text-sm font-medium mb-4">Q{index + 1}. 请选择您偏好的训练项目（可多选）</label>
                        {loadingTags ? (
                            <div className="flex flex-col gap-2">
                                {[1, 2, 3, 4, 5].map((_, i) => (
                                    <div key={i} className="flex align-items-center">
                                        <Skeleton width="20px" height="20px" className="mr-2" />
                                        <Skeleton width="100px" height="1rem" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {tags.map((tag, tagIndex) => (
                                    <div key={tagIndex} className="flex align-items-center">
                                        <Checkbox
                                            inputId={`tag${index}-${tagIndex}`}
                                            name={`tags${index}`}
                                            value={tag}
                                            onChange={(e) => {
                                                const currentTags = (question.userSelections || []);
                                                if (e.checked) {
                                                    updateAnswer(index, [...currentTags, tag]);
                                                } else {
                                                    updateAnswer(index, currentTags.filter((t: string) => t !== tag));
                                                }
                                            }}
                                            checked={(question.userSelections || []).includes(tag)}
                                        />
                                        <label htmlFor={`tag${index}-${tagIndex}`} className="ml-2 text-sm">{tag}</label>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );

            case 'times':
                return (
                    <div className="mb-8" key={index}>
                        <label className="block text-sm font-medium mb-2">Q{index + 1}. 您希望每周训练几次？</label>
                        <div className="flex flex-wrap gap-2">
                            {[1, 2, 3, 4, 5, 6, 7].map(num => (
                                <div key={num} className="flex items-center rounded px-3 py-2">
                                    <RadioButton
                                        inputId={`times${index}-${num}`}
                                        name={`times${index}`}
                                        value={num}
                                        onChange={(e) => updateAnswer(index, e.value)}
                                        checked={question.userSelection === num}
                                    />
                                    <label htmlFor={`times${index}-${num}`} className="ml-2 text-sm">{num}次</label>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'rm':
                return (
                    <div className="mb-8" key={index}>
                        <label className="block text-sm font-medium mb-4">Q{index + 1}. 请输入以下动作您的 1RM（极限重量）</label>
                        {loadingActions ? (
                            <div className="flex flex-col gap-3">
                                {[1, 2, 3].map((_, i) => (
                                    <div key={i} className="flex flex-column gap-2">
                                        <Skeleton width="100px" height="0.75rem" />
                                        <Skeleton width="150px" height="2rem" />
                                    </div>
                                ))}
                            </div>
                        ) : autoComputeActions && (
                            <div className="flex flex-col gap-4">
                                {autoComputeActions.map((action, actionIndex) => (
                                    <div key={actionIndex} className="flex flex-col">
                                        <label className="block text-xs text-600 mb-1">{action.name}</label>

                                        <InputNumber
                                            className='text-xs'
                                            showButtons
                                            min={0}
                                            suffix=' kg'
                                            value={(question.userInputs || {})[action.id] || 0}
                                            onValueChange={(e) => {
                                                const currentUserInputs = question.userInputs || {};
                                                const currentSelections = { ...currentUserInputs };
                                                updateAnswer(index, {
                                                    ...currentSelections,
                                                    [action.id]: e.value
                                                });
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );

            case 'option':
                return (
                    <div className="mb-8" key={index}>
                        <label className="block text-sm font-medium mb-4">Q{index + 1}. {question.question || `问题 ${index + 1}`}</label>
                        <div className="flex flex-col gap-4">
                            {question.options?.map((option, optionIndex) => (
                                <div key={optionIndex} className="flex items-center">
                                    <RadioButton
                                        inputId={`option${index}-${optionIndex}`}
                                        name={`option${index}`}
                                        value={optionIndex}
                                        onChange={(e) => updateAnswer(index, e.value)}
                                        checked={question.userSelection === optionIndex}
                                    />
                                    <label htmlFor={`option${index}-${optionIndex}`} className="ml-2 text-sm">{option}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'text':
            default:
                return (
                    <div className="mb-8" key={index}>
                        <label className="block text-sm font-medium mb-2">Q{index + 1}. {question.question}</label>
                        <InputTextarea
                            value={(question as any).userSelection || ''}
                            onChange={(e) => updateAnswer(index, e.target.value)}
                            className="w-full"
                            rows={3}
                        />
                    </div>
                );
        }
    };

    const footerContent = (
        <div className="flex justify-end gap-2">
            <Button
                label="取消"
                icon="pi pi-times"
                onClick={onHide}
                className="p-button-text"
                disabled={loading}
            />
            <Button
                label={coachSubscription ? '更新' : '确认'}
                icon="pi pi-check"
                onClick={handleSubmit}
                loading={loading}
                disabled={loading}
                className="p-button-primary"
            />
        </div>
    );

    return (
        <Dialog
            header="订阅问卷"
            visible={visible}
            onHide={onHide}
            footer={footerContent}
            draggable={false}
            resizable={false}
            modal
            className="w-full max-w-3xl"
        >
            <div className="p-4">
                <div className="mb-4 p-3 bg-primary-50 border-l-4 border-primary-500 rounded-r">
                    <p className="text-sm text-primary-800">
                        您填写的这些数据将更好帮助教练了解您的情况，并制定对应的计划。不同教练有自己独家的不同问卷。
                    </p>
                </div>

                <div className="space-y-4">
                    {answers.map((q, idx) => renderQuestion(q, idx))}
                </div>
            </div>
        </Dialog>
    );
};

export default QuestionnaireForm;