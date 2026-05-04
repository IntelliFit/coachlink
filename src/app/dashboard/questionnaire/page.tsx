'use client';

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { coachService } from '@/app/service/coachService';
import { Skeleton } from 'primereact/skeleton';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Card } from 'primereact/card';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { RadioButton } from 'primereact/radiobutton';
import { OverlayPanel } from 'primereact/overlaypanel';
import { Accordion, AccordionTab } from 'primereact/accordion';
import { Tree } from 'primereact/tree';
import { useToastContext } from '@/context/ToastContext';
import QuestionPreviewDialog from './components/QuestionPreviewDialog';
import AddQuestionOverlay from './components/AddQuestionOverlay';
import AddQuestionDialog, { type QuestionnaireComposerType } from './components/AddQuestionDialog';
import OptionQuestionManager from './components/OptionQuestionManager';
import QuestionnaireFlow from './components/QuestionnaireFlow';
import type { TrainingItem, TrainingOptionQuestion, TrainingTextQuestion, QuestionMedia, QuestionnaireEditorType } from '@/types/questionnaires';
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

const EMPTY_QUESTIONNAIRE: TrainingItem[] = [];

const QuestionarePage = () => {
    const { data: session } = useSession();
    const { showToast } = useToastContext();
    const overlayPanel = useRef<OverlayPanel>(null);

    const [questionId, setQuestionId] = useState<string | null>(null);
    const [questions, setQuestions] = useState<TrainingItem[]>([]);
    const [saving, setSaving] = useState<boolean>(false);
    const [addQuestionDialogVisible, setAddQuestionDialogVisible] = useState<boolean>(false);
    const [previewDialogVisible, setPreviewDialogVisible] = useState<boolean>(false);
    const [newQuestionType, setNewQuestionType] = useState<QuestionnaireComposerType | null>(null);

    const [coach, setCoach] = useState<CoachesRow>(null);

    // 多问卷模板
    const [templates, setTemplates] = useState<QuestionnaireTemplateItem[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [templateName, setTemplateName] = useState<string>('列表问卷');
    const [templateStatus, setTemplateStatus] = useState<'active' | 'draft'>('draft');
    const [editorType, setEditorType] = useState<QuestionnaireEditorType>('simple');
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [editorView, setEditorView] = useState<'flow' | 'list'>('list');
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

    const normalizeEditorQuestions = (input: TrainingItem[]) => {
        const trainingQuestions: TrainingItem[] = [];

        for (const item of input || []) {
            switch (item.type) {
                case 'tags':
                    trainingQuestions.push({
                        id: (item as any).id || uuidv4(),
                        type: 'tags',
                        options: Array.isArray((item as any).options) ? (item as any).options : [],
                        branching: (item as any).branching,
                        media: (item as any).media,
                        next: (item as any).next,
                    });
                    break;
                case 'times':
                    trainingQuestions.push({
                        id: (item as any).id || uuidv4(),
                        type: 'times',
                        question: (item as any).question,
                        options: (item as any).options,
                        branching: (item as any).branching,
                        media: (item as any).media,
                        next: (item as any).next,
                    });
                    break;
                case 'rm':
                    trainingQuestions.push({
                        id: (item as any).id || uuidv4(),
                        type: 'rm',
                        actionIds: Array.isArray((item as any).actionIds) ? (item as any).actionIds : [],
                        media: (item as any).media,
                        next: (item as any).next,
                    });
                    break;
                case 'option':
                    trainingQuestions.push({
                        id: (item as any).id || uuidv4(),
                        type: 'option',
                        question: item.question,
                        options: item.options,
                        selectionMode: (item as any).selectionMode === 'multiple' ? 'multiple' : 'single',
                        allowOther: Boolean((item as any).allowOther),
                        branching: (item as any).branching,
                        media: (item as any).media,
                        next: (item as any).next,
                    });
                    break;
                case 'text':
                    trainingQuestions.push({
                        id: (item as any).id || uuidv4(),
                        type: 'text',
                        question: item.question,
                        media: (item as any).media,
                        next: (item as any).next,
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

        return trainingQuestions;
    };

    const loadQuestionnaireDetail = async (id: string) => {
        const res = await coachService.getQuestionnaireById({ id });
        if (!res) {
            showToast({ severity: 'error', summary: '错误', detail: '加载问卷失败' });
            return;
        }

        setQuestionId(res.id);
        setSelectedTemplateId(res.id);
        setTemplateName(res.name || (res.editorType === 'flow' ? '流程图问卷' : '列表问卷'));
        setTemplateStatus(res.status === 'active' ? 'active' : 'draft');
        setEditorType(res.editorType === 'flow' ? 'flow' : 'simple');
        setEditorView(res.editorType === 'flow' ? 'flow' : 'list');
        setQuestions(normalizeEditorQuestions(res.questionnaires as any));
    };

    const createNewTemplate = (nextType: QuestionnaireEditorType) => {
        setQuestionId(null);
        setSelectedTemplateId(null);
        setTemplateName(nextType === 'flow' ? '流程图问卷' : '列表问卷');
        setTemplateStatus('draft');
        setEditorType(nextType);
        setEditorView(nextType === 'flow' ? 'flow' : 'list');
        setQuestions([...EMPTY_QUESTIONNAIRE]);
        setHighlightQuestionId(null);
    };

    const loadTemplates = async (preferredId?: string | null) => {
        if (!session?.user?.id) return;
        setLoadingTemplates(true);
        try {
            const res = await coachService.listQuestionnaires();
            const items = res?.items || [];
            setTemplates(items);

            const nextId = preferredId
                || selectedTemplateId
                || items.find((item) => item.status === 'active')?.id
                || items[0]?.id
                || null;

            if (nextId) {
                await loadQuestionnaireDetail(nextId);
            } else {
                createNewTemplate('simple');
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
            if (editorType === 'flow') {
                const idSet = new Set(questions.map((q: any) => q.id).filter(Boolean));
                for (const q of questions as any[]) {
                    const branching = q?.branching;
                    if (!branching) continue;
                    const selfId = q.id;

                    const isMultiOption =
                        q.type === 'option'
                        && ((q.selectionMode === 'multiple') || Boolean((q as any).allowOther));
                    const branchingHasRules = branching.rules
                        && typeof branching.rules === 'object'
                        && Object.keys(branching.rules).length > 0;
                    const branchingNotAllowed = q.type === 'tags' || isMultiOption;

                    if (branchingNotAllowed && branchingHasRules) {
                        const reason = q.type === 'tags'
                            ? '为多选题（tags），暂不支持按选项分支'
                            : '为多选题（含「其他」选项也按多选处理），仅支持配置「默认跳转」';
                        showToast({
                            severity: 'error',
                            summary: '分支配置不支持',
                            detail: `问题「${labelOfQuestion(q)}」${reason}。请仅配置「默认跳转」。`,
                        });
                        setSaving(false);
                        return;
                    }

                    const checkTarget = (target: any, label: string) => {
                        if (target === undefined) return true;
                        if (target === null) return true;
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
                    if (!branchingNotAllowed && branching.rules && typeof branching.rules === 'object') {
                        for (const [k, v] of Object.entries(branching.rules)) {
                            if (!checkTarget(v as any, `问题「${labelOfQuestion(q)}」选项 ${Number(k) + 1} 跳转`)) {
                                setSaving(false);
                                return;
                            }
                        }
                    }
                }
            }

            const questionsForSave = editorType === 'simple'
                ? questions.map((question: any) => {
                    const { branching, next, scope, ...rest } = question || {};
                    return rest;
                })
                : questions.map((question: any) => {
                    const { scope, ...rest } = question || {};
                    return rest;
                });

            const result = await coachService.updateQuestionnaires({
                id: questionId || undefined,
                name: templateName.trim() || (editorType === 'flow' ? '流程图问卷' : '列表问卷'),
                editorType,
                questionnaires: questionsForSave,
            });

            if (result) {
                setQuestionId(result.id);
                setSelectedTemplateId(result.id);
                setTemplateStatus('draft');
                showToast({ severity: 'success', summary: '成功', detail: '问卷设置已保存' });
                await loadTemplates(result.id);
            }
        } catch (error) {
            console.error('保存问卷失败:', error);
            showToast({ severity: 'error', summary: '错误', detail: '保存问卷失败' });
        } finally {
            setSaving(false);
        }
    };

    // 由于 react-beautiful-dnd 可能将整块区域作为拖拽句柄，交互控件需要阻止事件冒泡，避免点击被当成拖拽
    const stopDndEvent = (e: any) => {
        if (!e) return;
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
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
            showToast({ severity: 'error', summary: '错误', detail: '请输入有效的问题内容' });
        }
    };

    const openAddQuestionDialog = (type: QuestionnaireComposerType) => {
        setNewQuestionType(type);
        setAddQuestionDialogVisible(true);
        if (type === 'text') {
            setNewTextQuestion('');
        }
        overlayPanel.current?.hide();
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

    const createQuestionByType = (t: QuestionnaireComposerType): TrainingItem => {
        const id = uuidv4();
        switch (t) {
            case 'option-single':
                return {
                    id,
                    type: 'option',
                    question: '请输入问题',
                    options: ['选项1', '选项2'],
                    selectionMode: 'single',
                    allowOther: false,
                };
            case 'option-multiple':
                return {
                    id,
                    type: 'option',
                    question: '请输入问题',
                    options: ['选项1', '选项2'],
                    selectionMode: 'multiple',
                    allowOther: false,
                };
            case 'text':
                return { id, type: 'text', question: '请输入问题' };
            default:
                return { id, type: 'text', question: '请输入问题' };
        }
    };

    const attachNewQuestionToBranch = (t: QuestionnaireComposerType) => {
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
                        建议：图片 ≤ 5MB；视频建议 ≤ 200MB（用作动作示例/说明）。
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
            case 'times':
            case 'rm': {
                const legacyLabel = question.type === 'tags'
                    ? '训练项目偏好（已下线题型）'
                    : question.type === 'times'
                        ? '每周训练次数（已下线题型）'
                        : '用户极限 1RM（已下线题型）';
                return (
                    <div className="mb-4 p-3 bg-surface-100 rounded border border-surface-200">
                        <div className="flex justify-between items-start gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-surface-700">{legacyLabel}</h4>
                                    <span className="text-[11px] px-2 py-0.5 rounded bg-surface-200 text-surface-600">
                                        只读
                                    </span>
                                </div>
                                <p className="text-sm text-surface-500 mt-1">
                                    该题型已下线、不再支持编辑;新建问卷时请改用纯文本/单选/多选题。如不需要可直接删除。
                                </p>
                            </div>
                            <Button
                                icon="pi pi-trash"
                                className="p-button-text p-button-danger p-2"
                                onClick={() => removeQuestion(index)}
                                tooltip="删除此题"
                                tooltipOptions={{ position: 'top' }}
                            />
                        </div>
                    </div>
                );
            }
            case 'option':
                const branching = (question as any).branching || {};
                const selectionMode = (question as any).selectionMode === 'multiple' ? 'multiple' : 'single';
                const allowOther = Boolean((question as any).allowOther);
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
                                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-surface-600">
                                        <span className="rounded-full bg-surface-200 px-3 py-1">
                                            {selectionMode === 'multiple' ? '多选题' : '单选题'}
                                        </span>
                                        {allowOther && (
                                            <span className="rounded-full bg-surface-200 px-3 py-1">
                                                含“其他”补充
                                            </span>
                                        )}
                                    </div>
                                    {question.options.map((option, optionIndex) => (
                                        <div key={optionIndex} className="flex items-center gap-2 mb-1">
                                            {selectionMode === 'multiple' ? (
                                                <Checkbox checked={false} onChange={() => undefined} disabled />
                                            ) : (
                                                <RadioButton name={`question${index}`} disabled />
                                            )}
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
                                    <div className="mt-3 flex items-center gap-2">
                                        <Checkbox
                                            inputId={`allow-other-${index}`}
                                            checked={allowOther}
                                            onChange={(e) => {
                                                const newQuestions = [...questions];
                                                const q = newQuestions[index];
                                                if (q.type !== 'option') return;
                                                (q as any).allowOther = Boolean(e.checked);
                                                setQuestions(newQuestions);
                                            }}
                                        />
                                        <label htmlFor={`allow-other-${index}`} className="text-sm text-surface-700">
                                            增加“其他”选项，并允许学员补充文字
                                        </label>
                                    </div>

                                    {editorType === 'flow' && (() => {
                                        const limitedToDefault = selectionMode === 'multiple' || allowOther;
                                        return (
                                            <div className="mt-4 p-3 rounded-lg border border-surface-200 bg-surface-50">
                                                <div className="text-xs font-bold text-surface-600 mb-2">
                                                    {limitedToDefault ? '默认跳转（可选）' : '条件分支（可选）'}
                                                </div>
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

                                                    {!limitedToDefault && question.options.map((opt, optIdx) => {
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
                                                        {limitedToDefault
                                                            ? (selectionMode === 'multiple'
                                                                ? '多选题只支持「填完后整体跳转」（默认跳转），不支持按选项分支。'
                                                                : '勾选了「其他」选项后,该题按多选处理,只支持「填完后整体跳转」(默认跳转),不支持按选项分支。')
                                                            : '提示：不配置则按顺序进入下一题；“结束问卷”会提前结束填写流程。'}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

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
                            <div className="flex-1 mr-2">
                                <label className="block text-xs font-bold text-surface-600 mb-2">文本问题</label>
                                <InputTextarea
                                    value={question.question}
                                    onChange={(e) => {
                                        const newQuestions = [...questions];
                                        if (newQuestions[index].type === 'text') {
                                            newQuestions[index].question = e.target.value;
                                            setQuestions(newQuestions);
                                        }
                                    }}
                                    placeholder="例如：你目前最大的训练目标是什么？"
                                    className="w-full"
                                    rows={4}
                                />
                            </div>
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
            case 'option-single':
            case 'option-multiple':
                return (
                    <OptionQuestionManager
                        onAddOptionQuestion={addOptionQuestion}
                        selectionMode={newQuestionType === 'option-multiple' ? 'multiple' : 'single'}
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
                        <InputTextarea
                            value={newTextQuestion}
                            onChange={(e) => setNewTextQuestion(e.target.value)}
                            placeholder="例如：你目前最大的训练目标是什么？"
                            className="w-full"
                            rows={4}
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
                            <strong>推荐做法：</strong>大多数教练先用「列表式问卷」就够了，按顺序添加几个问题即可。
                        </p>
                        <p className="text-sm text-yellow-800 mt-1">
                            只有你确实需要“答 A 走这条路、答 B 走另一条路”时，再新建「流程图式问卷」。
                        </p>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
                        <div className="border border-surface-200 rounded-lg bg-surface-0 p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-lg">我的问卷</h3>
                                {loadingTemplates && (
                                    <ProgressSpinner style={{ width: '18px', height: '18px' }} strokeWidth="4" />
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                                <Button
                                    label="新建列表式问卷"
                                    icon="pi pi-list"
                                    onClick={() => createNewTemplate('simple')}
                                    className="w-full"
                                />
                                <Button
                                    label="新建流程图式问卷"
                                    icon="pi pi-share-alt"
                                    outlined
                                    onClick={() => createNewTemplate('flow')}
                                    className="w-full"
                                />
                            </div>

                            <div className="text-[12px] text-surface-500">
                                你可以维护很多份问卷，但同一时间只会有一份是已发布版本，学员实际填写的也是这一份。
                            </div>

                            <div className="space-y-2">
                                {templates.length === 0 ? (
                                    <div className="border border-dashed border-surface-300 rounded-lg p-4 text-sm text-surface-500">
                                        还没有已保存的问卷。先新建一份列表式问卷最省心。
                                    </div>
                                ) : templates.map((item) => {
                                    const active = selectedTemplateId === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            className={classNames(
                                                'w-full text-left border rounded-lg p-3 transition-colors',
                                                active
                                                    ? 'border-primary bg-primary-50'
                                                    : 'border-surface-200 bg-white hover:border-primary-200 hover:bg-surface-50',
                                            )}
                                            onClick={() => loadQuestionnaireDetail(item.id)}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="font-medium text-surface-900 truncate">{item.name}</div>
                                                    <div className="text-[12px] text-surface-500 mt-1">
                                                        {item.editorType === 'flow' ? '流程图式问卷' : '列表式问卷'}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                    <span className={classNames(
                                                        'text-[11px] px-2 py-1 rounded-full',
                                                        item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-surface-100 text-surface-600',
                                                    )}>
                                                        {item.status === 'active' ? '已发布' : '未发布'}
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="border border-surface-200 rounded-lg bg-surface-0 p-4">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="flex-1 space-y-3">
                                        <div>
                                            <label className="block text-xs font-bold text-surface-600 mb-2">问卷名称</label>
                                            <InputText
                                                value={templateName}
                                                onChange={(e) => setTemplateName(e.target.value)}
                                                placeholder="例如：新学员基础问卷"
                                                className="w-full"
                                            />
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <span className={classNames(
                                                'text-xs px-3 py-1 rounded-full',
                                                templateStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-surface-100 text-surface-600',
                                            )}>
                                                {templateStatus === 'active' ? '当前已发布' : '编辑中'}
                                            </span>
                                            <span className={classNames(
                                                'text-xs px-3 py-1 rounded-full border',
                                                editorType === 'flow'
                                                    ? 'bg-primary-50 text-primary-700 border-primary-200'
                                                    : 'bg-orange-50 text-orange-700 border-orange-200',
                                            )}>
                                                {editorType === 'flow' ? '流程图式问卷' : '列表式问卷'}
                                            </span>
                                        </div>

                                        <div className="text-sm text-surface-600">
                                            {editorType === 'simple'
                                                ? '列表式问卷只能按顺序提问，适合绝大多数教练。'
                                                : '流程图式问卷支持按选项或训练次数分叉，适合复杂筛查流程。'}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            label="预览"
                                            icon="pi pi-eye"
                                            outlined
                                            onClick={() => setPreviewDialogVisible(true)}
                                        />
                                        {questionId && (
                                            <Button
                                                label="复制一份"
                                                icon="pi pi-copy"
                                                outlined
                                                onClick={async () => {
                                                    const copied = await coachService.duplicateQuestionnaire({
                                                        id: questionId,
                                                        name: `${templateName || '问卷'} 副本`,
                                                    });
                                                    if (copied?.id) {
                                                        showToast({ severity: 'success', summary: '已复制', detail: '已新建一份问卷副本' });
                                                        await loadTemplates(copied.id);
                                                    }
                                                }}
                                            />
                                        )}
                                        <Button
                                            label="保存"
                                            icon="pi pi-save"
                                            onClick={saveQuestions}
                                            loading={saving}
                                        />
                                        <Button
                                            label={templateStatus === 'active' ? '已发布' : '发布'}
                                            icon="pi pi-upload"
                                            severity="success"
                                            disabled={templateStatus === 'active'}
                                            onClick={async () => {
                                                if (!questionId) {
                                                    showToast({ severity: 'warn', summary: '请先保存', detail: '保存后才能发布这份问卷' });
                                                    return;
                                                }
                                                const ok = await coachService.publishQuestionnaire({ id: questionId });
                                                if (ok?.id) {
                                                    showToast({ severity: 'success', summary: '发布成功', detail: '这份问卷已经成为学员会填写的版本' });
                                                    await loadTemplates(questionId);
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="border border-surface-200 rounded-lg bg-surface-0 p-4">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                                    <h3 className="font-bold text-lg">问题设置</h3>
                                    {editorType === 'flow' ? (
                                        <div className="flex gap-2">
                                            <Button
                                                label="流程图视图"
                                                icon="pi pi-share-alt"
                                                size="small"
                                                outlined={editorView !== 'flow'}
                                                onClick={() => setEditorView('flow')}
                                            />
                                            <Button
                                                label="列表视图"
                                                icon="pi pi-list"
                                                size="small"
                                                outlined={editorView !== 'list'}
                                                onClick={() => setEditorView('list')}
                                            />
                                        </div>
                                    ) : (
                                        <div className="text-sm text-surface-500">
                                            列表式问卷按顺序编辑和展示，不需要分支视图。
                                        </div>
                                    )}
                                </div>

                                {editorType === 'flow' && editorView === 'flow' && (
                                    <div className="mb-6">
                                        <div className="text-sm text-surface-600 mb-2">
                                            在流程图里可以直接看到分叉关系，节点上也能继续添加下一题。
                                        </div>
                                        {questions.length === 0 ? (
                                            <div className="p-6 rounded-lg border border-surface-200 bg-surface-50 text-surface-500 text-sm">
                                                当前还没有问题，请先添加第一个问题。
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

                                {questions.length === 0 ? (
                                    <div className="space-y-4">
                                        <Skeleton height="3rem" className="mb-2" />
                                        <Skeleton height="4rem" className="mb-2" />
                                        <Skeleton height="4rem" width="80%" className="mb-2" />
                                        <Skeleton height="3rem" width="60%" />
                                        <div className="text-center text-surface-500 mt-4">
                                            <p className="text-sm">当前还是空白问卷，请先添加第一个问题。</p>
                                        </div>
                                    </div>
                                ) : (editorType === 'simple' || editorView === 'list') ? (
                                    <DragDropContext onDragEnd={onDragEnd}>
                                        <Droppable droppableId="questions"
                                            direction='vertical'
                                            isDropDisabled={false}
                                            isCombineEnabled={false}
                                            ignoreContainerClipping
                                        >
                                            {(provided) => (
                                                <div
                                                    {...provided.droppableProps}
                                                    ref={provided.innerRef}
                                                >
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

                                <div className="flex flex-wrap gap-3 w-full justify-between mt-10">
                                    <div className="flex gap-2 flex-wrap">
                                        <Button
                                            label="预览问卷"
                                            icon="pi pi-eye"
                                            onClick={() => setPreviewDialogVisible(true)}
                                            className="w-full md:w-auto"
                                            outlined
                                        />
                                        <Button
                                            label="清空所有问题"
                                            icon="pi pi-refresh"
                                            onClick={() => setQuestions([])}
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
                                    <Button
                                        label="保存当前问卷"
                                        icon="pi pi-save"
                                        onClick={saveQuestions}
                                        loading={saving}
                                        className="w-full md:w-auto"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* 添加问题的OverlayPanel */}
            <AddQuestionOverlay
                overlayPanel={overlayPanel}
                questions={questions}
                onAddTextQuestion={() => openAddQuestionDialog('text')}
                onAddSingleOptionQuestion={() => openAddQuestionDialog('option-single')}
                onAddMultiOptionQuestion={() => openAddQuestionDialog('option-multiple')}
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
                    <Button label="单选题" icon="pi pi-circle" onClick={() => attachNewQuestionToBranch('option-single')} />
                    <Button label="多选题" icon="pi pi-check-square" onClick={() => attachNewQuestionToBranch('option-multiple')} outlined />
                    <Button label="文本问题" icon="pi pi-pencil" onClick={() => attachNewQuestionToBranch('text')} outlined />
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
