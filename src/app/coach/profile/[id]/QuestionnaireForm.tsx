'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { RadioButton } from 'primereact/radiobutton';
import { Checkbox } from 'primereact/checkbox';
import { Skeleton } from 'primereact/skeleton';
import { actionLibService } from '@/app/service/actionLibService';
import { trainingItemService } from '@/app/service/trainingItemService';
import { useToastContext } from '@/context/ToastContext';
import type { QuestionMedia, TrainingItem } from '@/types/questionnaires';
import { CoachesRow, CoachSubscriptionRow, CoachActionRow } from '@/types';
import { subscriptionService } from '@/app/service/subscriptionService';
import { useSession } from 'next-auth/react';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import { AeroInputNumber } from '@/components/AeroInputNumber';
import { Image } from 'primereact/image';

interface QuestionnaireFormProps {
    coach: CoachesRow;
    visible: boolean;
    onHide: () => void;
    questions: TrainingItem[];
    onSubmit: (answers: TrainingItem[]) => void;
    loading: boolean;
    existingAnswers?: TrainingItem[]; // 学员的历史答案，用于预填
}

const QuestionnaireForm: React.FC<QuestionnaireFormProps> = ({
    coach,
    visible,
    onHide,
    questions,
    onSubmit,
    loading,
    existingAnswers
}) => {
    const { showToast } = useToastContext();
    const [answers, setAnswers] = useState<TrainingItem[]>(questions);
    const [coachSubscription, setCoachSubscription] = useState<QueryCoachSubscription | null>(null);
    const [autoComputeActions, setAutoComputeActions] = useState<CoachActionRow[]>([]);
    const [loadingActions, setLoadingActions] = useState<boolean>(true);
    const [trainingItemNames, setTrainingItemNames] = useState<string[]>([]);
    const [loadingTrainingItems, setLoadingTrainingItems] = useState<boolean>(true);
    const { data: session } = useSession()

    // 示例媒体预览
    const [mediaDialogVisible, setMediaDialogVisible] = useState(false);
    const [mediaDialogTitle, setMediaDialogTitle] = useState<string>('');
    const [mediaDialogItems, setMediaDialogItems] = useState<QuestionMedia[]>([]);

    useEffect(() => {
        setAnswers(questions);
        if (visible && questions) {
            // 如果传入了 existingAnswers，直接使用，否则从订阅加载
            if (existingAnswers && existingAnswers.length > 0) {
                mergeExistingAnswers(existingAnswers);
            } else {
                loadSubscription();
            }
        }
    }, [questions, visible, existingAnswers]);

    useEffect(() => {
    }, [session?.user?.id, coach?.id]);

    useEffect(() => {
        if (!coach) {
            return;
        }

        const fetchTrainingItems = async () => {
            setLoadingTrainingItems(true);
            try {
                const res = await trainingItemService.listTrainingItems();
                const names = (res.trainingItems || []).map(it => it.name).filter(Boolean);
                setTrainingItemNames(names);
            } catch (e) {
                console.error('获取训练项目库失败:', e);
                setTrainingItemNames([]);
            } finally {
                setLoadingTrainingItems(false);
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
            fetchTrainingItems();
            fetchAutoComputeActions();
        }
    }, [visible, coach]);

    // 合并历史答案到问卷
    const mergeExistingAnswers = (subscribeData: TrainingItem[]) => {
        const subscribeMap = new Map<string, any>();
        const makeKey = (item: { id?: string; type: string; question?: string }) => {
            // 优先使用稳定 id
            if (item.id) return `id::${item.id}`;
            // 兼容旧数据：固定题型（单例）用 type；其余用 type+question
            if (item.type === 'tags' || item.type === 'times' || item.type === 'rm') return item.type;
            return item.question ? `${item.type}::${item.question}` : item.type;
        };

        subscribeData.forEach(item => {
            subscribeMap.set(makeKey(item), item);
        });

        const newAnswers = questions.map(item => {
            const key = makeKey(item);
            const sItem = subscribeMap.get(key);
            if (!sItem) return item;

            switch (item.type) {
                case 'tags':
                    return { ...item, userSelections: sItem.userSelections };
                case 'rm':
                    return { ...item, userInputs: sItem.userInputs };
                case 'times':
                case 'option':
                case 'text':
                    return { ...item, userSelection: sItem.userSelection };
                default:
                    return item;
            }
        });

        setAnswers(newAnswers);
    };

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
            const makeKey = (item: { id?: string; type: string; question?: string }) => {
                // 优先使用稳定 id
                if (item.id) return `id::${item.id}`;
                // 固定题型（单例）一律用 type 作为 key，避免题干变更导致无法匹配历史答案
                if (item.type === 'tags' || item.type === 'times' || item.type === 'rm') return item.type;
                return item.question ? `${item.type}::${item.question}` : item.type;
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

    const ensureMedia = (q: TrainingItem): QuestionMedia[] => Array.isArray((q as any).media) ? (q as any).media : [];

    const openMediaDialog = (title: string, items: QuestionMedia[]) => {
        setMediaDialogTitle(title);
        setMediaDialogItems(items);
        setMediaDialogVisible(true);
    };

    const idToIndex = useMemo(() => {
        const map = new Map<string, number>();
        answers.forEach((q, idx) => {
            if ((q as any).id) map.set((q as any).id, idx);
        });
        return map;
    }, [answers]);

    const isAnsweredForFlow = (q: TrainingItem): boolean => {
        switch (q.type) {
            case 'tags': {
                const configured = Array.isArray((q as any).options) && (q as any).options.length > 0;
                const fallbackReady = trainingItemNames.length > 0;
                if (!(configured || fallbackReady)) return true; // 没选项就不阻塞
                return Array.isArray((q as any).userSelections) && (q as any).userSelections.length > 0;
            }
            case 'times':
                return typeof (q as any).userSelection === 'number';
            case 'rm':
                return true; // 选填
            case 'option':
                return (q as any).userSelection !== undefined && (q as any).userSelection !== null;
            case 'text':
                return typeof (q as any).userSelection === 'string' && (q as any).userSelection.trim().length > 0;
            default:
                return true;
        }
    };

    const getNextIndex = (currentIndex: number): number | null => {
        const q = answers[currentIndex];
        const sequentialNext = currentIndex + 1 < answers.length ? currentIndex + 1 : null;

        // option / times 支持 branching
        const branching = (q as any)?.branching;
        if (branching) {
            const selection =
                q.type === 'option' ? (q as any).userSelection :
                    q.type === 'times' ? (q as any).userSelection :
                        undefined;

            let nextId: string | null | undefined = undefined;
            if (typeof selection === 'number' && branching?.rules && Object.prototype.hasOwnProperty.call(branching.rules, selection)) {
                nextId = branching.rules[selection];
            } else if (branching?.defaultNext !== undefined) {
                nextId = branching.defaultNext;
            }

            if (nextId === null) return null; // 结束
            if (typeof nextId === 'string') {
                const idx = idToIndex.get(nextId);
                return typeof idx === 'number' ? idx : null;
            }
        }

        // 显式 next（所有题型都支持）
        const explicitNext = (q as any)?.next;
        if (explicitNext === null) return null;
        if (typeof explicitNext === 'string') {
            const idx = idToIndex.get(explicitNext);
            return typeof idx === 'number' ? idx : null;
        }

        return sequentialNext;
    };

    const visibleIndices = useMemo(() => {
        if (!answers || answers.length === 0) return [];
        const path: number[] = [0];
        const visited = new Set<number>([0]);

        while (true) {
            const cur = path[path.length - 1];
            const curQ = answers[cur];

            if (!isAnsweredForFlow(curQ)) break;

            const next = getNextIndex(cur);
            if (next === null) break;
            if (next < 0 || next >= answers.length) break;
            if (visited.has(next)) break; // 防死循环

            visited.add(next);
            path.push(next);
        }

        return path;
    }, [answers, idToIndex, trainingItemNames]);

    const handleSubmit = () => {
        // 验证: 对于每个问题，若为必填类型则检查

        for (let displayIndex = 0; displayIndex < visibleIndices.length; displayIndex++) {
            const originalIndex = visibleIndices[displayIndex];
            const q = answers[originalIndex];
            if (q.type === 'tags') {
                const configured = Array.isArray((q as any).options) && (q as any).options.length > 0;
                const fallbackReady = trainingItemNames.length > 0;
                // 只有当“有可选项”时才强制要求选择；否则不阻塞提交（避免老数据/异常配置卡死）
                if ((configured || fallbackReady) && (!q.userSelections || q.userSelections.length === 0)) {
                    showToast({ severity: 'error', summary: '提交失败', detail: `请填完 Q${displayIndex + 1}` });
                    return;
                }
            }
            if (q.type === 'times' && (![1, 2, 3, 4, 5, 6, 7].includes(q.userSelection))) {
                showToast({ severity: 'error', summary: '提交失败', detail: `请填完 Q${displayIndex + 1}` });
                return;
            }
            if (q.type === 'rm') {
                // RM 问题可以选填，不做强制验证
            }
            if (q.type === 'option' && (q.userSelection === undefined || q.userSelection === null)) {
                showToast({ severity: 'error', summary: '提交失败', detail: `请填完 Q${displayIndex + 1}` });
                return;
            }
            if (q.type === 'text' && !(q as any).userSelection && (typeof (q as any).userSelection !== 'string' || (q as any).userSelection?.trim() === '')) {
                showToast({ severity: 'error', summary: '提交失败', detail: `请填完 Q${displayIndex + 1}` });
                return;
            }
        }
        // 仅提交当前路径上的问题，数组顺序即为“问题路径”
        const visibleAnswers = visibleIndices.map(i => answers[i]);
        onSubmit(visibleAnswers);
    };

    const renderQuestion = (question: TrainingItem, displayIndex: number, originalIndex: number) => {
        const medias = ensureMedia(question);
        const hasMedia = medias.length > 0;
        const questionTitle = question.type === 'tags'
            ? '训练项目偏好'
            : question.type === 'rm'
                ? '用户极限（1RM）'
                : (question as any).question || '问题';

        switch (question.type) {
            case 'tags':
                // 训练项目偏好选项库：优先使用问卷里配置的 options；缺失时兜底 training_items
                const tagOptions: string[] = Array.isArray((question as any).options) && (question as any).options.length > 0
                    ? (question as any).options
                    : trainingItemNames;
                return (
                    <div className="mb-8" key={originalIndex}>
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <label className="block text-sm font-medium">
                                Q{displayIndex + 1}. 请选择您偏好的训练项目（可多选）
                            </label>
                            {hasMedia && (
                                <Button
                                    label="查看示例"
                                    icon="pi pi-eye"
                                    size="small"
                                    text
                                    onClick={() => openMediaDialog(questionTitle, medias)}
                                />
                            )}
                        </div>
                        {loadingTrainingItems && (!Array.isArray((question as any).options) || (question as any).options.length === 0) ? (
                            <div className="flex flex-col gap-2">
                                {[1, 2, 3, 4, 5].map((_, i) => (
                                    <div key={i} className="flex align-items-center">
                                        <Skeleton width="20px" height="20px" className="mr-2" />
                                        <Skeleton width="120px" height="1rem" />
                                    </div>
                                ))}
                            </div>
                        ) : tagOptions.length > 0 ? (
                            <div className="flex flex-col gap-4">
                                {tagOptions.map((tag, tagIndex) => (
                                    <div key={tagIndex} className="flex align-items-center">
                                        <Checkbox
                                            inputId={`tag${originalIndex}-${tagIndex}`}
                                            name={`tags${originalIndex}`}
                                            value={tag}
                                            onChange={(e) => {
                                                const currentTags = (question.userSelections || []);
                                                if (e.checked) {
                                                    updateAnswer(originalIndex, [...currentTags, tag]);
                                                } else {
                                                    updateAnswer(originalIndex, currentTags.filter((t: string) => t !== tag));
                                                }
                                            }}
                                            checked={(question.userSelections || []).includes(tag)}
                                        />
                                        <label htmlFor={`tag${originalIndex}-${tagIndex}`} className="ml-2 text-sm">{tag}</label>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center p-4 bg-surface-50 rounded-lg border border-surface-200 text-surface-500 text-sm">
                                教练暂未配置训练项目选项
                            </div>
                        )}
                    </div>
                );

            case 'times':
                return (
                    <div className="mb-8" key={originalIndex}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <label className="block text-sm font-medium">
                                Q{displayIndex + 1}. {(question as any).question || '您希望每周训练几次？'}
                            </label>
                            {hasMedia && (
                                <Button
                                    label="查看示例"
                                    icon="pi pi-eye"
                                    size="small"
                                    text
                                    onClick={() => openMediaDialog(questionTitle, medias)}
                                />
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(
                                Array.isArray((question as any).options) && (question as any).options.length > 0
                                    ? (question as any).options
                                    : [1, 2, 3, 4, 5, 6, 7]
                            ).map((num: number) => (
                                <div key={num} className="flex items-center rounded px-3 py-2">
                                    <RadioButton
                                        inputId={`times${originalIndex}-${num}`}
                                        name={`times${originalIndex}`}
                                        value={num}
                                        onChange={(e) => updateAnswer(originalIndex, e.value)}
                                        checked={question.userSelection === num}
                                    />
                                    <label htmlFor={`times${originalIndex}-${num}`} className="ml-2 text-sm">{num}次</label>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'rm':
                const selectedActionIds: string[] = Array.isArray((question as any).actionIds) ? (question as any).actionIds : [];
                const rmActions = (autoComputeActions || []).filter(a => selectedActionIds.includes(a.id));
                return (
                    <div className="mb-8" key={originalIndex}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <label className="block text-sm font-medium">
                                Q{displayIndex + 1}. 请输入以下动作您的极限重量
                            </label>
                            {hasMedia && (
                                <Button
                                    label="查看示例"
                                    icon="pi pi-eye"
                                    size="small"
                                    text
                                    onClick={() => openMediaDialog(questionTitle, medias)}
                                />
                            )}
                        </div>
                        <p className="text-xs text-surface-500 mb-4">
                            💡 自重类动作（如引体向上）：这里填写<strong>额外负重</strong>（不含自重），可填负数表示需要辅助的重量
                        </p>
                        {loadingActions ? (
                            <div className="flex flex-col gap-3">
                                {[1, 2, 3].map((_, i) => (
                                    <div key={i} className="flex flex-column gap-2">
                                        <Skeleton width="100px" height="0.75rem" />
                                        <Skeleton width="150px" height="2rem" />
                                    </div>
                                ))}
                            </div>
                        ) : (rmActions && rmActions.length > 0) ? (
                            <div className="flex flex-col gap-4">
                                {rmActions.map((action, actionIndex) => {
                                    const isBodyWeightAction = action.includesBodyWeight;
                                    return (
                                        <div key={actionIndex} className="flex flex-col">
                                            <div className="flex items-center gap-2 mb-1">
                                                <label className="block text-xs text-600">{action.name}</label>
                                            </div>

                                            <AeroInputNumber
                                                className='text-xs'
                                                min={isBodyWeightAction ? -500 : 0}
                                                suffix=' kg'
                                                value={(question.userInputs || {})[action.id] ?? null}
                                                onValueChange={(e) => {
                                                    const currentUserInputs = question.userInputs || {};
                                                    const currentSelections = { ...currentUserInputs };
                                                    updateAnswer(originalIndex, {
                                                        ...currentSelections,
                                                        [action.id]: e.value
                                                    });
                                                }}
                                                placeholder={isBodyWeightAction ? '可填负数' : '请输入'}
                                            />
                                            {isBodyWeightAction && (
                                                <span className="text-[10px] text-surface-400 mt-1">
                                                    填写额外负重（不含自重）；负数表示需要辅助，如 -10 表示需10kg辅助
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center p-4 bg-surface-50 rounded-lg border border-surface-200 text-surface-500 text-sm">
                                教练暂未配置需要填写 RM 的动作
                            </div>
                        )}
                    </div>
                );

            case 'option':
                return (
                    <div className="mb-8" key={originalIndex}>
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <label className="block text-sm font-medium">
                                Q{displayIndex + 1}. {question.question || `问题 ${displayIndex + 1}`}
                            </label>
                            {hasMedia && (
                                <Button
                                    label="查看示例"
                                    icon="pi pi-eye"
                                    size="small"
                                    text
                                    onClick={() => openMediaDialog(questionTitle, medias)}
                                />
                            )}
                        </div>
                        <div className="flex flex-col gap-4">
                            {question.options?.map((option, optionIndex) => (
                                <div key={optionIndex} className="flex items-center">
                                    <RadioButton
                                        inputId={`option${originalIndex}-${optionIndex}`}
                                        name={`option${originalIndex}`}
                                        value={optionIndex}
                                        onChange={(e) => updateAnswer(originalIndex, e.value)}
                                        checked={question.userSelection === optionIndex}
                                    />
                                    <label htmlFor={`option${originalIndex}-${optionIndex}`} className="ml-2 text-sm">{option}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'text':
            default:
                return (
                    <div className="mb-8" key={originalIndex}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <label className="block text-sm font-medium">
                                Q{displayIndex + 1}. {question.question}
                            </label>
                            {hasMedia && (
                                <Button
                                    label="查看示例"
                                    icon="pi pi-eye"
                                    size="small"
                                    text
                                    onClick={() => openMediaDialog(questionTitle, medias)}
                                />
                            )}
                        </div>
                        <InputTextarea
                            value={(question as any).userSelection || ''}
                            onChange={(e) => updateAnswer(originalIndex, e.target.value)}
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
                className="p-button-text rounded-2xl"
                disabled={loading}
            />
            <Button
                label={coachSubscription ? '更新' : '确认'}
                icon="pi pi-check"
                onClick={handleSubmit}
                loading={loading}
                disabled={loading}
                className="p-button-primary rounded-2xl"
            />
        </div>
    );

    return (
        <Dialog
            id="guide-coach-questionnaire"
            header="订阅问卷"
            visible={visible}
            onHide={onHide}
            footer={footerContent}
            draggable={false}
            resizable={false}
            modal
            style={{ width: '650px' }}
                pt={{
                    root: {
                        className: 'shadow-none border-none bg-transparent min-h-screen md:min-h-[fit-content]'
                    },
                    header: {
                        className: 'p-8 pb-4 border-none bg-surface md:rounded-t-[24px] rounded-t-none'
                    },
                    content: {
                        className: 'text-xl font-black tracking-tight md:overflow-y-auto md:max-h-[calc(100vh-300px)]'
                    },
                    footer: {
                        className: 'p-8 md:rounded-b-[24px] rounded-b-none'
                    }
                }}
            className="w-full max-w-3xl"
        >
            <div className="p-1 md:p-4">
                {/* 问卷须知 */}
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <h4 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
                        <i className="pi pi-info-circle" />
                        填写须知
                    </h4>
                    <ul className="text-xs text-amber-700 space-y-1.5 list-disc list-inside">
                        <li>请如实填写您的训练情况，这将帮助教练为您制定更精准的计划</li>
                        <li><strong>关于极限重量（1RM）</strong>：指您在该动作下能完成1次的最大重量</li>
                        <li><strong>自重类动作</strong>（如引体向上、双杠臂屈伸等）：
                            <ul className="ml-4 mt-1 space-y-0.5">
                                <li>填写<strong>正数</strong>表示您能额外负重多少kg完成动作（不含自重）</li>
                                <li>填写<strong>负数</strong>表示您需要多少kg辅助（如使用辅助带减轻自重）才能完成动作</li>
                                <li>例如：填 <code className="bg-amber-100 px-1 rounded">-10</code> 表示需要10kg辅助</li>
                            </ul>
                        </li>
                    </ul>
                </div>

                <div className="mb-4 p-3 bg-primary-50 border-l-4 border-primary-500 rounded-r">
                    <p className="text-sm text-primary-800">
                        您填写的这些数据将更好帮助教练了解您的情况，并制定对应的计划。不同教练有自己独家的不同问卷。
                    </p>
                </div>

                <div className="space-y-4">
                    {visibleIndices.map((originalIndex, displayIndex) => (
                        <React.Fragment key={`q-${originalIndex}`}>
                            {renderQuestion(answers[originalIndex], displayIndex, originalIndex)}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* 示例媒体预览 */}
            <Dialog
                header={mediaDialogTitle || '示例'}
                visible={mediaDialogVisible}
                onHide={() => setMediaDialogVisible(false)}
                draggable={false}
                resizable={false}
                modal
                style={{ width: '92vw', maxWidth: '720px' }}
            >
                {mediaDialogItems.length === 0 ? (
                    <div className="text-sm text-surface-500">暂无示例媒体</div>
                ) : (
                    <div className="space-y-4">
                        {mediaDialogItems.map((m) => (
                            <div key={m.id} className="p-3 rounded border border-surface-200 bg-surface-0">
                                {m.caption && <div className="text-sm font-medium mb-2">{m.caption}</div>}
                                {m.type === 'image' ? (
                                    <Image src={m.url} alt={m.caption || '示例图片'} preview className="rounded border" />
                                ) : (
                                    <video src={m.url} controls className="w-full rounded border" />
                                )}
                                <div className="mt-2 text-[11px] text-surface-500 break-all">{m.url}</div>
                            </div>
                        ))}
                    </div>
                )}
            </Dialog>
        </Dialog>
    );
};

export default QuestionnaireForm;