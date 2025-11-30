'use client';

import React, { useState } from 'react';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dialog } from 'primereact/dialog';
import { useToastContext } from '@/context/ToastContext';

interface QuestionnaireFormProps {
    visible: boolean;
    onHide: () => void;
    questions: string[];
    onSubmit: (answers: { question: string; answer: string }[]) => void;
    loading: boolean;
}

const QuestionnaireForm: React.FC<QuestionnaireFormProps> = ({
    visible,
    onHide,
    questions,
    onSubmit,
    loading
}) => {
    const { showToast } = useToastContext();
    const [answers, setAnswers] = useState<Record<number, string>>({});

    const handleAnswerChange = (index: number, value: string) => {
        setAnswers(prev => ({
            ...prev,
            [index]: value
        }));
    };

    const handleSubmit = () => {
        // 检查是否所有问题都已回答
        for (let i = 0; i < questions.length; i++) {
            if (!answers[i] || answers[i].trim() === '') {
                showToast({
                    severity: 'error',
                    summary: '提交失败',
                    detail: `请回答第 ${i + 1} 个问题`
                });
                return;
            }
        }

        // 构造答案数组
        const answersArray = questions.map((question, index) => ({
            question,
            answer: answers[index]
        }));

        onSubmit(answersArray);
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
                    {questions.map((question, index) => (
                        <div key={index}>
                            <label className="block font-medium mb-2">
                                <span className="text-primary font-bold">Q{index + 1}:</span> {question}
                            </label>
                            <InputTextarea
                                value={answers[index] || ''}
                                onChange={(e) => handleAnswerChange(index, e.target.value)}
                                className="w-full"
                                disabled={loading}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </Dialog>
    );
};

export default QuestionnaireForm;