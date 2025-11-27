'use client';

import React, { useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { coachService } from '@/app/service/coachService';
import { useToastContext } from '@/context/ToastContext';

interface IntakeQuestionSettingsProps {
    coachId: string;
}

const IntakeQuestionSettings: React.FC<IntakeQuestionSettingsProps> = ({ coachId }) => {
    const [questionId, setQuestionId] = useState<string | null>(null);
    const [questions, setQuestions] = useState<string[]>([]);
    const [newQuestion, setNewQuestion] = useState<string>('');
    const [saving, setSaving] = useState<boolean>(false);
    const { showToast } = useToastContext();

    useEffect(() => {
        loadQuestions();
    }, [coachId]);

    const loadQuestions = async () => {
        try {
            const result = await coachService.getQuestionnaires();
            if (result) {
                setQuestions(result.questionnaires || []);
                setQuestionId(result.id);
            }
        } catch (error) {
            console.error('加载问卷问题失败:', error);
        }
    };

    const addQuestion = () => {
        if (newQuestion.trim()) {
            setQuestions([...questions, newQuestion.trim()]);
            setNewQuestion('');
        } else {
            showToast({ severity: 'error', summary: '错误', detail: '请输入有效的问卷问题' });
        }
    };

    const updateQuestion = (index: number, value: string) => {
        const updatedQuestions = [...questions];
        updatedQuestions[index] = value;
        setQuestions(updatedQuestions);
    };

    const removeQuestion = (index: number) => {
        const updatedQuestions = [...questions];
        updatedQuestions.splice(index, 1);
        setQuestions(updatedQuestions);
    };

    const saveQuestions = async () => {
        setSaving(true);
        try {
            const result = await coachService.updateQuestionnaires({
                id: questionId || '',
                questionnaires: questions
            });

            if (result) {
                setQuestionId(result.id);
                showToast({ severity: 'success', summary: '成功', detail: '问卷设置已保存' });
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '错误', detail: '保存失败' });
        } finally {
            setSaving(false);
        }
    };

    return (
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

                <div className="mb-4">
                    {questions.length === 0 ? (
                        <div className="p-4 text-center text-surface-500 border-2 border-dashed border-surface-300 rounded">
                            <i className="pi pi-question text-2xl mb-2"></i>
                            <p>暂无问卷问题</p>
                            <p className="text-sm mt-1">添加问题后，学员订阅时将需要回答这些问题</p>
                        </div>
                    ) : (
                        questions.map((question, index) => (
                            <div key={index} className="flex items-center gap-2 mb-2 p-2 bg-surface-100 rounded">
                                <span className="text-surface-500 text-sm font-semibold min-w-[24px]">Q{index + 1}</span>
                                <InputText
                                    value={question}
                                    onChange={(e) => updateQuestion(index, e.target.value)}
                                    className="flex-1"
                                />
                                <Button 
                                    icon="pi pi-trash" 
                                    className="p-button-text p-button-danger p-2"
                                    onClick={() => removeQuestion(index)}
                                />
                            </div>
                        ))
                    )}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                    <InputText
                        value={newQuestion}
                        onChange={(e) => setNewQuestion(e.target.value)}
                        placeholder="输入新问题..."
                        className="flex-1 min-w-[200px]"
                        onKeyDown={(e) => e.key === 'Enter' && addQuestion()}
                    />
                    <Button 
                        label="添加" 
                        icon="pi pi-plus" 
                        onClick={addQuestion}
                        className="w-full md:w-auto"
                    />
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
    );
};

export default IntakeQuestionSettings;