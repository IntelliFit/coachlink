'use client';

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { coachService } from '@/app/service/coachService';
import { Skeleton } from 'primereact/skeleton';
import { Card } from 'primereact/card';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { RadioButton } from 'primereact/radiobutton';
import { OverlayPanel } from 'primereact/overlaypanel';
import { Accordion, AccordionTab } from 'primereact/accordion';
import { Tree } from 'primereact/tree';
import { useToastContext } from '@/context/ToastContext';
import QuestionPreviewDialog from './components/QuestionPreviewDialog';
import AddQuestionOverlay from './components/AddQuestionOverlay';
import AddQuestionDialog from './components/AddQuestionDialog';
import OptionQuestionManager from './components/OptionQuestionManager';
import QuestionnaireFlow from './components/QuestionnaireFlow';
import type { TrainingItem, TrainingOptionQuestion, TrainingTextQuestion, QuestionType, QuestionMedia } from '@/types/questionnaires';
import { CoachesRow } from '@/types';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { v4 as uuidv4 } from "uuid";
import { Checkbox } from 'primereact/checkbox';
import { actionLibService } from '@/app/service/actionLibService';
import { CoachActionRow } from '@/types';
import { MultiSelect } from 'primereact/multiselect';
import { trainingItemService } from '@/app/service/trainingItemService';
import type { TrainingItemRow } from '@/types';
import { FileUpload, type FileUploadHandlerEvent } from 'primereact/fileupload';
import { Dropdown } from 'primereact/dropdown';
import { Image } from 'primereact/image';
import type { QuestionnaireTemplateItem } from '@/app/api/coach/list-questionnaires/entity';
import { classNames } from 'primereact/utils';
import type { TreeNode } from 'primereact/treenode';

