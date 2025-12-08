'use client';

import React, { useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { useToastContext } from '@/context/ToastContext';
import { coachService } from '@/app/service/coachService';
import { RadioButton } from 'primereact/radiobutton';
import { Checkbox } from 'primereact/checkbox';

interface IntakeQuestionSettingsProps {
    coachId: string;
}

interface CustomQuestion {
    question: string;
    options: string[];
}

const IntakeQuestionSettings: React.FC<IntakeQuestionSettingsProps> = ({ coachId }) => {
    const [questionId, setQuestionId] = useState<string | null>(null);
    const [questions, setQuestions] = useState<string[]>([]);
    const [newQuestion, setNewQuestion] = useState<string>('');
    const [saving, setSaving] = useState<boolean>(false);
    
    // 固定选项的状态
    const [trainingItems, setTrainingItems] = useState<string[]>([]);
    const [selectedTrainingItem, setSelectedTrainingItem] = useState<string>('');
    const [trainingFrequency, setTrainingFrequency] = useState<number | null>(null);
    
    // 自定义问题状态
    const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
    const [newCustomQuestion, setNewCustomQuestion] = useState<CustomQuestion>({ question: '', options: [''] });
    
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
                
                // 解析固定选项和自定义问题
                parseFixedAndCustomQuestions(result.questionnaires || []);
            }
        } catch (error) {
            console.error('加载问卷问题失败:', error);
        }
    };

    // 解析固定选项和自定义问题
    const parseFixedAndCustomQuestions = (questionList: string[]) => {
        // 查找训练项目选项
        const trainingItemQuestion = questionList.find(q => q.startsWith('[固定]需要的训练项目:'));
        if (trainingItemQuestion) {
            const items = trainingItemQuestion.replace('[固定]需要的训练项目:', '').split(',').filter(item => item.trim());
            setTrainingItems(items);
            if (items.length > 0) {
                setSelectedTrainingItem(items[0]);
            }
        }
        
        // 查找训练频率选项
        const frequencyQuestion = questionList.find(q => q.startsWith('[固定]一周练习的次数:'));
        if (frequencyQuestion) {
            const frequencyStr = frequencyQuestion.replace('[固定]一周练习的次数:', '');
            const frequency = parseInt(frequencyStr, 10);
            if (!isNaN(frequency) && frequency >= 1 && frequency <= 7) {
                setTrainingFrequency(frequency);
            }
        }
        
        // 查找自定义问题
        const customQuestionsData: CustomQuestion[] = [];
        questionList.forEach(q => {
            if (q.startsWith('[自定义]')) {
                const parts = q.replace('[自定义]', '').split('|选项:');
                if (parts.length === 2) {
                    const questionText = parts[0];
                    const options = parts[1].split(',').filter(opt => opt.trim());
                    customQuestionsData.push({ question: questionText, options });
                }
            }
        });
        setCustomQuestions(customQuestionsData);
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

    // 更新训练项目选项
    const updateTrainingItemOption = (index: number, value: string) => {
        const updatedItems = [...trainingItems];
        updatedItems[index] = value;
        setTrainingItems(updatedItems);
    };

    // 添加训练项目选项
    const addTrainingItemOption = () => {
        setTrainingItems([...trainingItems, '']);
    };

    // 删除训练项目选项
    const removeTrainingItemOption = (index: number) => {
        const updatedItems = [...trainingItems];
        updatedItems.splice(index, 1);
        setTrainingItems(updatedItems);
        
        // 如果删除的是选中的项目，清空选择
        if (selectedTrainingItem === trainingItems[index]) {
            setSelectedTrainingItem('');
        }
    };

    // 添加自定义问题选项
    const addCustomQuestionOption = (questionIndex: number) => {
        const updatedQuestions = [...customQuestions];
        updatedQuestions[questionIndex].options.push('');
        setCustomQuestions(updatedQuestions);
    };

    // 更新自定义问题选项
    const updateCustomQuestionOption = (questionIndex: number, optionIndex: number, value: string) => {
        const updatedQuestions = [...customQuestions];
        updatedQuestions[questionIndex].options[optionIndex] = value;
        setCustomQuestions(updatedQuestions);
    };

    // 删除自定义问题选项
    const removeCustomQuestionOption = (questionIndex: number, optionIndex: number) => {
        const updatedQuestions = [...customQuestions];
        updatedQuestions[questionIndex].options.splice(optionIndex, 1);
        setCustomQuestions(updatedQuestions);
    };

    // 添加自定义问题
    const addCustomQuestion = () => {
        if (newCustomQuestion.question.trim() && 
            newCustomQuestion.options.some(opt => opt.trim())) {
            setCustomQuestions([...customQuestions, { ...newCustomQuestion }]);
            setNewCustomQuestion({ question: '', options: [''] });
        } else {
            showToast({ severity: 'error', summary: '错误', detail: '请输入有效的自定义问题和至少一个选项' });
        }
    };

    // 更新新自定义问题选项
    const updateNewCustomQuestionOption = (index: number, value: string) => {
        const updatedOptions = [...newCustomQuestion.options];
        updatedOptions[index] = value;
        setNewCustomQuestion({ ...newCustomQuestion, options: updatedOptions });
    };

    // 添加新自定义问题选项
    const addNewCustomQuestionOption = () => {
        setNewCustomQuestion({ 
            ...newCustomQuestion, 
            options: [...newCustomQuestion.options, ''] 
        });
    };

    // 删除自定义问题
    const removeCustomQuestion = (index: number) => {
        const updatedQuestions = [...customQuestions];
        updatedQuestions.splice(index, 1);
        setCustomQuestions(updatedQuestions);
    };

    const saveQuestions = async () => {
        setSaving(true);
        try {
            // 构建包含固定选项和自定义问题的问卷列表
            const allQuestions = [...questions];
            
            // 添加训练项目固定选项
            if (trainingItems.length > 0) {
                allQuestions.push(`[固定]需要的训练项目:${trainingItems.filter(item => item.trim()).join(',')}`);
            }
            
            // 添加训练频率固定选项
            if (trainingFrequency !== null) {
                allQuestions.push(`[固定]一周练习的次数:${trainingFrequency}`);
            }
            
            // 添加自定义问题
            customQuestions.forEach(q => {
                if (q.question.trim() && q.options.some(opt => opt.trim())) {
                    allQuestions.push(`[自定义]${q.question}|选项:${q.options.filter(opt => opt.trim()).join(',')}`);
                }
            });

            const result = await coachService.updateQuestionnaires({
                id: questionId || '',
                questionnaires: allQuestions
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

                {/* 固定选项 - 需要的训练项目 */}
                <div className="mb-8 p-4 border border-surface-200 rounded-lg">
                    <h3 className="font-bold text-lg mb-4">固定问题设置</h3>
                    
                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-2">需要的训练项目（多选项单选）</label>
                        <div className="mb-3">
                            {trainingItems.map((item, index) => (
                                <div key={index} className="flex items-center gap-2 mb-2">
                                    <RadioButton 
                                        inputId={`trainingItem${index}`} 
                                        name="trainingItems" 
                                        value={item} 
                                        onChange={(e) => setSelectedTrainingItem(e.value)} 
                                        checked={selectedTrainingItem === item} 
                                    />
                                    <InputText
                                        value={item}
                                        onChange={(e) => updateTrainingItemOption(index, e.target.value)}
                                        className="flex-1"
                                        placeholder="训练项目名称"
                                    />
                                    <Button 
                                        icon="pi pi-trash" 
                                        className="p-button-text p-button-danger p-2"
                                        onClick={() => removeTrainingItemOption(index)}
                                    />
                                </div>
                            ))}
                        </div>
                        <Button 
                            label="添加训练项目选项" 
                            icon="pi pi-plus" 
                            onClick={addTrainingItemOption}
                            className="w-full md:w-auto"
                            outlined
                        />
                    </div>

                    {/* 固定选项 - 一周练习的次数 */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-2">一周练习的次数（1-7单选）</label>

                    </div>
                </div>

                {/* 自定义问题 */}
                <div className="mb-8 p-4 border border-surface-200 rounded-lg">
                    <h3 className="font-bold text-lg mb-4">自定义问题设置</h3>
                    
                    {customQuestions.length > 0 && (
                        <div className="mb-4">
                            {customQuestions.map((cq, qIndex) => (
                                <div key={qIndex} className="mb-4 p-3 bg-surface-100 rounded">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-medium">{cq.question}</h4>
                                        <Button 
                                            icon="pi pi-trash" 
                                            className="p-button-text p-button-danger p-2"
                                            onClick={() => removeCustomQuestion(qIndex)}
                                        />
                                    </div>
                                    <div className="ml-2">
                                        {cq.options.map((option, oIndex) => (
                                            <div key={oIndex} className="flex items-center gap-2 mb-1">
                                                <RadioButton 
                                                    name={`customQuestion${qIndex}`} 
                                                    disabled
                                                />
                                                <span className="text-sm">{option}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">新增自定义问题</label>
                        <InputText
                            value={newCustomQuestion.question}
                            onChange={(e) => setNewCustomQuestion({...newCustomQuestion, question: e.target.value})}
                            placeholder="输入问题..."
                            className="w-full mb-2"
                        />
                        
                        <label className="block text-sm font-medium mb-2">选项</label>
                        {newCustomQuestion.options.map((option, index) => (
                            <div key={index} className="flex items-center gap-2 mb-2">
                                <InputText
                                    value={option}
                                    onChange={(e) => updateNewCustomQuestionOption(index, e.target.value)}
                                    placeholder={`选项 ${index + 1}`}
                                    className="flex-1"
                                />
                                <Button 
                                    icon="pi pi-trash" 
                                    className="p-button-text p-button-danger p-2"
                                    onClick={() => {
                                        const updatedOptions = [...newCustomQuestion.options];
                                        updatedOptions.splice(index, 1);
                                        setNewCustomQuestion({...newCustomQuestion, options: updatedOptions});
                                    }}
                                />
                            </div>
                        ))}
                        <Button 
                            label="添加选项" 
                            icon="pi pi-plus" 
                            onClick={addNewCustomQuestionOption}
                            className="w-full md:w-auto mt-2"
                            outlined
                        />
                    </div>
                    
                    <Button 
                        label="添加自定义问题" 
                        icon="pi pi-plus" 
                        onClick={addCustomQuestion}
                        className="w-full md:w-auto"
                    />
                </div>

                {/* 其他自定义问题 */}
                <div className="mb-4">
                    <h3 className="font-bold text-lg mb-4">其他自定义问题</h3>
                    {questions.length === 0 ? (
                        <div className="p-4 text-center text-surface-500 border-2 border-dashed border-surface-300 rounded">
                            <i className="pi pi-question text-2xl mb-2"></i>
                            <p>暂无额外的自定义问题</p>
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