'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { coachService } from '@/app/service/coachService';
import { Skeleton } from 'primereact/skeleton';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { RadioButton } from 'primereact/radiobutton';
import { OverlayPanel } from 'primereact/overlaypanel';
import { Accordion, AccordionTab } from 'primereact/accordion';
import { useToastContext } from '@/context/ToastContext';
import QuestionPreviewDialog from './components/QuestionPreviewDialog';
import AddQuestionOverlay from './components/AddQuestionOverlay';
import AddQuestionDialog from './components/AddQuestionDialog';
import OptionQuestionManager from './components/OptionQuestionManager';
import type { TrainingItem, TrainingOptionQuestion, TrainingTextQuestion, QuestionType } from '@/types/questionnaires';
import { CoachesRow } from '@/types';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { v4 as uuidv4 } from "uuid";

const QuestionarePage = () => {
    const { data: session } = useSession();
    const { showToast } = useToastContext();
    const overlayPanel = useRef<OverlayPanel>(null);

    const [questionId, setQuestionId] = useState<string | null>(null);
    const [questions, setQuestions] = useState<(TrainingItem & { id: string })[]>([]);
    const [saving, setSaving] = useState<boolean>(false);
    const [addQuestionDialogVisible, setAddQuestionDialogVisible] = useState<boolean>(false);
    const [previewDialogVisible, setPreviewDialogVisible] = useState<boolean>(false);
    const [newQuestionType, setNewQuestionType] = useState<QuestionType | null>(null);

    const [coach, setCoach] = useState<CoachesRow>(null);

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
                            type: 'tags'
                        });
                        break;
                    case 'times':
                        trainingQuestions.push({
                            type: 'times'
                        });
                        break;
                    case 'rm':
                        trainingQuestions.push({
                            type: 'rm'
                        });
                        break;
                    case 'option':
                        trainingQuestions.push({
                            type: 'option',
                            question: item.question,
                            options: item.options,
                            scope: item.scope,  // 保留scope字段
                        });
                        break;
                    case 'text':
                        trainingQuestions.push({
                            type: 'text',
                            question: item.question,
                        });
                        break;
                    default:
                        if (typeof item === 'string') {
                            trainingQuestions.push({
                                type: 'text',
                                question: item,
                            });
                        }
                }
            }
            // 确保始终包含用户极限（1RM）问题
            if (!trainingQuestions.some(q => q.type === 'rm')) {
                trainingQuestions.push({ type: 'rm' });
            }

            setQuestions(trainingQuestions.map(item => ({
                ...item,
                id: uuidv4()
            })));

        } else {
            showToast({ severity: 'error', summary: '错误', detail: '加载问卷问题失败' });
        }
    }

    useEffect(() => {
        loadCoach();
    }, [session?.user?.id]);

    useEffect(() => {
        if (session?.user?.id) {
            loadQuestions();
        }
    }, [coach]);

    const saveQuestions = async () => {
        setSaving(true);
        try {
            const result = await coachService.updateQuestionnaires({
                id: questionId || '',
                questionnaires: questions.map(item => {
                    const { id, ...q } = item;
                    return q;
                })
            });

            if (result) {
                setQuestionId(result.id);
                showToast({ severity: 'success', summary: '成功', detail: '问卷设置已保存' });
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
            setQuestions([...questions, { type: 'tags', id: uuidv4() }]);
        }
        overlayPanel.current?.hide();
    };

    // 添加训练次数问题（最多只能有一个）
    const addTimesQuestion = () => {
        const hasTimes = questions.some(q => q.type === 'times');
        if (!hasTimes) {
            setQuestions([...questions, { type: 'times', id: uuidv4() }]);
        }
        overlayPanel.current?.hide();
    };

    // 添加RM问题
    const addRmQuestion = () => {
        const hasRm = questions.some(q => q.type === 'rm');
        if (!hasRm) {
            setQuestions([...questions, { type: 'rm', id: uuidv4() }]);
        }
        overlayPanel.current?.hide();
    };

    // 添加选项问题
    const addOptionQuestion = (question: TrainingOptionQuestion) => {
        setQuestions([...questions, { ...question, id: uuidv4() }]);
        setAddQuestionDialogVisible(false);
        setNewQuestionType(null);
    };

    // 添加文本问题
    const addTextQuestion = () => {
        if (newTextQuestion.trim()) {
            const textQuestion: TrainingTextQuestion = {
                type: 'text',
                question: newTextQuestion.trim()
            };
            setQuestions([...questions, { ...textQuestion, id: uuidv4() }]);
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

    const renderQuestion = (question: TrainingItem, index: number) => {
        switch (question.type) {
            case 'tags':
                return (
                    <div className="mb-4 p-3 bg-surface-100 rounded">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-medium">训练项目偏好</h4>
                                <p className="text-sm text-surface-500">学员可以选择偏好的训练项目（智能计划将会自动根据这个项目进行匹配）</p>
                            </div>
                            <Button
                                icon="pi pi-trash"
                                className="p-button-text p-button-danger p-2"
                                onClick={() => removeQuestion(index)}
                            />
                        </div>
                    </div>
                );

            case 'times':
                return (
                    <div className="mb-4 p-3 bg-surface-100 rounded">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-medium">每周训练次数</h4>
                                <p className="text-sm text-surface-500">学员可以选择每周训练的次数（智能计划将会自动根据这个项目进行匹配）</p>
                            </div>
                            <Button
                                icon="pi pi-trash"
                                className="p-button-text p-button-danger p-2"
                                onClick={() => removeQuestion(index)}
                            />
                        </div>
                    </div>
                );

            case 'rm':
                return (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="font-medium">用户极限（1RM）</h4>
                                    <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded">必须</span>
                                </div>
                                <p className="text-sm text-surface-500">学员填写各动作的极限重量，用于智能计划自动计算训练负重</p>
                            </div>
                        </div>
                    </div>
                )
            case 'option':
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

                    {/* 问题列表 */}
                    <div className="mb-8 p-4 border border-surface-200 rounded-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg">问题设置</h3>
                        </div>

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
                        ) : (
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
                                            {questions.map((question, index) => (
                                                <Draggable key={index} draggableId={`question-${index}`} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={`${snapshot.isDragging ? 'shadow-lg' : ''}`}
                                                        >
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
                        )}
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
        </div>
    );
};

export default QuestionarePage;