const QuestionarePage = () => {
    const { data: session } = useSession();
    const { showToast } = useToastContext();
    const overlayPanel = useRef<OverlayPanel>(null);

    const [questionId, setQuestionId] = useState<string | null>(null);
    const [questions, setQuestions] = useState<TrainingItem[]>([]);
    const [saving, setSaving] = useState<boolean>(false);
    const [addQuestionDialogVisible, setAddQuestionDialogVisible] = useState<boolean>(false);
    const [previewDialogVisible, setPreviewDialogVisible] = useState<boolean>(false);
    const [newQuestionType, setNewQuestionType] = useState<QuestionType | null>(null);

    const [coach, setCoach] = useState<CoachesRow>(null);

    // 多问卷模板
    const [templates, setTemplates] = useState<QuestionnaireTemplateItem[]>([]);
    const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [mode, setMode] = useState<'online' | 'draft'>('online');
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [editorView, setEditorView] = useState<'flow' | 'tree' | 'list'>('flow');
    const [highlightQuestionId, setHighlightQuestionId] = useState<string | null>(null);
    const [editDialogVisible, setEditDialogVisible] = useState(false);
    const [editDialogQuestionId, setEditDialogQuestionId] = useState<string | null>(null);

    // 树上“在分支新增下一题”的上下文
    const branchOverlayRef = useRef<OverlayPanel>(null);
    const [pendingBranch, setPendingBranch] = useState<null | {
        fromQuestionId: string;
        // option: optionIndex; times: timesValue; default: null
        ruleKey: number | null;
        kind: 'option' | 'times' | 'default' | 'sequential';
    }>(null);
    // 关键：Overlay 打开时 setState 有延迟，新增动作必须读 ref，避免“点选项1却写到选项2”
    const pendingBranchRef = useRef<null | {
        fromQuestionId: string;
        ruleKey: number | null;
        kind: 'option' | 'times' | 'default' | 'sequential';
    }>(null);

    // 树上删除：支持“仅删节点/删子树”
    const deleteOverlayRef = useRef<OverlayPanel>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    // 训练项目库（training_items）
    const [trainingItems, setTrainingItems] = useState<TrainingItemRow[]>([]);
    const [trainingItemOptions, setTrainingItemOptions] = useState<{ label: string; value: string }[]>([]);
    const [loadingTrainingItems, setLoadingTrainingItems] = useState<boolean>(false);

    // 1RM 动作可选库：来自动作库（当前复用“可自动计算重量”的动作）
    const [autoComputeActions, setAutoComputeActions] = useState<CoachActionRow[]>([]);
    const [loadingActions, setLoadingActions] = useState<boolean>(false);
    const [rmFilter, setRmFilter] = useState<string>('');

    // 预设库导入对话框
    const [importDialogVisible, setImportDialogVisible] = useState<boolean>(false);
    const [selectedImportItems, setSelectedImportItems] = useState<string[]>([]);
    const [importTargetIndex, setImportTargetIndex] = useState<number>(-1);

    // 新问题状态
    const [newTextQuestion, setNewTextQuestion] = useState<string>('');

    const loadCoach = async () => {

        if (!session?.user?.id) {
            return;
        }

        const res = await coachService.getCoach({ userId: session.user.id });

        if (res) {
            setCoach(res.coach);
        }
    }

    const loadQuestions = async () => {
        if (!session?.user?.id || !coach) {
            return;
        }

        const res = await coachService.getQuestionnaires({
            coachId: coach.id
        });

        if (res) {
            setQuestionId(res.id);

            // 解析问题
            const trainingQuestions: TrainingItem[] = [];

            for (const item of res.questionnaires) {
                switch (item.type) {
                    case 'tags':
                        trainingQuestions.push({
                            id: (item as any).id || uuidv4(),
                            type: 'tags',
                            // 兼容旧数据：options 仍然存 string[]（训练项目 name）
                            options: Array.isArray((item as any).options) ? (item as any).options : []
                        });
                        break;
                    case 'times':
                        trainingQuestions.push({
                            id: (item as any).id || uuidv4(),
                            type: 'times'
                            ,
                            question: (item as any).question,
                            options: (item as any).options,
                            branching: (item as any).branching,
                            media: (item as any).media,
                        });
                        break;
                    case 'rm':
                        trainingQuestions.push({
                            id: (item as any).id || uuidv4(),
                            type: 'rm',
                            actionIds: Array.isArray((item as any).actionIds) ? (item as any).actionIds : []
                        });
                        break;
                    case 'option':
                        trainingQuestions.push({
                            id: (item as any).id || uuidv4(),
                            type: 'option',
                            question: item.question,
                            options: item.options,
                            scope: item.scope,  // 保留scope字段
                            branching: (item as any).branching,
                            media: (item as any).media,
                        });
                        break;
                    case 'text':
                        trainingQuestions.push({
                            id: (item as any).id || uuidv4(),
                            type: 'text',
                            question: item.question,
                            media: (item as any).media,
                        });
                        break;
                    default:
                        if (typeof item === 'string') {
                            trainingQuestions.push({
                                id: uuidv4(),
                                type: 'text',
                                question: item,
                            });
                        }
                }
            }
            // 确保始终包含用户极限（1RM）问题
            if (!trainingQuestions.some(q => q.type === 'rm')) {
                trainingQuestions.push({ id: uuidv4(), type: 'rm', actionIds: [] });
            }

            setQuestions(trainingQuestions);

        } else {
            showToast({ severity: 'error', summary: '错误', detail: '加载问卷问题失败' });
        }
    }

    const loadTemplates = async (targetMode?: 'online' | 'draft') => {
        // 仅依赖登录态即可拉取模板列表；避免 coach 尚未就绪时直接 return 导致 UI 残留上一次内容
        if (!session?.user?.id) return;
        setLoadingTemplates(true);
        try {
            // 先按“目标模式”清空本地展示，避免因为异步/早退导致草稿页残留线上内容
            const effectiveMode = targetMode || mode;
            if (effectiveMode === 'draft') {
                setSelectedTemplateId(null);
                setQuestionId(null);
                setQuestions([]);
            }

            const res = await coachService.listQuestionnaires();
            const items = res?.items || [];
            setTemplates(items);
            setDefaultTemplateId(res?.defaultId || null);

            const online = items.find(i => i.is_active) || null;
            const draft = items.find(i => !i.is_active) || null;

            if (effectiveMode === 'draft') {
                if (draft?.id) {
                    setSelectedTemplateId(draft.id);
                    const q = await coachService.getQuestionnaireById({ id: draft.id });
                    setQuestionId(q?.id || null);
                    setQuestions((q?.questionnaires as any) || []);
                } else {
                    // 草稿版本默认是“空问卷”
                    setSelectedTemplateId(null);
                    setQuestionId(null);
                    setQuestions([]);
                }
            } else {
                if (online?.id) {
                    setSelectedTemplateId(online.id);
                    const q = await coachService.getQuestionnaireById({ id: online.id });
                    setQuestionId(q?.id || null);
                    setQuestions((q?.questionnaires as any) || []);
                } else {
                    // 没有线上版本：回退为空
                    setSelectedTemplateId(null);
                    setQuestionId(null);
                    setQuestions([]);
                }
            }
        } catch (e) {
            console.error('加载问卷模板失败:', e);
            showToast({ severity: 'error', summary: '加载失败', detail: '无法获取问卷模板列表' });
        } finally {
            setLoadingTemplates(false);
        }
    };

    useEffect(() => {
        loadCoach();
    }, [session?.user?.id]);

    useEffect(() => {
        if (session?.user?.id) {
            loadTemplates();
        }
    }, [coach]);

    // 加载 training_items（训练项目库）
    useEffect(() => {
        const loadTrainingItems = async () => {
            setLoadingTrainingItems(true);
            try {
                const res = await trainingItemService.listTrainingItems();
                const items = res.trainingItems || [];
                setTrainingItems(items);
                setTrainingItemOptions(items.map(it => ({ label: it.name, value: it.name })));
            } catch (e) {
                console.error('获取训练项目库失败:', e);
                setTrainingItems([]);
                setTrainingItemOptions([]);
            } finally {
                setLoadingTrainingItems(false);
            }
        };
        loadTrainingItems();
    }, []);


    // 注意：tags 选项现在由教练自定义，不再自动填充 training_items

    // 加载 1RM 动作库（用于配置 rm.actionIds）
    useEffect(() => {
        const loadAutoComputeActions = async () => {
            if (!coach?.user_id) return;
            setLoadingActions(true);
            try {
                const res = await actionLibService.listAutoComputeActions({ coachId: coach.user_id });
                setAutoComputeActions(res.actions || []);
            } catch (e) {
                console.error('加载自动计算动作失败:', e);
                setAutoComputeActions([]);
            } finally {
                setLoadingActions(false);
            }
        };
        loadAutoComputeActions();
    }, [coach?.user_id]);

    const saveQuestions = async () => {
        setSaving(true);
        try {
            // 基础校验：分支目标必须存在，且不允许指向自己（避免明显死循环）
            const idSet = new Set(questions.map((q: any) => q.id).filter(Boolean));
            for (const q of questions as any[]) {
                const branching = q?.branching;
                if (!branching) continue;
                const selfId = q.id;

                // tags 是多选题：暂不支持按选项 rules 分支（否则会有“多选命中多个分支”的歧义）
                if (q.type === 'tags' && branching.rules && typeof branching.rules === 'object' && Object.keys(branching.rules).length > 0) {
                    showToast({
                        severity: 'error',
                        summary: '分支配置不支持',
                        detail: `问题「${labelOfQuestion(q)}」为多选题（tags），暂不支持按选项分支。你可以改用“选项问题（单选）”来实现分叉，或仅配置“默认跳转”。`,
                    });
                    setSaving(false);
                    return;
                }

                const checkTarget = (target: any, label: string) => {
                    if (target === undefined) return true;
                    if (target === null) return true; // 结束问卷
                    if (typeof target !== 'string') return false;
                    if (target === selfId) {
                        showToast({ severity: 'error', summary: '分支配置错误', detail: `${label} 不能跳转到自身` });
                        return false;
                    }
                    if (!idSet.has(target)) {
                        showToast({ severity: 'error', summary: '分支配置错误', detail: `${label} 的跳转目标不存在（请重新选择）` });
                        return false;
                    }
                    return true;
                };

                if (!checkTarget(branching.defaultNext, `问题「${labelOfQuestion(q)}」默认跳转`)) {
                    setSaving(false);
                    return;
                }
                if (q.type !== 'tags' && branching.rules && typeof branching.rules === 'object') {
                    for (const [k, v] of Object.entries(branching.rules)) {
                        if (!checkTarget(v as any, `问题「${labelOfQuestion(q)}」选项 ${Number(k) + 1} 跳转`)) {
                            setSaving(false);
                            return;
                        }
                    }
                }
            }

            const result = await coachService.updateQuestionnaires({
                id: questionId || '',
                questionnaires: questions,
                mode: mode,  // 传递当前模式，实现独立保存
            });

            if (result) {
                setQuestionId(result.id);
                showToast({ severity: 'success', summary: '成功', detail: '问卷设置已保存' });
                // 保存后刷新模板（避免回到页面时看到旧数据）
                await loadTemplates(mode);
            }
        } catch (error) {
            console.error('保存问卷失败:', error);
            showToast({ severity: 'error', summary: '错误', detail: '保存问卷失败' });
        } finally {
            setSaving(false);
        }
    };

    // 添加训练标签问题（最多只能有一个）
    const addTagsQuestion = () => {
        const hasTags = questions.some(q => q.type === 'tags');
        if (!hasTags) {
            // 初始化为空数组，让教练自定义选项
            setQuestions([...questions, { id: uuidv4(), type: 'tags', options: [] }]);
        }
        overlayPanel.current?.hide();
    };

    // 添加训练次数问题（最多只能有一个）
    const addTimesQuestion = () => {
        const hasTimes = questions.some(q => q.type === 'times');
        if (!hasTimes) {
            setQuestions([...questions, {
                id: uuidv4(),
                type: 'times',
                question: '您希望每周训练几次？',
                options: [1, 2, 3, 4, 5, 6, 7],
            }]);
        }
        overlayPanel.current?.hide();
    };

    const updateTimesQuestionText = (questionIndex: number, text: string) => {
        const newQuestions = [...questions];
        const q = newQuestions[questionIndex];
        if (q.type === 'times') {
            (q as any).question = text;
            setQuestions(newQuestions);
        }
    };

    const toggleTimesOption = (questionIndex: number, num: number, checked: boolean) => {
        const newQuestions = [...questions];
        const q = newQuestions[questionIndex];
        if (q.type !== 'times') return;

        const current: number[] = Array.isArray((q as any).options) ? [...(q as any).options] : [1, 2, 3, 4, 5, 6, 7];
        const next = checked
            ? Array.from(new Set([...current, num])).sort((a, b) => a - b)
            : current.filter(n => n !== num);

        // 至少保留一个选项，避免学员无法选择
        (q as any).options = next.length > 0 ? next : current;
        setQuestions(newQuestions);
    };

    // 由于 react-beautiful-dnd 可能将整块区域作为拖拽句柄，交互控件需要阻止事件冒泡，避免点击被当成拖拽
    const stopDndEvent = (e: any) => {
        if (!e) return;
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
    };

    // 添加RM问题
    const addRmQuestion = () => {
        const hasRm = questions.some(q => q.type === 'rm');
        if (!hasRm) {
            setQuestions([...questions, { id: uuidv4(), type: 'rm', actionIds: [] }]);
        }
        overlayPanel.current?.hide();
    };

    // 添加选项问题
    const addOptionQuestion = (question: TrainingOptionQuestion) => {
        setQuestions([...questions, { ...question, id: question.id || uuidv4() }]);
        setAddQuestionDialogVisible(false);
        setNewQuestionType(null);
    };

    // 添加文本问题
    const addTextQuestion = () => {
        if (newTextQuestion.trim()) {
            const textQuestion: TrainingTextQuestion = {
                id: uuidv4(),
                type: 'text',
                question: newTextQuestion.trim()
            };
            setQuestions([...questions, textQuestion]);
            setNewTextQuestion('');
            setAddQuestionDialogVisible(false);
            setNewQuestionType(null);
        } else {
            showToast({ severity: 'error', summary: '错误', detail: '请输入有效的文本问题' });
        }
    };

    // 删除问题
    const removeQuestion = (index: number) => {
        const newQuestions = [...questions];
        newQuestions.splice(index, 1);
        setQuestions(newQuestions);
    };

    // 更新选项问题的选项
    const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
        const newQuestions = [...questions];
        const question = newQuestions[questionIndex];

        if (question.type === 'option') {
            question.options[optionIndex] = value;
            setQuestions(newQuestions);
        }
    };

    // 添加选项问题的选项
    const addOption = (questionIndex: number) => {
        const newQuestions = [...questions];
        const question = newQuestions[questionIndex];

        if (question.type === 'option') {
            question.options.push('');
            setQuestions(newQuestions);
        }
    };

    // 删除选项问题的选项
    const removeOption = (questionIndex: number, optionIndex: number) => {
        const newQuestions = [...questions];
        const question = newQuestions[questionIndex];

        if (question.type === 'option') {
            question.options.splice(optionIndex, 1);
            setQuestions(newQuestions);
        }
    };

    // 更新选项问题的题目
    const updateOptionQuestionText = (questionIndex: number, text: string) => {
        const newQuestions = [...questions];
        const question = newQuestions[questionIndex];

        if (question.type === 'option') {
            question.question = text;
            setQuestions(newQuestions);
        }
    };

    // 处理拖拽结束事件
    const onDragEnd = (result: DropResult) => {
        if (!result.destination) {
            return;
        }

        const items = Array.from(questions);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        setQuestions(items);
    };

    const labelOfQuestion = (q: TrainingItem) => {
        switch (q.type) {
            case 'tags': return '训练项目偏好';
            case 'times': return (q as any).question || '每周训练次数';
            case 'rm': return '用户极限（1RM）';
            case 'option': return q.question || '选项问题';
            case 'text': return q.question || '文本问题';
            default: return (q as any)?.type || '问题';
        }
    };

    const questionIndexById = useMemo(() => {
        const map = new Map<string, number>();
        questions.forEach((q, idx) => {
            if ((q as any)?.id) map.set((q as any).id, idx);
        });
        return map;
    }, [questions]);

    const getNextSequentialId = (qid: string): string | null => {
        const idx = questionIndexById.get(qid);
        if (idx === undefined) return null;
        const next = questions[idx + 1] as any;
        return next?.id || null;
    };

    const jumpToQuestion = (qid: string) => {
        setEditorView('list');
        setHighlightQuestionId(qid);
        // 等列表渲染出来再滚动
        setTimeout(() => {
            const el = document.getElementById(`question-${qid}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            // 2.5s 后取消高亮
            setTimeout(() => setHighlightQuestionId((cur) => (cur === qid ? null : cur)), 2500);
        }, 60);
    };

    const openEditDialog = (qid: string) => {
        setEditDialogQuestionId(qid);
        setEditDialogVisible(true);
    };

    const openDeleteOverlay = (e: any, qid: string) => {
        setPendingDeleteId(qid);
        // 避免 toggle 导致“点 A 却沿用上次 B 的上下文”
        // show 需要显式 target，这里用事件的 currentTarget
        const target = (e as any)?.currentTarget || (e as any)?.target || null;
        (deleteOverlayRef.current as any)?.show?.(e, target);
    };

    const normalizeBranchingAfterDeletion = (nextQuestions: TrainingItem[], deletedIds: Set<string>) => {
        // 清理所有指向被删除节点的跳转（规则删除=回到顺序下一题）
        return nextQuestions.map((q: any) => {
            if (q?.type !== 'option' && q?.type !== 'times' && q?.type !== 'tags') return q;
            const b = q.branching;
            if (!b) return q;

            let changed = false;
            const nextB: any = { ...b };

            if (typeof nextB.defaultNext === 'string' && deletedIds.has(nextB.defaultNext)) {
                delete nextB.defaultNext;
                changed = true;
            }
            if (q?.type !== 'tags' && nextB.rules) {
                const rules: Record<string, any> = { ...nextB.rules };
                for (const k of Object.keys(rules)) {
                    const v = rules[k];
                    if (typeof v === 'string' && deletedIds.has(v)) {
                        delete rules[k];
                        changed = true;
                    }
                }
                if (Object.keys(rules).length === 0) delete nextB.rules;
                else nextB.rules = rules;
            }

            if (!changed) return q;
            if (nextB.defaultNext === undefined && !nextB.rules) {
                const { branching, ...rest } = q;
                return rest;
            }
            return { ...q, branching: nextB };
        });
    };

    const computeDeletableSubtree = (targetId: string): Set<string> => {
        // “删子树”的语义：删除 target 以及因删除而“变成孤儿”的后续节点（不会删被其它分支复用的节点）
        const ids = questions.map((q: any) => q?.id).filter(Boolean) as string[];
        const byId = new Map<string, TrainingItem>();
        questions.forEach((q: any) => q?.id && byId.set(q.id, q));

        const outgoing = new Map<string, string[]>();
        const incoming = new Map<string, Set<string>>();

        const addEdge = (from: string, to: string) => {
            if (!from || !to) return;
            outgoing.set(from, [...(outgoing.get(from) || []), to]);
            if (!incoming.has(to)) incoming.set(to, new Set());
            incoming.get(to)!.add(from);
        };

        // 顺序边 + 分支边
        for (let i = 0; i < questions.length; i++) {
            const cur: any = questions[i];
            if (!cur?.id) continue;
            const next: any = questions[i + 1];
            if (next?.id) addEdge(cur.id, next.id);

            if (cur.type === 'option' || cur.type === 'times' || cur.type === 'tags') {
                const b = cur.branching || {};
                if (typeof b.defaultNext === 'string') addEdge(cur.id, b.defaultNext);
                // tags 为多选题：当前不支持 rules 分支
                if (cur.type !== 'tags') {
                    const rules = b.rules || {};
                    Object.values(rules).forEach((v: any) => {
                        if (typeof v === 'string') addEdge(cur.id, v);
                    });
                }
            }
        }

        const deletable = new Set<string>();
        const q: string[] = [targetId];

        while (q.length > 0) {
            const cur = q.shift()!;
            if (deletable.has(cur)) continue;
            deletable.add(cur);

            const children = outgoing.get(cur) || [];
            for (const child of children) {
                // 只有当 child 的所有入边都来自 deletable 时，才把 child 也算进“子树”
                const ins = incoming.get(child);
                const allFromInside = !ins || Array.from(ins).every(src => deletable.has(src));
                if (allFromInside) q.push(child);
            }
        }

        return deletable;
    };

    const deleteSingleNode = (qid: string) => {
        const idx = questionIndexById.get(qid);
        if (idx === undefined) return;
        const nextQuestions = [...questions];
        nextQuestions.splice(idx, 1);
        const deletedIds = new Set<string>([qid]);
        const cleaned = normalizeBranchingAfterDeletion(nextQuestions, deletedIds);
        setQuestions(cleaned as any);
        deleteOverlayRef.current?.hide();
        showToast({ severity: 'success', summary: '已删除', detail: '已删除该问题（跳转会自动回到顺序下一题）' });
    };

    const deleteSubtree = (qid: string) => {
        const toDelete = computeDeletableSubtree(qid);
        const nextQuestions = (questions as any[]).filter(q => !toDelete.has(q?.id));
        const cleaned = normalizeBranchingAfterDeletion(nextQuestions as any, toDelete);
        setQuestions(cleaned as any);
        deleteOverlayRef.current?.hide();
        showToast({ severity: 'success', summary: '已删除', detail: `已删除 ${toDelete.size} 个节点（会保留被其它分支复用的节点）` });
    };

    const openBranchAddOverlay = (e: any, ctx: NonNullable<typeof pendingBranch>) => {
        pendingBranchRef.current = ctx;
        setPendingBranch(ctx);
        const target = (e as any)?.currentTarget || (e as any)?.target || null;
        (branchOverlayRef.current as any)?.show?.(e, target);
    };

    const openFlowAddOverlay = (ctx: { kind: 'sequential' | 'default' | 'option' | 'times'; fromQuestionId: string; ruleKey?: number }, e: any) => {
        if (ctx.kind === 'option' || ctx.kind === 'times') {
            openBranchAddOverlay(e, { fromQuestionId: ctx.fromQuestionId, ruleKey: ctx.ruleKey ?? null, kind: ctx.kind });
            return;
        }
        openBranchAddOverlay(e, { fromQuestionId: ctx.fromQuestionId, ruleKey: null, kind: ctx.kind });
    };

    const createQuestionByType = (t: QuestionType): TrainingItem => {
        const id = uuidv4();
        switch (t) {
            case 'option':
                return { id, type: 'option', question: '请输入问题', options: ['选项1', '选项2'], scope: 'action' };
            case 'text':
                return { id, type: 'text', question: '请输入问题' };
            case 'times':
                return { id, type: 'times', question: '您希望每周训练几次？', options: [1, 2, 3, 4, 5, 6, 7] } as any;
            case 'rm':
                return { id, type: 'rm', actionIds: [] } as any;
            case 'tags':
                return { id, type: 'tags', options: [] } as any;
            default:
                return { id, type: 'text', question: '请输入问题' };
        }
    };

    const attachNewQuestionToBranch = (t: QuestionType) => {
        const ctx = pendingBranchRef.current || pendingBranch;
        if (!ctx?.fromQuestionId) return;
        const fromId = ctx.fromQuestionId;
        const fromIdx = questionIndexById.get(fromId);
        if (fromIdx === undefined) return;

        const newQ = createQuestionByType(t);

        // 新题统一追加到末尾，避免“列表顺序”污染分支结构
        const nextQuestions = [...questions, newQ as any];

        // 顺序下一题：不写 branching，只插入即可
        if (ctx.kind === 'sequential') {
            const fromQ: any = { ...(questions[fromIdx] as any) };
            fromQ.next = (newQ as any).id;
            nextQuestions[fromIdx] = fromQ;
            setQuestions(nextQuestions as any);
            branchOverlayRef.current?.hide();
            pendingBranchRef.current = null;
            showToast({ severity: 'success', summary: '已新增', detail: '已在顺序下一题处新增问题' });
            return;
        }

        // 写入 branching
        const fromQ: any = { ...(questions[fromIdx] as any) };
        const b = { ...(fromQ.branching || {}) };
        const rules = { ...(b.rules || {}) };

        if (ctx.kind === 'default') {
            b.defaultNext = (newQ as any).id;
        } else if (ctx.kind === 'option') {
            // option: key 是选项 index
            rules[ctx.ruleKey as number] = (newQ as any).id;
            b.rules = rules;
        } else if (ctx.kind === 'times') {
            // times: key 是次数值（例如 3/4/5）
            rules[ctx.ruleKey as number] = (newQ as any).id;
            b.rules = rules;
        }

        fromQ.branching = b;
        nextQuestions[fromIdx] = fromQ;

        setQuestions(nextQuestions as any);
        branchOverlayRef.current?.hide();
        pendingBranchRef.current = null;
        const where =
            ctx.kind === 'option'
                ? `选项 ${Number(ctx.ruleKey ?? 0) + 1}`
                : ctx.kind === 'times'
                    ? `${ctx.ruleKey} 次`
                    : ctx.kind === 'default'
                        ? '默认分支'
                        : '分支';
        showToast({ severity: 'success', summary: '已新增', detail: `已在「${where}」新增下一题` });
    };

    const buildTree = useCallback((): TreeNode[] => {
        const first: any = questions?.[0];
        if (!first?.id) {
            return [
                {
                    key: 'empty',
                    label: '暂无问题（请先新增根问题）',
                    selectable: false,
                },
            ];
        }

        const visited = new Set<string>();

        const makeQuestionNode = (qid: string, depth: number): TreeNode => {
            const idx = questionIndexById.get(qid);
            const q: any = idx !== undefined ? questions[idx] : null;
            if (!q) {
                return { key: `missing-${qid}`, label: `缺失问题：${qid}`, selectable: false };
            }

            if (visited.has(qid) || depth > 30) {
                return { key: `cycle-${qid}`, label: `（循环/过深）${labelOfQuestion(q)}`, selectable: false };
            }
            visited.add(qid);

            const children: TreeNode[] = [];

            const branching = q.branching || {};
            const hasBranching = (branching && (branching.defaultNext !== undefined || (branching.rules && Object.keys(branching.rules).length > 0)));

            if (q.type === 'option') {
                // 为每个选项创建分支节点
                q.options.forEach((opt: string, optIdx: number) => {
                    const target = branching?.rules?.[optIdx] ?? undefined;
                    const child: TreeNode = {
                        key: `branch-${qid}-opt-${optIdx}`,
                        selectable: false,
                        label: (
                            <div className="flex items-center justify-between gap-2 w-full">
                                <div className="text-sm text-surface-700">
                                    <span className="font-medium">选项 {optIdx + 1}：</span>{' '}
                                    <span className="text-surface-600">{opt}</span>
                                </div>
                                <Button
                                    label="在此分支新增下一题"
                                    size="small"
                                    outlined
                                    onClick={(e) => openBranchAddOverlay(e, { fromQuestionId: qid, ruleKey: optIdx, kind: 'option' })}
                                />
                            </div>
                        ) as any,
                        children: [],
                    };
                    if (typeof target === 'string') {
                        child.children = [makeQuestionNode(target, depth + 1)];
                    } else {
                        // 未设置：显示顺序下一题
                        const seq = getNextSequentialId(qid);
                        if (seq) child.children = [makeQuestionNode(seq, depth + 1)];
                    }
                    children.push(child);
                });

                // 默认分支（fallback）
                if (!hasBranching) {
                    // nothing
                } else {
                    const defTarget = branching.defaultNext;
                    children.push({
                        key: `branch-${qid}-default`,
                        selectable: false,
                        label: (
                            <div className="flex items-center justify-between gap-2 w-full">
                                <div className="text-sm text-surface-600">
                                    默认跳转（未命中规则时）
                                </div>
                                <Button
                                    label="新增默认分支下一题"
                                    size="small"
                                    outlined
                                    onClick={(e) => openBranchAddOverlay(e, { fromQuestionId: qid, ruleKey: null, kind: 'default' })}
                                />
                            </div>
                        ) as any,
                        children: typeof defTarget === 'string' ? [makeQuestionNode(defTarget, depth + 1)] : [],
                    });
                }
            } else if (q.type === 'times') {
                // times: 按次数值分支
                const opts: number[] = Array.isArray(q.options) ? q.options : [1, 2, 3, 4, 5, 6, 7];
                opts.forEach((num: number) => {
                    const target = branching?.rules?.[num] ?? undefined;
                    const child: TreeNode = {
                        key: `branch-${qid}-times-${num}`,
                        selectable: false,
                        label: (
                            <div className="flex items-center justify-between gap-2 w-full">
                                <div className="text-sm text-surface-700">
                                    <span className="font-medium">{num} 次</span>
                                </div>
                                <Button
                                    label="在此分支新增下一题"
                                    size="small"
                                    outlined
                                    onClick={(e) => openBranchAddOverlay(e, { fromQuestionId: qid, ruleKey: num, kind: 'times' })}
                                />
                            </div>
                        ) as any,
                        children: [],
                    };
                    if (typeof target === 'string') {
                        child.children = [makeQuestionNode(target, depth + 1)];
                    } else {
                        const seq = getNextSequentialId(qid);
                        if (seq) child.children = [makeQuestionNode(seq, depth + 1)];
                    }
                    children.push(child);
                });
            } else if (q.type === 'tags') {
                // tags（多选）：当前仅支持 defaultNext（填完后整体跳转）；否则按顺序下一题
                const defTarget = branching?.defaultNext;
                if (defTarget === null) {
                    // 结束问卷
                } else if (typeof defTarget === 'string') {
                    children.push(makeQuestionNode(defTarget, depth + 1));
                } else {
                    const seq = getNextSequentialId(qid);
                    if (seq) children.push(makeQuestionNode(seq, depth + 1));
                }
            } else {
                // 非分支题：顺序下一题
                const seq = getNextSequentialId(qid);
                if (seq) children.push(makeQuestionNode(seq, depth + 1));
            }

            return {
                key: `q-${qid}`,
                selectable: false,
                label: (
                    <div className="flex items-center justify-between gap-2 w-full">
                        <div
                            className={classNames(
                                "text-sm cursor-pointer select-none",
                                highlightQuestionId === qid ? "ring-2 ring-primary-300 rounded px-1" : ""
                            )}
                            onClick={() => openEditDialog(qid)}
                            title="点击在弹窗中编辑（不跳转视图）"
                        >
                            <span className="font-bold text-surface-800">{labelOfQuestion(q)}</span>
                            <span className="ml-2 text-[11px] text-surface-500">({q.type})</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {(q.type === 'option' || q.type === 'times') && (
                                <span className="text-[11px] px-2 py-0.5 rounded bg-primary-50 text-primary-700 border border-primary-200">
                                    分支题
                                </span>
                            )}
                            {q.type === 'tags' && (
                                <span className="text-[11px] px-2 py-0.5 rounded bg-surface-50 text-surface-700 border border-surface-200">
                                    多选（仅默认跳转）
                                </span>
                            )}
                            <Button
                                icon="pi pi-pencil"
                                className="p-button-text p-1"
                                onClick={(e) => {
                                    stopDndEvent(e);
                                    openEditDialog(qid);
                                }}
                                tooltip="编辑"
                                tooltipOptions={{ position: 'top' }}
                            />
                            <Button
                                icon="pi pi-trash"
                                className="p-button-text p-button-danger p-1"
                                onClick={(e) => {
                                    stopDndEvent(e);
                                    openDeleteOverlay(e, qid);
                                }}
                                tooltip="删除"
                                tooltipOptions={{ position: 'top' }}
                            />
                        </div>
                    </div>
                ) as any,
                children,
                expanded: true,
            };
        };

        return [
            {
                key: 'root',
                label: (
                    <div className="text-sm font-bold text-surface-800">
                        起始问题（根节点）
                    </div>
                ) as any,
                selectable: false,
                expanded: true,
                children: [makeQuestionNode(first.id, 0)],
            },
        ];
    }, [questions, questionIndexById]);

    const updateQuestion = (index: number, updater: (q: TrainingItem) => TrainingItem) => {
        setQuestions(prev => prev.map((q, i) => i === index ? updater(q) : q));
    };

    const ensureMedia = (q: TrainingItem): QuestionMedia[] => Array.isArray((q as any).media) ? (q as any).media : [];

    const handleAddEmptyMedia = (index: number) => {
        updateQuestion(index, (q) => {
            const media = ensureMedia(q);
            return { ...q, media: [...media, { id: uuidv4(), type: 'image', url: '', caption: '' }] as any };
        });
    };

    const handleRemoveMedia = (qIndex: number, mediaId: string) => {
        updateQuestion(qIndex, (q) => {
            const media = ensureMedia(q).filter(m => m.id !== mediaId);
            return { ...q, media } as any;
        });
    };

    const handleUpdateMedia = (qIndex: number, mediaId: string, patch: Partial<QuestionMedia>) => {
        updateQuestion(qIndex, (q) => {
            const media = ensureMedia(q).map(m => m.id === mediaId ? ({ ...m, ...patch }) : m);
            return { ...q, media } as any;
        });
    };

    const handleUploadMedia = async (qIndex: number, e: FileUploadHandlerEvent) => {
        // PrimeReact FileUpload 的 event.files 可能会累积历史文件；
        // 这里取最后一个，确保是“本次新选择”的文件，避免重复上传第一张。
        const file = e.files && e.files.length > 0 ? e.files[e.files.length - 1] : undefined;
        if (!file) return;

        try {
            const uploaded = await coachService.uploadQuestionMedia(file);
            if (!uploaded?.url) {
                showToast({ severity: 'error', summary: '上传失败', detail: '未获取到媒体链接' });
                return;
            }

            updateQuestion(qIndex, (q) => {
                const media = ensureMedia(q);
                const type: QuestionMedia['type'] = file.type?.startsWith('video/') ? 'video' : 'image';
                const item: QuestionMedia = {
                    id: uuidv4(),
                    type,
                    url: uploaded.url,
                    caption: '',
                    storage_bucket: uploaded.storage_bucket,
                    storage_path: uploaded.storage_path,
                };
                return { ...q, media: [...media, item] } as any;
            });

            showToast({ severity: 'success', summary: '上传成功', detail: '已添加到该问题的示例媒体' });
            // 清空 FileUpload 的内部文件列表（避免下次 uploadHandler 仍带上旧文件）
            (e as any)?.options?.clear?.();
        } catch (err) {
            console.error('upload question media failed:', err);
            const msg = err instanceof Error ? err.message : '网络或服务端错误，请重试';
            showToast({ severity: 'error', summary: '上传失败', detail: msg });
            (e as any)?.options?.clear?.();
        }
    };

    const renderMediaEditor = (question: TrainingItem, qIndex: number) => {
        const mediaList = ensureMedia(question);
        return (
            <div className="mt-4 p-3 rounded-lg border border-surface-200 bg-surface-50">
                <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-surface-600">问题示例媒体（可选）</div>
                    <Button
                        label="添加URL"
                        icon="pi pi-plus"
                        size="small"
                        outlined
                        onClick={() => handleAddEmptyMedia(qIndex)}
                    />
                </div>

                <div className="mt-3">
                    <FileUpload
                        mode="basic"
                        chooseLabel="上传图片/视频"
                        accept="image/*,video/*"
                        multiple={false}
                        customUpload
                        auto
                        uploadHandler={(e) => handleUploadMedia(qIndex, e)}
                    />
                    <div className="mt-1 text-[11px] text-surface-500">
                        建议：图片 ≤ 5MB；视频建议 ≤ 50MB（用作动作示例/说明）。
                    </div>
                </div>

                {mediaList.length > 0 && (
                    <div className="mt-3 space-y-3">
                        {mediaList.map((m) => (
                            <div key={m.id} className="p-2 rounded border border-surface-200 bg-white">
                                <div className="flex items-center gap-2">
                                    <Dropdown
                                        value={m.type}
                                        options={[
                                            { label: '图片', value: 'image' },
                                            { label: '视频', value: 'video' },
                                        ]}
                                        onChange={(e) => handleUpdateMedia(qIndex, m.id, { type: e.value })}
                                        className="w-28"
                                    />
                                    <InputText
                                        value={m.url || ''}
                                        onChange={(e) => handleUpdateMedia(qIndex, m.id, { url: e.target.value })}
                                        placeholder="媒体URL（publicUrl/签名URL）"
                                        className="flex-1"
                                    />
                                    <Button
                                        icon="pi pi-trash"
                                        className="p-button-text p-button-danger p-2"
                                        onClick={() => handleRemoveMedia(qIndex, m.id)}
                                    />
                                </div>
                                <div className="mt-2">
                                    <InputText
                                        value={m.caption || ''}
                                        onChange={(e) => handleUpdateMedia(qIndex, m.id, { caption: e.target.value })}
                                        placeholder="说明文字（可选）"
                                        className="w-full"
                                    />
                                </div>
                                <div className="mt-2">
                                    {m.type === 'image' ? (
                                        m.url ? (
                                            <Image src={m.url} alt={m.caption || '示例图片'} width="180" preview className="rounded border" />
                                        ) : (
                                            <div className="text-[11px] text-surface-400">填写 URL 或上传后可预览</div>
                                        )
                                    ) : (
                                        m.url ? (
                                            <video src={m.url} controls className="w-full max-w-[320px] rounded border" />
                                        ) : (
                                            <div className="text-[11px] text-surface-400">填写 URL 或上传后可预览</div>
                                        )
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const updateBranching = (qIndex: number, updater: (branching: any) => any) => {
        updateQuestion(qIndex, (q) => {
            // tags（多选）仅支持 defaultNext；option/times 支持 rules + defaultNext
            if (q.type !== 'option' && q.type !== 'times' && q.type !== 'tags') return q;
            const current = (q as any).branching || {};
            const next = updater(current) || undefined;
            return { ...q, branching: next } as any;
        });
    };

    const setBranchDefault = (qIndex: number, value: string) => {
        updateBranching(qIndex, (b) => {
            const next = { ...(b || {}) };
            if (value === '__NEXT__') {
                delete next.defaultNext;
            } else if (value === '__END__') {
                next.defaultNext = null;
            } else {
                next.defaultNext = value;
            }
            if (!next.rules || Object.keys(next.rules).length === 0) delete next.rules;
            if (next.defaultNext === undefined && !next.rules) return undefined;
            return next;
        });
    };

    const setBranchRule = (qIndex: number, optionIndex: number, value: string) => {
        updateBranching(qIndex, (b) => {
            const next = { ...(b || {}) };
            const rules = { ...(next.rules || {}) } as Record<number, string | null>;
            if (value === '__NEXT__') {
                delete rules[optionIndex];
            } else if (value === '__END__') {
                rules[optionIndex] = null;
            } else {
                rules[optionIndex] = value;
            }
            next.rules = rules;
            if (Object.keys(next.rules).length === 0) delete next.rules;
            if (next.defaultNext === undefined && !next.rules) return undefined;
            return next;
        });
    };

    const renderQuestion = (question: TrainingItem, index: number) => {
        switch (question.type) {
            case 'tags':
                const tagsOptions: string[] = Array.isArray((question as any).options) ? (question as any).options : [];
                const tagsBranching = (question as any).branching || {};
                const tagsTargets = questions
                    .filter(q => q.id && q.id !== question.id)
                    .map(q => ({ label: labelOfQuestion(q), value: q.id as string }));
                const tagsBranchOptions = [
                    { label: '顺序下一题（默认）', value: '__NEXT__' },
                    { label: '结束问卷', value: '__END__' },
                    ...tagsTargets,
                ];
                return (
                    <div className="mb-4 p-3 bg-surface-100 rounded">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <h4 className="font-medium">训练项目偏好</h4>
                                <p className="text-sm text-surface-500">
                                    学员可以选择偏好的训练项目（智能计划将会根据这些偏好进行匹配）。
                                    <strong>您可以自定义训练项目选项</strong>，这些选项也将用于模板标签匹配。
                                </p>
                                <div className="mt-3">
                                    <label className="block text-xs font-bold text-surface-600 mb-2">自定义训练项目选项</label>
                                    
                                    {/* 已添加的选项列表 */}
                                    <div className="space-y-2 mb-3">
                                        {tagsOptions.map((opt, optIdx) => (
                                            <div 
                                                key={optIdx} 
                                                className="flex items-center gap-2"
                                                onMouseDown={stopDndEvent}
                                                onTouchStart={stopDndEvent}
                                            >
                                                <InputText
                                                    value={opt}
                                                    onChange={(e) => {
                                                        const newQuestions = [...questions];
                                                        const q = newQuestions[index];
                                                        if (q.type !== 'tags') return;
                                                        const newOpts = [...tagsOptions];
                                                        newOpts[optIdx] = e.target.value;
                                                        (q as any).options = newOpts;
                                                        setQuestions(newQuestions);
                                                    }}
                                                    placeholder={`训练项目 ${optIdx + 1}`}
                                                    className="flex-1"
                                                    onMouseDown={stopDndEvent as any}
                                                    onTouchStart={stopDndEvent as any}
                                                />
                                                <Button
                                                    icon="pi pi-trash"
                                                    className="p-button-text p-button-danger p-2"
                                                    onClick={() => {
                                                        const newQuestions = [...questions];
                                                        const q = newQuestions[index];
                                                        if (q.type !== 'tags') return;
                                                        const newOpts = tagsOptions.filter((_, i) => i !== optIdx);
                                                        (q as any).options = newOpts;
                                                        setQuestions(newQuestions);
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {/* 添加新选项按钮 */}
                                    <div className="flex gap-2 flex-wrap">
                                        <Button
                                            label="添加选项"
                                            icon="pi pi-plus"
                                            size="small"
                                            outlined
                                            onClick={() => {
                                                const newQuestions = [...questions];
                                                const q = newQuestions[index];
                                                if (q.type !== 'tags') return;
                                                (q as any).options = [...tagsOptions, ''];
                                                setQuestions(newQuestions);
                                            }}
                                        />
                                        
                                        {/* 从预设库导入按钮 */}
                                        {trainingItemOptions.length > 0 && (
                                            <Button
                                                label="从预设库导入"
                                                icon="pi pi-download"
                                                size="small"
                                                severity="secondary"
                                                outlined
                                                onClick={() => {
                                                    // 打开选择对话框，让用户选择要导入哪些项目
                                                    setImportTargetIndex(index);
                                                    setSelectedImportItems([]);
                                                    setImportDialogVisible(true);
                                                }}
                                                tooltip="从系统预设的训练项目库中选择导入"
                                                tooltipOptions={{ position: 'top' }}
                                            />
                                        )}
                                    </div>
                                    
                                    <div className="mt-2 text-[11px] text-surface-500">
                                        提示：建议配置 6–15 个选项；学员端可多选。这些选项同时会作为模板的可选标签。
                                    </div>
                                </div>
                            </div>
                            <Button
                                icon="pi pi-trash"
                                className="p-button-text p-button-danger p-2"
                                onClick={() => removeQuestion(index)}
                            />
                        </div>

                        {/* 默认跳转（tags：仅支持 defaultNext） */}
                        <div className="mt-4 p-3 rounded-lg border border-surface-200 bg-surface-50">
                            <div className="text-xs font-bold text-surface-600 mb-2">默认跳转（可选）</div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-surface-600 w-20 shrink-0">跳转到</span>
                                <Dropdown
                                    value={
                                        tagsBranching.defaultNext === undefined
                                            ? '__NEXT__'
                                            : (tagsBranching.defaultNext === null ? '__END__' : tagsBranching.defaultNext)
                                    }
                                    options={tagsBranchOptions}
                                    onChange={(e) => setBranchDefault(index, e.value)}
                                    className="w-full"
                                    placeholder="选择默认跳转"
                                />
                            </div>
                            <div className="mt-2 text-[11px] text-surface-500">
                                说明：该题为<strong>多选题</strong>，目前仅支持“填完后整体跳转”（defaultNext），不支持按选项分支。
                                如需根据某个选项分叉，请使用「选项问题（单选）」来建模。
                            </div>
                        </div>

                        {renderMediaEditor(question, index)}
                    </div>
                );

            case 'times': {
                const timesBranching = (question as any).branching || {};
                const timesTargets = questions
                    .filter(q => q.id && q.id !== question.id)
                    .map(q => ({ label: labelOfQuestion(q), value: q.id as string }));
                const timesBranchOptions = [
                    { label: '顺序下一题（默认）', value: '__NEXT__' },
                    { label: '结束问卷', value: '__END__' },
                    ...timesTargets,
                ];
                const opts: number[] = Array.isArray((question as any).options)
                    ? (question as any).options
                    : [1, 2, 3, 4, 5, 6, 7];

                return (
                    <div className="mb-4 p-3 bg-surface-100 rounded">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-medium">每周训练次数</h4>
                                <p className="text-sm text-surface-500">学员可以选择每周训练的次数（智能计划将会自动根据这个项目进行匹配）</p>
                                <div className="mt-3 space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-surface-500 mb-1">题干（可选）</label>
                                        <InputText
                                            value={(question as any).question || ''}
                                            onChange={(e) => updateTimesQuestionText(index, e.target.value)}
                                            placeholder="例如：您希望每周训练几次？"
                                            className="w-full"
                                            onMouseDown={stopDndEvent as any}
                                            onTouchStart={stopDndEvent as any}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-surface-500 mb-2">可选次数</label>
                                        <div className="flex flex-wrap gap-3">
                                            {[1, 2, 3, 4, 5, 6, 7].map(num => {
                                                const isChecked = opts.includes(num);
                                                return (
                                                    <div
                                                        key={num}
                                                        className="flex items-center gap-2"
                                                        onMouseDown={stopDndEvent}
                                                        onTouchStart={stopDndEvent}
                                                    >
                                                        <Checkbox
                                                            inputId={`times-opt-${index}-${num}`}
                                                            checked={isChecked}
                                                            onChange={(e) => toggleTimesOption(index, num, Boolean(e.checked))}
                                                            onMouseDown={stopDndEvent as any}
                                                            onTouchStart={stopDndEvent as any}
                                                        />
                                                        <label htmlFor={`times-opt-${index}-${num}`} className="text-sm text-surface-700">{num} 次</label>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-2 text-[11px] text-surface-500">
                                            提示：至少勾选 1 个选项；学员端将只显示你勾选的次数。
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <Button
                                icon="pi pi-trash"
                                className="p-button-text p-button-danger p-2"
                                onClick={() => removeQuestion(index)}
                            />
                        </div>

                        {/* 分支跳转配置（times） */}
                        <div className="mt-4 p-3 rounded-lg border border-surface-200 bg-surface-50">
                            <div className="text-xs font-bold text-surface-600 mb-2">条件分支（可选）</div>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-surface-600 w-20 shrink-0">默认跳转</span>
                                    <Dropdown
                                        value={
                                            timesBranching.defaultNext === undefined
                                                ? '__NEXT__'
                                                : (timesBranching.defaultNext === null ? '__END__' : timesBranching.defaultNext)
                                        }
                                        options={timesBranchOptions}
                                        onChange={(e) => setBranchDefault(index, e.value)}
                                        className="w-full"
                                        placeholder="选择默认跳转"
                                    />
                                </div>

                                {opts.map((num) => {
                                    const cur = timesBranching?.rules?.[num];
                                    const val = cur === undefined ? '__NEXT__' : (cur === null ? '__END__' : cur);
                                    return (
                                        <div key={`times-branch-${num}`} className="flex items-center gap-2">
                                            <span className="text-xs text-surface-600 w-20 shrink-0">{num} 次</span>
                                            <Dropdown
                                                value={val}
                                                options={timesBranchOptions}
                                                onChange={(e) => setBranchRule(index, num, e.value)}
                                                className="w-full"
                                                placeholder="选择跳转目标"
                                            />
                                        </div>
                                    );
                                })}
                                <div className="text-[11px] text-surface-500">
                                    提示：这里的规则键是“次数值”（例如 3/4/5），不是选项序号。
                                </div>
                            </div>
                        </div>

                        {renderMediaEditor(question, index)}
                    </div>
                );
            }

            case 'rm':
                return (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="font-medium">用户极限（1RM）</h4>
                                    <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded">可配置</span>
                                </div>
                                <p className="text-sm text-surface-500">
                                    选择学员需要填写 1RM 的动作（建议 3–8 个即可），不再强制把动作库里所有“自动算重量动作”都塞进问卷。
                                </p>

                                <div className="mt-3 space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-surface-600 mb-1">筛选（按动作名）</label>
                                        <InputText
                                            value={rmFilter}
                                            onChange={(e) => setRmFilter(e.target.value)}
                                            placeholder="例如：深蹲 / 卧推 / 引体"
                                            className="w-full"
                                            onMouseDown={stopDndEvent as any}
                                            onTouchStart={stopDndEvent as any}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-surface-600 mb-2">选择动作（来自动作库：已开启自动算重量）</label>
                                        {loadingActions ? (
                                            <div className="space-y-2">
                                                <Skeleton height="2rem" />
                                                <Skeleton height="2rem" />
                                                <Skeleton height="2rem" />
                                            </div>
                                        ) : (
                                            <div className="max-h-[260px] overflow-auto rounded-lg border border-green-200 bg-white p-3 space-y-2">
                                                {autoComputeActions
                                                    .filter(a => {
                                                        const k = rmFilter.trim().toLowerCase();
                                                        if (!k) return true;
                                                        return (a.name || '').toLowerCase().includes(k);
                                                    })
                                                    .map((a) => {
                                                        const selectedIds: string[] = Array.isArray((question as any).actionIds) ? (question as any).actionIds : [];
                                                        const checked = selectedIds.includes(a.id);
                                                        return (
                                                            <div
                                                                key={a.id}
                                                                className="flex items-center gap-2"
                                                                onMouseDown={stopDndEvent}
                                                                onTouchStart={stopDndEvent}
                                                            >
                                                                <Checkbox
                                                                    inputId={`rm-action-${index}-${a.id}`}
                                                                    checked={checked}
                                                                    onChange={(e) => {
                                                                        const newQuestions = [...questions];
                                                                        const q = newQuestions[index];
                                                                        if (q.type !== 'rm') return;
                                                                        const current: string[] = Array.isArray((q as any).actionIds) ? [...(q as any).actionIds] : [];
                                                                        const next = Boolean(e.checked)
                                                                            ? Array.from(new Set([...current, a.id]))
                                                                            : current.filter(id => id !== a.id);
                                                                        (q as any).actionIds = next;
                                                                        setQuestions(newQuestions);
                                                                    }}
                                                                    onMouseDown={stopDndEvent as any}
                                                                    onTouchStart={stopDndEvent as any}
                                                                />
                                                                <label htmlFor={`rm-action-${index}-${a.id}`} className="text-sm text-surface-700">
                                                                    {a.name}
                                                                </label>
                                                                {a.includesBodyWeight && (
                                                                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded ml-1">
                                                                        自重类
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                {autoComputeActions.length === 0 && (
                                                    <div className="text-sm text-surface-500">
                                                        你的动作库里还没有开启“自动算重量”的动作。你可以先去「动作库」开启后再来选择。
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="mt-2 text-[11px] text-surface-500">
                                            学员端只会显示你勾选的动作；没勾选则此题不会要求填写任何动作。
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <Button
                                icon="pi pi-trash"
                                className="p-button-text p-button-danger p-2"
                                onClick={() => removeQuestion(index)}
                            />
                        </div>
                        {renderMediaEditor(question, index)}
                    </div>
                )
            case 'option':
                const branching = (question as any).branching || {};
                const targets = questions
                    .filter(q => q.id && q.id !== question.id)
                    .map(q => ({ label: labelOfQuestion(q), value: q.id as string }));
                const branchOptions = [
                    { label: '顺序下一题（默认）', value: '__NEXT__' },
                    { label: '结束问卷', value: '__END__' },
                    ...targets,
                ];
                return (
                    <div className="mb-4 rounded">
                        <Accordion activeIndex={-1} className='bg-surface-100'>
                            <AccordionTab header={
                                <div className="flex justify-between items-start w-full">
                                    <InputText
                                        value={question.question || ''}
                                        onChange={(e) => updateOptionQuestionText(index, e.target.value)}
                                        placeholder="输入问题..."
                                        className="font-medium flex-1 mr-2"
                                        onMouseDown={stopDndEvent as any}
                                        onTouchStart={stopDndEvent as any}
                                    />
                                    <Button
                                        icon="pi pi-trash"
                                        className="p-button-text p-button-danger p-2"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeQuestion(index);
                                        }}
                                    />
                                </div>
                            }>
                                <div className="ml-2 pt-2">
                                    {question.options.map((option, optionIndex) => (
                                        <div key={optionIndex} className="flex items-center gap-2 mb-1">
                                            <RadioButton
                                                name={`question${index}`}
                                                disabled
                                            />
                                            <InputText
                                                value={option}
                                                onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                                                placeholder={`选项 ${optionIndex + 1}`}
                                                className="flex-1 text-sm"
                                                onMouseDown={stopDndEvent as any}
                                                onTouchStart={stopDndEvent as any}
                                            />
                                            <Button
                                                icon="pi pi-trash"
                                                className="p-button-text p-button-danger p-2"
                                                onClick={() => removeOption(index, optionIndex)}
                                            />
                                        </div>
                                    ))}
                                    <Button
                                        label="添加选项"
                                        icon="pi pi-plus"
                                        onClick={() => addOption(index)}
                                        className="mt-2"
                                        size="small"
                                        outlined
                                    />

                                    {/* 分支跳转配置 */}
                                    <div className="mt-4 p-3 rounded-lg border border-surface-200 bg-surface-50">
                                        <div className="text-xs font-bold text-surface-600 mb-2">条件分支（可选）</div>
                                        <div className="grid grid-cols-1 gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-surface-600 w-20 shrink-0">默认跳转</span>
                                                <Dropdown
                                                    value={
                                                        branching.defaultNext === undefined
                                                            ? '__NEXT__'
                                                            : (branching.defaultNext === null ? '__END__' : branching.defaultNext)
                                                    }
                                                    options={branchOptions}
                                                    onChange={(e) => setBranchDefault(index, e.value)}
                                                    className="w-full"
                                                    placeholder="选择默认跳转"
                                                />
                                            </div>

                                            {question.options.map((opt, optIdx) => {
                                                const cur = branching?.rules?.[optIdx];
                                                const val = cur === undefined ? '__NEXT__' : (cur === null ? '__END__' : cur);
                                                return (
                                                    <div key={`branch-${optIdx}`} className="flex items-center gap-2">
                                                        <span className="text-xs text-surface-600 w-20 shrink-0">选项 {optIdx + 1}</span>
                                                        <Dropdown
                                                            value={val}
                                                            options={branchOptions}
                                                            onChange={(e) => setBranchRule(index, optIdx, e.value)}
                                                            className="w-full"
                                                            placeholder="选择跳转目标"
                                                        />
                                                    </div>
                                                );
                                            })}
                                            <div className="text-[11px] text-surface-500">
                                                提示：不配置则按顺序进入下一题；“结束问卷”会提前结束填写流程。
                                            </div>
                                        </div>
                                    </div>

                                    {renderMediaEditor(question, index)}
                                </div>
                            </AccordionTab>
                        </Accordion>
                    </div>
                );

            case 'text':
                return (
                    <div className="mb-4 p-3 bg-surface-100 rounded">
                        <div className="flex justify-between items-start">
                            <InputText
                                value={question.question}
                                onChange={(e) => {
                                    const newQuestions = [...questions];
                                    if (newQuestions[index].type === 'text') {
                                        newQuestions[index].question = e.target.value;
                                        setQuestions(newQuestions);
                                    }
                                }}
                                placeholder="输入文本问题..."
                                className="font-medium flex-1 mr-2"
                            />
                            <Button
                                icon="pi pi-trash"
                                className="p-button-text p-button-danger p-2"
                                onClick={() => removeQuestion(index)}
                            />
                        </div>
                        {renderMediaEditor(question, index)}
                    </div>
                );

            default:
                return null;
        }
    };

    const renderNewQuestionForm = () => {
        switch (newQuestionType) {
            case 'option':
                return (
                    <OptionQuestionManager
                        onAddOptionQuestion={addOptionQuestion}
                        onCancel={() => {
                            setAddQuestionDialogVisible(false);
                            setNewQuestionType(null);
                        }}
                    />
                );

            case 'text':
                return (
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">文本问题</label>
                        <InputText
                            value={newTextQuestion}
                            onChange={(e) => setNewTextQuestion(e.target.value)}
                            placeholder="输入问题..."
                            className="w-full"
                        />
                    </div>
                );



            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            <Card title="问卷设置" className="mt-6">
                <div className="p-4">
                    <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 rounded-r">
                        <p className="text-sm text-yellow-800">
                            <strong>设置说明：</strong>学员订阅您的服务时，除公共档案（身高/体重/力量数据等）外，还需回答以下问题。
                        </p>
                        <p className="text-sm text-yellow-800 mt-1">
                            建议询问：训练频率、器械限制、特殊需求等。<strong>无需询问基础身体数据</strong>，这些将从学员档案自动获取。
                        </p>
                    </div>

                    <div className="mb-4 p-4 border border-surface-200 rounded-lg bg-surface-0">
                        <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
                            <div className="flex items-center gap-2">
                                <div className="text-sm font-bold">问卷模板</div>
                                {loadingTemplates && <span className="text-xs text-surface-500">加载中...</span>}
                            </div>
                            <div className="flex flex-col md:flex-row gap-2 md:items-center w-full md:w-auto">
                                <div className="flex items-center gap-2">
                                    <Button
                                        label="线上版本"
                                        icon="pi pi-cloud"
                                        onClick={async () => {
                                            setMode('online');
                                            await loadTemplates('online');
                                        }}
                                        className={classNames('w-full md:w-[140px]', {
                                            'p-button-primary': mode === 'online',
                                            'p-button-outlined p-button-secondary': mode !== 'online',
                                        })}
                                    />
                                    <Button
                                        label="草稿版本"
                                        icon="pi pi-wrench"
                                        onClick={async () => {
                                            setMode('draft');
                                            await loadTemplates('draft');
                                        }}
                                        className={classNames('w-full md:w-[140px]', {
                                            'p-button-primary': mode === 'draft',
                                            'p-button-outlined p-button-secondary': mode !== 'draft',
                                        })}
                                    />
                                </div>

                                {mode === 'draft' && (
                                    <div className="flex gap-2">
                                        <Button
                                            label="从线上复制"
                                            icon="pi pi-copy"
                                            outlined
                                            onClick={async () => {
                                                const online = templates.find(i => i.is_active) || null;
                                                if (!online?.id) {
                                                    showToast({ severity: 'warn', summary: '没有线上版本', detail: '请先保存一份上线问卷' });
                                                    return;
                                                }
                                                const created = await coachService.duplicateQuestionnaire({ id: online.id });
                                                if (created?.id) {
                                                    showToast({ severity: 'success', summary: '已复制', detail: '已同步到草稿版本' });
                                                    setMode('draft');
                                                    await loadTemplates('draft');
                                                }
                                            }}
                                        />
                                        <Button
                                            label="发布为线上"
                                            icon="pi pi-upload"
                                            severity="success"
                                            onClick={async () => {
                                                const draft = templates.find(i => !i.is_active) || null;
                                                if (!draft?.id) {
                                                    showToast({ severity: 'warn', summary: '草稿版本为空', detail: '请先在草稿版本里编辑或从线上复制' });
                                                    return;
                                                }
                                                const ok = await coachService.publishQuestionnaire({ id: draft.id });
                                                if (ok?.id) {
                                                    showToast({ severity: 'success', summary: '发布成功', detail: '草稿版本已发布为线上版本' });
                                                    setMode('online');
                                                    await loadTemplates('online');
                                                }
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="mt-2 text-[12px] text-surface-500">
                            建议：线上版本保持稳定；试验新功能先复制到草稿版本，在草稿里修改验证，满意后再切换默认/上线。
                        </div>
                    </div>

                    <div className="mb-6 p-4 bg-primary-50 border border-primary-200 rounded-lg">
                        <div className="text-sm text-primary-800">
                            <strong>分支问卷怎么配？</strong> 分支配置入口在题目卡片内部：
                            <strong>「选项问题」</strong>展开后会出现「条件分支（可选）」。
                            （我也会把<strong>「每周训练次数」</strong>的分支配置加上）
                        </div>
                        <div className="text-[12px] text-primary-700 mt-1">
                            规则：分支题（选项/次数）可以为每个分支配置跳转目标；若某个分支走到末端，
                            <strong>想继续往下或回到主干</strong>，需要在末端节点继续点「顺序下一题」新增，或在分支规则里跳转到指定节点。
                            （否则学员端在该分支末端会默认结束，不会再串到其它分支，避免出现“重复题/逻辑跳跃”。）
                        </div>
                    </div>

                    {/* 问题列表 */}
                    <div className="mb-8 p-4 border border-surface-200 rounded-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg">问题设置</h3>
                            <div className="flex gap-2">
                                <Button
                                    label="流程图视图"
                                    icon="pi pi-share-alt"
                                    size="small"
                                    outlined={editorView !== 'flow'}
                                    onClick={() => setEditorView('flow')}
                                />
                                <Button
                                    label="树形视图"
                                    icon="pi pi-sitemap"
                                    size="small"
                                    outlined={editorView !== 'tree'}
                                    onClick={() => setEditorView('tree')}
                                />
                                <Button
                                    label="列表视图"
                                    icon="pi pi-list"
                                    size="small"
                                    outlined={editorView !== 'list'}
                                    onClick={() => setEditorView('list')}
                                />
                            </div>
                        </div>

                        {editorView === 'flow' && (
                            <div className="mb-6">
                                <div className="text-sm text-surface-600 mb-2">
                                    这是“真正的流程图”：节点可点编辑；节点内可对<strong>顺序下一题</strong>或<strong>分支</strong>直接点「+ 新增」；垃圾桶支持删除（含删子树）。
                                </div>
                                {questions.length === 0 ? (
                                    <div className="p-6 rounded-lg border border-surface-200 bg-surface-50 text-surface-500 text-sm">
                                        还没有问题。请先点下方「添加问题」创建第一题，然后流程图会自动生成。
                                    </div>
                                ) : (
                                    <QuestionnaireFlow
                                        questions={questions}
                                        highlightQuestionId={highlightQuestionId}
                                        onJumpToQuestion={openEditDialog}
                                        onRequestAdd={(ctx, e) => openFlowAddOverlay(ctx as any, e)}
                                        onRequestDelete={(ctx, e) => openDeleteOverlay(e, (ctx as any).questionId)}
                                    />
                                )}
                            </div>
                        )}

                        {editorView === 'tree' && (
                            <div className="mb-6">
                                <div className="text-sm text-surface-600 mb-2">
                                    使用方式：前面可以先是文本/非分支题（顺序执行），当出现<strong>选项问题</strong>或<strong>每周训练次数</strong>时，再在对应分支上点击「在此分支新增下一题」即可。
                                </div>
                                <div className="border border-surface-200 rounded-lg p-3 bg-surface-50">
                                    <Tree value={buildTree()} />
                                </div>
                            </div>
                        )}

                        {questions.length === 0 ? (
                            <div className="space-y-4">
                                <Skeleton height="3rem" className="mb-2" />
                                <Skeleton height="4rem" className="mb-2" />
                                <Skeleton height="4rem" width="80%" className="mb-2" />
                                <Skeleton height="3rem" width="60%" />
                                <div className="text-center text-surface-500 mt-4">
                                    <p className="text-sm">添加问题后，学员订阅时将需要回答这些问题</p>
                                </div>
                            </div>
                        ) : editorView === 'list' ? (
                            <DragDropContext onDragEnd={onDragEnd}>
                                <Droppable droppableId="questions"
                                    direction='vertical'
                                    isDropDisabled={false}
                                    isCombineEnabled={false}
                                    ignoreContainerClipping
                                >
                                    {(provided, snapshot) => (
                                        <div
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                        >
                                            {/* 使用稳定 id 作为 draggableId，避免拖拽/重排时交互异常 */}
                                            {questions.map((question, index) => (
                                                <Draggable key={(question as any).id || `${question.type}-${index}`} draggableId={(question as any).id || `${question.type}-${index}`} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            id={(question as any)?.id ? `question-${(question as any).id}` : undefined}
                                                            className={classNames(
                                                                `relative ${snapshot.isDragging ? 'shadow-lg' : ''}`,
                                                                highlightQuestionId === (question as any)?.id ? 'ring-2 ring-primary-300 rounded-lg' : ''
                                                            )}
                                                        >
                                                            {/* 独立拖拽把手：避免把整块卡片变成 drag handle，导致内部控件无法点击 */}
                                                            <div
                                                                {...provided.dragHandleProps}
                                                                className="absolute right-2 top-2 z-10 w-8 h-8 rounded-full bg-surface-0 border border-surface-200 flex items-center justify-center cursor-grab active:cursor-grabbing text-surface-500 hover:text-primary hover:border-primary-200"
                                                                title="拖拽排序"
                                                                onMouseDown={stopDndEvent}
                                                                onTouchStart={stopDndEvent}
                                                            >
                                                                <i className="pi pi-bars text-sm" />
                                                            </div>
                                                            {renderQuestion(question, index)}
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap gap-3 w-full justify-between mt-10">
                        <div>
                            <div className="flex gap-2">
                                <Button
                                    label="预览问卷"
                                    icon="pi pi-eye"
                                    onClick={() => setPreviewDialogVisible(true)}
                                    className="w-full md:w-auto"
                                    outlined
                                />
                                <Button
                                    label="添加问题"
                                    icon="pi pi-plus"
                                    onClick={(e) => overlayPanel.current?.toggle(e)}
                                    className="w-full md:w-auto"
                                />
                            </div>
                        </div>
                        <Button
                            label="保存问卷设置"
                            icon="pi pi-save"
                            onClick={saveQuestions}
                            loading={saving}
                            className="w-full md:w-auto"
                        />
                    </div>
                </div>
            </Card>

            {/* 添加问题的OverlayPanel */}
            <AddQuestionOverlay
                overlayPanel={overlayPanel}
                questions={questions}
                onAddTagsQuestion={addTagsQuestion}
                onAddTimesQuestion={addTimesQuestion}
                onAddRmQuestion={addRmQuestion}
                onAddOptionQuestion={() => {
                    setNewQuestionType('option');
                    setAddQuestionDialogVisible(true);
                    overlayPanel.current?.hide();
                }}
                onAddTextQuestion={() => {
                    setNewQuestionType('text');
                    setAddQuestionDialogVisible(true);
                    overlayPanel.current?.hide();
                }}
            />

            {/* 树形视图：在某个分支新增下一题 */}
            <OverlayPanel ref={branchOverlayRef}>
                <div className="flex flex-col gap-2 w-[240px]">
                    <div className="text-xs font-bold text-surface-600">新增下一题类型</div>
                    <div className="text-[11px] text-surface-600">
                        当前位置：
                        {pendingBranch?.kind === 'sequential' && <span className="font-bold ml-1">顺序下一题</span>}
                        {pendingBranch?.kind === 'default' && <span className="font-bold ml-1">默认分支</span>}
                        {pendingBranch?.kind === 'option' && (
                            <span className="font-bold ml-1">选项 {Number(pendingBranch?.ruleKey ?? 0) + 1}</span>
                        )}
                        {pendingBranch?.kind === 'times' && (
                            <span className="font-bold ml-1">{pendingBranch?.ruleKey} 次</span>
                        )}
                    </div>
                    <Button label="选项问题（可继续分支）" icon="pi pi-list" onClick={() => attachNewQuestionToBranch('option')} />
                    <Button label="文本问题" icon="pi pi-pencil" onClick={() => attachNewQuestionToBranch('text')} outlined />
                    <Button label="每周训练次数" icon="pi pi-calendar" onClick={() => attachNewQuestionToBranch('times')} outlined />
                    <Button label="训练项目偏好" icon="pi pi-tags" onClick={() => attachNewQuestionToBranch('tags')} outlined />
                    <Button label="用户极限（1RM）" icon="pi pi-chart-bar" onClick={() => attachNewQuestionToBranch('rm')} outlined />
                </div>
            </OverlayPanel>

            {/* 树形视图：删除（仅删节点 / 删节点+子树） */}
            <OverlayPanel ref={deleteOverlayRef}>
                <div className="flex flex-col gap-2 w-[240px]">
                    <div className="text-xs font-bold text-surface-600">删除方式</div>
                    <Button
                        label="仅删除此节点"
                        icon="pi pi-trash"
                        severity="danger"
                        onClick={() => pendingDeleteId && deleteSingleNode(pendingDeleteId)}
                    />
                    <Button
                        label="删除此节点及其后续子树"
                        icon="pi pi-sitemap"
                        severity="danger"
                        outlined
                        onClick={() => pendingDeleteId && deleteSubtree(pendingDeleteId)}
                    />
                    <div className="text-[11px] text-surface-500">
                        “子树删除”会自动保留被其它分支复用的节点，避免误删共享问题。
                    </div>
                </div>
            </OverlayPanel>

            {/* 添加问题对话框（使用新组件） */}
            <AddQuestionDialog
                visible={addQuestionDialogVisible}
                newQuestionType={newQuestionType}
                renderNewQuestionForm={renderNewQuestionForm}
                onAddTextQuestion={addTextQuestion}
                onCancel={() => {
                    setAddQuestionDialogVisible(false);
                    setNewQuestionType(null);
                    setNewTextQuestion('');
                }}
            />

            {/* 问卷预览对话框 */}
            <QuestionPreviewDialog
                visible={previewDialogVisible}
                onHide={() => setPreviewDialogVisible(false)}
                questions={questions}
                coachId={coach?.id || ''}
            />

            {/* 流程图/树形：就地编辑，不跳转视图 */}
            <Dialog
                header="编辑问题"
                visible={editDialogVisible}
                onHide={() => {
                    setEditDialogVisible(false);
                    setEditDialogQuestionId(null);
                }}
                style={{ width: '860px', maxWidth: '95vw' }}
                modal
            >
                {(() => {
                    if (!editDialogQuestionId) return null;
                    const idx = questionIndexById.get(editDialogQuestionId);
                    if (typeof idx !== 'number') return <div className="text-sm text-surface-500">未找到该问题</div>;
                    return (
                        <div className="pt-2">
                            <div className="text-[12px] text-surface-500 mb-2">
                                提示：这里的修改会立即反映在流程图上，最终请点击页面下方「保存问卷设置」。
                            </div>
                            {renderQuestion(questions[idx], idx)}
                        </div>
                    );
                })()}
            </Dialog>

            {/* 预设库导入选择对话框 */}
            <Dialog
                header="从预设库选择导入"
                visible={importDialogVisible}
                onHide={() => setImportDialogVisible(false)}
                style={{ width: '450px' }}
                modal
                footer={
                    <div className="flex justify-end gap-2">
                        <Button
                            label="取消"
                            icon="pi pi-times"
                            onClick={() => setImportDialogVisible(false)}
                            className="p-button-text"
                        />
                        <Button
                            label={`导入 (${selectedImportItems.length})`}
                            icon="pi pi-check"
                            onClick={() => {
                                if (importTargetIndex < 0 || selectedImportItems.length === 0) {
                                    setImportDialogVisible(false);
                                    return;
                                }
                                const newQuestions = [...questions];
                                const q = newQuestions[importTargetIndex];
                                if (q.type !== 'tags') {
                                    setImportDialogVisible(false);
                                    return;
                                }
                                const currentOptions: string[] = Array.isArray((q as any).options) ? (q as any).options : [];
                                const existingSet = new Set(currentOptions.filter(o => o.trim()));
                                const merged = [...currentOptions.filter(o => o.trim())];
                                for (const name of selectedImportItems) {
                                    if (!existingSet.has(name)) {
                                        merged.push(name);
                                    }
                                }
                                (q as any).options = merged;
                                setQuestions(newQuestions);
                                showToast({
                                    severity: 'success',
                                    summary: '导入成功',
                                    detail: `已导入 ${selectedImportItems.length} 个训练项目`
                                });
                                setImportDialogVisible(false);
                            }}
                            disabled={selectedImportItems.length === 0}
                        />
                    </div>
                }
            >
                <div className="space-y-2">
                    <div className="text-sm text-surface-500 mb-3">
                        选择要导入的训练项目（已存在的项目会自动跳过）
                    </div>
                    <div className="flex justify-between mb-2">
                        <Button
                            label="全选"
                            size="small"
                            text
                            onClick={() => setSelectedImportItems(trainingItemOptions.map(o => o.value))}
                        />
                        <Button
                            label="取消全选"
                            size="small"
                            text
                            onClick={() => setSelectedImportItems([])}
                        />
                    </div>
                    <div className="max-h-[300px] overflow-auto border border-surface-200 rounded-lg p-2 space-y-1">
                        {trainingItemOptions.map((item) => (
                            <div
                                key={item.value}
                                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                                    selectedImportItems.includes(item.value)
                                        ? 'bg-primary-50 border border-primary-200'
                                        : 'hover:bg-surface-50'
                                }`}
                                onClick={() => {
                                    setSelectedImportItems(prev =>
                                        prev.includes(item.value)
                                            ? prev.filter(v => v !== item.value)
                                            : [...prev, item.value]
                                    );
                                }}
                            >
                                <Checkbox
                                    checked={selectedImportItems.includes(item.value)}
                                    onChange={() => {}}
                                />
                                <span className="text-sm">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </Dialog>
        </div>
    );
};

export default QuestionarePage;