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
        const makeKey = (item: { id?: string; type: string; question?: string }) => {
            // 优先使用稳定 id
            if (item.id) return `id::${item.id}`;
            // 兼容旧数据：固定题型（单例）用 type；其余用 type+question
            if (item.type === 'tags' || item.type === 'times' || item.type === 'rm') return item.type;
            return item.question ? `${item.type}::${item.question}` : item.type;
        };

        const byKey = new Map<string, any>();
        const byOptionsKey = new Map<string, any>();
        const byTypeList = new Map<string, any[]>();
        const used = new Set<any>();

        subscribeData.forEach(item => {
            byKey.set(makeKey(item), item);
            if (item.type === 'option' && Array.isArray((item as any).options) && (item as any).options.length > 0) {
                const optKey = `opt::${(item as any).options.join('|')}`;
                if (!byOptionsKey.has(optKey)) byOptionsKey.set(optKey, item);
            }
            const list = byTypeList.get(item.type) || [];
            list.push(item);
            byTypeList.set(item.type, list);
        });

        const typeCursor = new Map<string, number>();
        const takeByTypeOrder = (type: string) => {
            const list = byTypeList.get(type) || [];
            let idx = typeCursor.get(type) || 0;
            while (idx < list.length && used.has(list[idx])) idx++;
            if (idx < list.length) {
                typeCursor.set(type, idx + 1);
                used.add(list[idx]);
                return list[idx];
            }
            return undefined;
        };

        const resolveAnswer = (item: TrainingItem) => {
            const key = makeKey(item);
            if (byKey.has(key)) {
                const s = byKey.get(key);
                used.add(s);
                return s;
            }
            if (item.type === 'option' && Array.isArray((item as any).options) && (item as any).options.length > 0) {
                const optKey = `opt::${(item as any).options.join('|')}`;
                if (byOptionsKey.has(optKey)) {
                    const s = byOptionsKey.get(optKey);
                    used.add(s);
                    return s;
                }
            }
            // 兜底：按题型顺序匹配（适用于“题干改了但顺序未变”的场景）
            return takeByTypeOrder(item.type);
        };

        const newAnswers = questions.map(item => {
            const sItem = resolveAnswer(item);
            if (!sItem) return item;

            switch (item.type) {
                case 'tags':
                    return { ...item, userSelections: sItem.userSelections };
                case 'rm':
                    return { ...item, userInputs: sItem.userInputs };
                case 'times':
                    return { ...item, userSelection: sItem.userSelection };
                case 'option':
                    return {
                        ...item,
                        userSelection: sItem.userSelection,
                        userSelections: (sItem as any).userSelections,
                        userOtherText: (sItem as any).userOtherText,
                    };
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
            // 复用同一套合并策略，避免“改题干/顺序后答案丢失”
            mergeExistingAnswers(subscribeData as any);
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
                    return { ...item, ...value };
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

    const getOptionSelectionMode = (question: TrainingItem) =>
        (question as any).selectionMode === 'multiple' ? 'multiple' : 'single';

    const isOptionAnswered = (question: TrainingItem) => {
        if (question.type !== 'option') return true;
        const selectionMode = getOptionSelectionMode(question);
        const allowOther = Boolean((question as any).allowOther);
        const otherText = String((question as any).userOtherText || '').trim();

        if (selectionMode === 'multiple') {
            const selected = Array.isArray((question as any).userSelections) ? (question as any).userSelections : [];
            const hasOther = selected.includes(-1);
            if (selected.length === 0) return false;
            if (allowOther && hasOther) return otherText.length > 0;
            return true;
        }

        const selected = (question as any).userSelection;
        if (selected === undefined || selected === null) return false;
        if (allowOther && selected === -1) return otherText.length > 0;
        return true;
    };

    const idToIndex = useMemo(() => {
        const map = new Map<string, number>();
        answers.forEach((q, idx) => {
            if ((q as any).id) map.set((q as any).id, idx);
        });
        return map;
    }, [answers]);

    /**
     * 分支子树判定：
     * - 被 branching 指向的节点（rules/defaultNext）视为“分支入口”
     * - 从这些入口出发，通过显式 next / branching 边可达的都视为“分支子树”
     *
     * 目的：避免分支路径走完后，因“数组顺序兜底”串到别的分支/重复题。
     */
    const branchSubtreeIds = useMemo(() => {
        const byId = new Map<string, TrainingItem>();
        answers.forEach((q: any) => q?.id && byId.set(q.id, q));

        const adj = new Map<string, Set<string>>();
        const addAdj = (from: any, to: any) => {
            if (!from || !to) return;
            if (typeof from !== 'string' || typeof to !== 'string') return;
            if (!adj.has(from)) adj.set(from, new Set());
            adj.get(from)!.add(to);
        };

        const branchTargets = new Set<string>();

        // Build adjacency from explicit next + branching edges
        for (const q of answers as any[]) {
            const fromId = q?.id;
            if (!fromId) continue;

            // explicit next
            if (typeof q.next === 'string') addAdj(fromId, q.next);

            const b = q.branching || {};
            if (typeof b.defaultNext === 'string') {
                branchTargets.add(b.defaultNext);
                addAdj(fromId, b.defaultNext);
            }

            // tags 不支持 rules；其它题型允许 rules
            if (q.type !== 'tags' && b.rules && typeof b.rules === 'object') {
                Object.values(b.rules).forEach((v: any) => {
                    if (typeof v === 'string') {
                        branchTargets.add(v);
                        addAdj(fromId, v);
                    }
                });
            }
        }

        // BFS from branchTargets to collect subtree
        const subtree = new Set<string>();
        const queue = Array.from(branchTargets);
        while (queue.length > 0) {
            const cur = queue.shift()!;
            if (subtree.has(cur)) continue;
            subtree.add(cur);
            const outs = adj.get(cur);
            if (!outs) continue;
            outs.forEach((n) => {
                if (!subtree.has(n)) queue.push(n);
            });
        }

        return subtree;
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
                return isOptionAnswered(q);
            case 'text':
                return typeof (q as any).userSelection === 'string' && (q as any).userSelection.trim().length > 0;
            default:
                return true;
        }
    };

    const getNextIndex = (currentIndex: number): number | null => {
        const q = answers[currentIndex];
        const sequentialNext = currentIndex + 1 < answers.length ? currentIndex + 1 : null;

        // tags / option / times 支持 branching
        const branching = (q as any)?.branching;
        if (branching) {
            const selection =
                q.type === 'option' && getOptionSelectionMode(q) === 'single' ? (q as any).userSelection :
                    q.type === 'times' ? (q as any).userSelection :
                        undefined;

            let nextId: string | null | undefined = undefined;
            // tags 是多选题：当前仅支持 defaultNext（不支持 rules）
            if (q.type === 'tags') {
                if (branching?.defaultNext !== undefined) {
                    nextId = branching.defaultNext;
                }
            } else if (typeof selection === 'number' && branching?.rules && Object.prototype.hasOwnProperty.call(branching.rules, selection)) {
                nextId = branching.rules[selection];
            } else if (branching?.defaultNext !== undefined) {
                nextId = branching.defaultNext;
            }

            if (nextId === null) {
                return null; // 结束
            }
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

        // 兜底顺序：
        // - 主干（非分支子树）沿数组顺序前进（兼容旧数据/简单线性问卷）
        // - 分支子树里的节点如果没有显式 next，则默认结束（避免串到别的分支/重复题）
        const selfId = (q as any)?.id as string | undefined;
        if (selfId && branchSubtreeIds.has(selfId)) {
            return null;
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
            if (q.type === 'option' && !isOptionAnswered(q)) {
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
                const selectionMode = getOptionSelectionMode(question);
                const allowOther = Boolean((question as any).allowOther);
                const selectedOptions = Array.isArray((question as any).userSelections) ? (question as any).userSelections : [];
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
                                    {selectionMode === 'multiple' ? (
                                        <Checkbox
                                            inputId={`option${originalIndex}-${optionIndex}`}
                                            checked={selectedOptions.includes(optionIndex)}
                                            onChange={(e) => {
                                                const nextSelections = Boolean(e.checked)
                                                    ? Array.from(new Set([...selectedOptions, optionIndex]))
                                                    : selectedOptions.filter((value) => value !== optionIndex);
                                                updateAnswer(originalIndex, {
                                                    userSelections: nextSelections,
                                                });
                                            }}
                                        />
                                    ) : (
                                        <RadioButton
                                            inputId={`option${originalIndex}-${optionIndex}`}
                                            name={`option${originalIndex}`}
                                            value={optionIndex}
                                            onChange={(e) => updateAnswer(originalIndex, {
                                                userSelection: e.value,
                                            })}
                                            checked={question.userSelection === optionIndex}
                                        />
                                    )}
                                    <label htmlFor={`option${originalIndex}-${optionIndex}`} className="ml-2 text-sm">{option}</label>
                                </div>
                            ))}
                            {allowOther && (
                                <div className="space-y-2">
                                    <div className="flex items-center">
                                        {selectionMode === 'multiple' ? (
                                            <Checkbox
                                                inputId={`option${originalIndex}-other`}
                                                checked={selectedOptions.includes(-1)}
                                                onChange={(e) => {
                                                    const nextSelections = Boolean(e.checked)
                                                        ? Array.from(new Set([...selectedOptions, -1]))
                                                        : selectedOptions.filter((value) => value !== -1);
                                                    updateAnswer(originalIndex, {
                                                        userSelections: nextSelections,
                                                        userOtherText: Boolean(e.checked) ? (question as any).userOtherText || '' : '',
                                                    });
                                                }}
                                            />
                                        ) : (
                                            <RadioButton
                                                inputId={`option${originalIndex}-other`}
                                                name={`option${originalIndex}`}
                                                value={-1}
                                                onChange={(e) => updateAnswer(originalIndex, {
                                                    userSelection: e.value,
                                                })}
                                                checked={question.userSelection === -1}
                                            />
                                        )}
                                        <label htmlFor={`option${originalIndex}-other`} className="ml-2 text-sm">其他</label>
                                    </div>
                                    {((selectionMode === 'multiple' && selectedOptions.includes(-1))
                                        || (selectionMode === 'single' && question.userSelection === -1)) && (
                                        <InputTextarea
                                            value={(question as any).userOtherText || ''}
                                            onChange={(e) => updateAnswer(originalIndex, {
                                                userOtherText: e.target.value,
                                            })}
                                            className="w-full"
                                            rows={3}
                                            placeholder="请输入补充内容"
                                        />
                                    )}
                                </div>
                            )}
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
                            rows={5}
                        />
                        <div className="mt-2 text-xs text-surface-500">
                            建议一次性写清训练目标、当前水平、每周训练次数、器械条件、伤痛限制和作息情况，越完整越方便 AI 和教练理解你。
                        </div>
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
                        <li>单选题只能选择 1 项，多选题可以选择多项</li>
                        <li>如果题目带有“其他”，可以直接补充你自己的文字说明</li>
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
