'use client';

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { RadioButton } from 'primereact/radiobutton';
import { Checkbox } from 'primereact/checkbox';
import { Skeleton } from 'primereact/skeleton';
import { planLibService } from '@/app/service/planLibService';
import { useToastContext } from '@/context/ToastContext';
import type { TrainingItem } from '@/types/questionnaires';
import { CoachesRow } from '@/types';

interface QuestionnaireFormProps {
    coach: CoachesRow;
    visible: boolean;
    onHide: () => void;
    questions: TrainingItem[];
    onSubmit: (answers: { question: string; answer: any }[]) => void;
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
    const [answers, setAnswers] = useState<Record<number, any>>({});
    const [tags, setTags] = useState<string[]>([]);
    const [loadingTags, setLoadingTags] = useState<boolean>(true);

    useEffect(() => {
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

        if (visible) {
            fetchTags();
        }
    }, [visible]);

    const updateAnswer = (questionIndex: number, value: any) => {
        setAnswers(prev => ({
            ...prev,
            [questionIndex]: value
        }));
    };

    const handleSubmit = () => {
        // 验证: 对于每个问题，若为必填类型则检查
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const ans = answers[i];
            if ((q.type === 'text' || q.type === 'option' || q.type === 'times') && (ans === undefined || ans === null || (typeof ans === 'string' && ans.trim() === ''))) {
                showToast({ severity: 'error', summary: '提交失败', detail: `请回答第 ${i + 1} 个问题` });
                return;
            }
        }

        const answersArray = questions.map((question, index) => {
            const raw = answers[index];
            let answer = raw;
            if (Array.isArray(raw)) {
                answer = raw; // keep as array for tags
            } else if (raw === undefined || raw === null) {
                answer = '';
            } else {
                answer = String(raw);
            }

            return {
                question: question.question || `问题 ${index + 1}`,
                answer
            };
        });

        onSubmit(answersArray);
    };

    const renderQuestion = (question: TrainingItem, index: number) => {
        switch (question.type) {
            case 'tags':
                return (
                    <div className="mb-4" key={index}>
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
                                                const currentTags = answers[index] || [];
                                                if (e.checked) {
                                                    updateAnswer(index, [...currentTags, tag]);
                                                } else {
                                                    updateAnswer(index, currentTags.filter((t: string) => t !== tag));
                                                }
                                            }}
                                            checked={(answers[index] || []).includes(tag)}
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
                    <div className="mb-4" key={index}>
                        <label className="block text-sm font-medium mb-2">Q{index + 1}. 您希望每周训练几次？</label>
                        <div className="flex flex-wrap gap-2">
                            {[1, 2, 3, 4, 5, 6, 7].map(num => (
                                <div key={num} className="flex items-center rounded px-3 py-2">
                                    <RadioButton
                                        inputId={`times${index}-${num}`}
                                        name={`times${index}`}
                                        value={num}
                                        onChange={(e) => updateAnswer(index, e.value)}
                                        checked={answers[index] === num}
                                    />
                                    <label htmlFor={`times${index}-${num}`} className="ml-2 text-sm">{num}次</label>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'option':
                return (
                    <div className="mb-4" key={index}>
                        <label className="block text-sm font-medium mb-4">Q{index + 1}. {question.question || `问题 ${index + 1}`}</label>
                        <div className="flex flex-col gap-4">
                            {question.options?.map((option, optionIndex) => (
                                <div key={optionIndex} className="flex items-center">
                                    <RadioButton
                                        inputId={`option${index}-${optionIndex}`}
                                        name={`option${index}`}
                                        value={option}
                                        onChange={(e) => updateAnswer(index, e.value)}
                                        checked={answers[index] === option}
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
                    <div className="mb-4" key={index}>
                        <label className="block text-sm font-medium mb-2">Q{index + 1}. {question.question}</label>
                        <InputTextarea
                            value={answers[index] || ''}
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
                label="确认"
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
            className="w-full max-w-2xl"
        >
            <div className="p-4">
                <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 rounded-r">
                    <p className="text-sm text-green-800">
                        💡 您的公共档案（身高、体重、力量数据等）将自动授权给教练查看，无需重复填写。
                    </p>
                </div>

                <div className="space-y-4">
                    {questions.map((q, idx) => renderQuestion(q, idx))}
                </div>
            </div>
        </Dialog>
    );
};

export default QuestionnaireForm;