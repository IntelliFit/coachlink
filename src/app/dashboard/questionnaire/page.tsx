'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { coachService } from '@/app/service/coachService';
import { Skeleton } from 'primereact/skeleton';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { RadioButton } from 'primereact/radiobutton';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { OverlayPanel } from 'primereact/overlaypanel';
import { useToastContext } from '@/context/ToastContext';
import QuestionPreviewDialog from './components/QuestionPreviewDialog';
import AddQuestionOverlay from './components/AddQuestionOverlay';
import type { TrainingItem, TrainingTagsQuestion, TrainingTimesQuestion, TrainingOptionQuestion, TrainingTextQuestion } from '@/types/questionnaires';

type QuestionType = 'tags' | 'times' | 'option' | 'text';

const QuestionarePage = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);
    const { showToast } = useToastContext();
    const overlayPanel = useRef<OverlayPanel>(null);
    
    const [questionId, setQuestionId] = useState<string | null>(null);
    const [questions, setQuestions] = useState<TrainingItem[]>([]);
    const [saving, setSaving] = useState<boolean>(false);
    const [addQuestionDialogVisible, setAddQuestionDialogVisible] = useState<boolean>(false);
    const [previewDialogVisible, setPreviewDialogVisible] = useState<boolean>(false);
    const [newQuestionType, setNewQuestionType] = useState<QuestionType | null>(null);
    
    // 新问题状态
    const [newOptionQuestion, setNewOptionQuestion] = useState<{question: string; options: string[]}>({ question: '', options: [''] });
    const [newTextQuestion, setNewTextQuestion] = useState<string>('');

    useEffect(() => {
        if (coach?.id) {
            loadQuestions();
        }
    }, [coach?.id]);

    const loadQuestions = async () => {
        try {
            const result = await coachService.getQuestionnaires({ coachId: coach.id });
            if (result) {
                setQuestionId(result.id);
                
                // 解析问题
                const parsedQuestions: TrainingItem[] = [];
                let hasTagsQuestion = false;
                let hasTimesQuestion = false;
                
                result.questionnaires.forEach(q => {
                    try {
                        const question = JSON.parse(q) as TrainingItem;
                        if (question.type === 'tags') {
                            if (!hasTagsQuestion) {
                                parsedQuestions.push(question);
                                hasTagsQuestion = true;
                            }
                        } else if (question.type === 'times') {
                            if (!hasTimesQuestion) {
                                parsedQuestions.push(question);
                                hasTimesQuestion = true;
                            }
                        } else {
                            parsedQuestions.push(question);
                        }
                    } catch (e) {
                        console.warn('Failed to parse question:', q);
                    }
                });
                
                // 确保默认问题存在
                if (!hasTagsQuestion) {
                    parsedQuestions.unshift({ type: 'tags' });
                }
                
                if (!hasTimesQuestion) {
                    parsedQuestions.unshift({ type: 'times' });
                }
                
                setQuestions(parsedQuestions);
            }
        } catch (error) {
            console.error('加载问卷问题失败:', error);
            showToast({ severity: 'error', summary: '错误', detail: '加载问卷问题失败' });
        }
    };

    const saveQuestions = async () => {
        setSaving(true);
        try {
            // 将问题序列化为字符串数组
            const serializedQuestions = questions.map(q => JSON.stringify(q));
            
            const result = await coachService.updateQuestionnaires({
                id: questionId || '',
                questionnaires: serializedQuestions
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
            setQuestions([{ type: 'tags' }, ...questions]);
        }
    };

    // 添加训练次数问题（最多只能有一个）
    const addTimesQuestion = () => {
        const hasTimes = questions.some(q => q.type === 'times');
        if (!hasTimes) {
            setQuestions([{ type: 'times' }, ...questions]);
        }
    };

    // 添加选项问题
    const addOptionQuestion = () => {
        if (newOptionQuestion.question.trim() && 
            newOptionQuestion.options.some(opt => opt.trim())) {
            const optionQuestion: TrainingOptionQuestion = {
                type: 'option',
                options: newOptionQuestion.options.filter(opt => opt.trim())
            };
            setQuestions([...questions, optionQuestion]);
            setNewOptionQuestion({ question: '', options: [''] });
            setAddQuestionDialogVisible(false);
            setNewQuestionType(null);
        } else {
            showToast({ severity: 'error', summary: '错误', detail: '请输入有效的选项问题和至少一个选项' });
        }
    };

    // 添加文本问题
    const addTextQuestion = () => {
        if (newTextQuestion.trim()) {
            const textQuestion: TrainingTextQuestion = {
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
        const newQuestions = [...questions] as TrainingOptionQuestion[];
        if (newQuestions[questionIndex].type === 'option') {
            newQuestions[questionIndex].options[optionIndex] = value;
            setQuestions(newQuestions);
        }
    };

    // 添加选项问题的选项
    const addOption = (questionIndex: number) => {
        const newQuestions = [...questions] as TrainingOptionQuestion[];
        if (newQuestions[questionIndex].type === 'option') {
            newQuestions[questionIndex].options.push('');
            setQuestions(newQuestions);
        }
    };

    // 删除选项问题的选项
    const removeOption = (questionIndex: number, optionIndex: number) => {
        const newQuestions = [...questions] as TrainingOptionQuestion[];
        if (newQuestions[questionIndex].type === 'option') {
            newQuestions[questionIndex].options.splice(optionIndex, 1);
            setQuestions(newQuestions);
        }
    };

    // 更新选项问题的题目
    const updateOptionQuestionText = (questionIndex: number, text: string) => {
        const newQuestions = [...questions];
        if (newQuestions[questionIndex].type === 'option') {
            // 我们将题目存储在选项的第一个位置作为特殊处理
            if (newQuestions[questionIndex].options.length === 0) {
                newQuestions[questionIndex].options = [text];
            } else {
                newQuestions[questionIndex].options[0] = text;
            }
            setQuestions(newQuestions);
        }
    };

    // 更新新选项问题的选项
    const updateNewOptionQuestionOption = (index: number, value: string) => {
        const updatedOptions = [...newOptionQuestion.options];
        updatedOptions[index] = value;
        setNewOptionQuestion({ ...newOptionQuestion, options: updatedOptions });
    };

    // 添加新选项问题的选项
    const addNewOptionQuestionOption = () => {
        setNewOptionQuestion({ 
            ...newOptionQuestion, 
            options: [...newOptionQuestion.options, ''] 
        });
    };

    // 删除新选项问题的选项
    const removeNewOptionQuestionOption = (index: number) => {
        const updatedOptions = [...newOptionQuestion.options];
        updatedOptions.splice(index, 1);
        setNewOptionQuestion({ ...newOptionQuestion, options: updatedOptions });
    };

    const renderQuestion = (question: TrainingItem, index: number) => {
        switch (question.type) {
            case 'tags':
                return (
                    <div className="mb-4 p-3 bg-surface-100 rounded">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-medium">训练项目偏好</h4>
                                <p className="text-sm text-surface-500">学员可以选择偏好的训练项目</p>
                            </div>
                            <Button 
                                icon="pi pi-trash" 
                                className="p-button-text p-button-danger p-2"
                                onClick={() => removeQuestion(index)}
                                disabled={true} // 默认问题不能删除
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
                                <p className="text-sm text-surface-500">学员可以选择每周训练的次数（1-7次）</p>
                            </div>
                            <Button 
                                icon="pi pi-trash" 
                                className="p-button-text p-button-danger p-2"
                                onClick={() => removeQuestion(index)}
                                disabled={true} // 默认问题不能删除
                            />
                        </div>
                    </div>
                );
            
            case 'option':
                return (
                    <div className="mb-4 p-3 bg-surface-100 rounded">
                        <div className="flex justify-between items-start mb-2">
                            <InputText
                                value={question.options[0] || ''}
                                onChange={(e) => updateOptionQuestionText(index, e.target.value)}
                                placeholder="输入问题..."
                                className="font-medium flex-1 mr-2"
                            />
                            <Button 
                                icon="pi pi-trash" 
                                className="p-button-text p-button-danger p-2"
                                onClick={() => removeQuestion(index)}
                            />
                        </div>
                        <div className="ml-2">
                            {question.options.slice(1).map((option, optionIndex) => (
                                <div key={optionIndex} className="flex items-center gap-2 mb-1">
                                    <RadioButton 
                                        name={`question${index}`} 
                                        disabled
                                    />
                                    <InputText
                                        value={option}
                                        onChange={(e) => updateOption(index, optionIndex + 1, e.target.value)}
                                        placeholder={`选项 ${optionIndex + 1}`}
                                        className="flex-1 text-sm"
                                    />
                                    <Button 
                                        icon="pi pi-trash" 
                                        className="p-button-text p-button-danger p-2"
                                        onClick={() => removeOption(index, optionIndex + 1)}
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
                    </div>
                );
            
            case 'text':
                return (
                    <div className="mb-4 p-3 bg-surface-100 rounded">
                        <div className="flex justify-between items-start">
                            <InputText
                                value={question.question}
                                onChange={(e) => {
                                    const newQuestions = [...questions] as TrainingTextQuestion[];
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

    const questionTypeOptions = [
        { label: '训练项目偏好', value: 'tags' },
        { label: '每周训练次数', value: 'times' },
        { label: '选项问题', value: 'option' },
        { label: '文本问题', value: 'text' }
    ];

    const renderNewQuestionForm = () => {
        switch (newQuestionType) {
            case 'option':
                return (
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">问题</label>
                        <InputText
                            value={newOptionQuestion.question}
                            onChange={(e) => setNewOptionQuestion({...newOptionQuestion, question: e.target.value})}
                            placeholder="输入问题..."
                            className="w-full mb-2"
                        />
                        
                        <label className="block text-sm font-medium mb-2">选项</label>
                        {newOptionQuestion.options.map((option, index) => (
                            <div key={index} className="flex items-center gap-2 mb-2">
                                <InputText
                                    value={option}
                                    onChange={(e) => updateNewOptionQuestionOption(index, e.target.value)}
                                    placeholder={`选项 ${index + 1}`}
                                    className="flex-1"
                                />
                                <Button 
                                    icon="pi pi-trash" 
                                    className="p-button-text p-button-danger p-2"
                                    onClick={() => removeNewOptionQuestionOption(index)}
                                />
                            </div>
                        ))}
                        <Button 
                            label="添加选项" 
                            icon="pi pi-plus" 
                            onClick={addNewOptionQuestionOption}
                            className="w-full md:w-auto mt-2"
                            outlined
                        />
                    </div>
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
                        
                        {questions.length === 0 ? (
                            <div className="p-4 text-center text-surface-500 border-2 border-dashed border-surface-300 rounded">
                                <i className="pi pi-question text-2xl mb-2"></i>
                                <p>暂无问题</p>
                                <p className="text-sm mt-1">添加问题后，学员订阅时将需要回答这些问题</p>
                            </div>
                        ) : (
                            <div className="mb-4">
                                {questions.map((question, index) => (
                                    <div key={index}>
                                        {renderQuestion(question, index)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-3 w-full justify-between mt-10">
                        <div></div>
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

            {/* 添加问题的Popover */}
            {/* 添加问题的OverlayPanel */}
            <AddQuestionOverlay
                overlayPanel={overlayPanel}
                onAddTagsQuestion={addTagsQuestion}
                onAddTimesQuestion={addTimesQuestion}
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

            {/* 添加问题对话框（用于选项问题和文本问题） */}
            <Dialog 
                header={newQuestionType === 'option' ? "添加选项问题" : "添加文本问题"}
                visible={addQuestionDialogVisible} 
                onHide={() => {
                    setAddQuestionDialogVisible(false);
                    setNewQuestionType(null);
                    setNewOptionQuestion({ question: '', options: [''] });
                    setNewTextQuestion('');
                }}
                style={{ width: '500px' }}
                modal
            >
                <div>
                    {renderNewQuestionForm()}
                    <div className="flex justify-content-end gap-2 mt-4">
                        <Button 
                            label="取消" 
                            icon="pi pi-times" 
                            onClick={() => {
                                setAddQuestionDialogVisible(false);
                                setNewQuestionType(null);
                                setNewOptionQuestion({ question: '', options: [''] });
                                setNewTextQuestion('');
                            }}
                            className="p-button-text"
                        />
                        <Button 
                            label="添加" 
                            icon="pi pi-check" 
                            onClick={() => {
                                if (newQuestionType === 'option') {
                                    addOptionQuestion();
                                } else if (newQuestionType === 'text') {
                                    addTextQuestion();
                                }
                            }}
                        />
                    </div>
                </div>
            </Dialog>

            {/* 问卷预览对话框 */}
            <QuestionPreviewDialog 
                visible={previewDialogVisible}
                onHide={() => setPreviewDialogVisible(false)}
                questions={questions}
            />
        </div>
    );
};

export default QuestionarePage;