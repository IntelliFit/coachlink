import React, { useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { RadioButton } from 'primereact/radiobutton';
import { TrainingOptionQuestion } from '@/types/questionnaires';

interface OptionQuestionManagerProps {
    onAddOptionQuestion: (question: TrainingOptionQuestion) => void;
    onCancel: () => void;
}

const OptionQuestionManager: React.FC<OptionQuestionManagerProps> = ({ 
    onAddOptionQuestion,
    onCancel
}) => {
    const [newOptionQuestion, setNewOptionQuestion] = useState<{ question: string; options: string[]; scope: 'global' | 'action' }>({ 
        question: '', 
        options: [''],
        scope: 'action'  // 默认为动作选择
    });

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

    const handleAddOptionQuestion = () => {
        if (newOptionQuestion.question.trim() &&
            newOptionQuestion.options.some(opt => opt.trim())) {
            const optionQuestion: TrainingOptionQuestion = {
                type: 'option',
                question: newOptionQuestion.question,
                options: newOptionQuestion.options.filter(opt => opt.trim()),
                scope: newOptionQuestion.scope
            };
            onAddOptionQuestion(optionQuestion);
            setNewOptionQuestion({ question: '', options: [''], scope: 'action' });
        }
    };

    return (
        <div className="mb-4">
            <label className="block text-sm font-medium mb-2">问题</label>
            <InputText
                value={newOptionQuestion.question}
                onChange={(e) => setNewOptionQuestion({ 
                    ...newOptionQuestion, 
                    question: e.target.value 
                })}
                placeholder="输入问题..."
                className="w-full mb-2"
            />

            <label className="block text-sm font-medium mb-2">问题作用范围</label>
            <div className="flex gap-4 mb-4">
                <div className="flex items-center">
                    <RadioButton
                        inputId="scope-global"
                        name="scope"
                        value="global"
                        onChange={(e) => setNewOptionQuestion({ ...newOptionQuestion, scope: e.value })}
                        checked={newOptionQuestion.scope === 'global'}
                    />
                    <label htmlFor="scope-global" className="ml-2 text-sm">
                        🌐 全局匹配 <span className="text-surface-500">(用于匹配模板)</span>
                    </label>
                </div>
                <div className="flex items-center">
                    <RadioButton
                        inputId="scope-action"
                        name="scope"
                        value="action"
                        onChange={(e) => setNewOptionQuestion({ ...newOptionQuestion, scope: e.value })}
                        checked={newOptionQuestion.scope === 'action'}
                    />
                    <label htmlFor="scope-action" className="ml-2 text-sm">
                        🎯 动作选择 <span className="text-surface-500">(用于筛选动作)</span>
                    </label>
                </div>
            </div>

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
            
            <div className="flex justify-end gap-2 mt-4">
                <Button 
                    label="取消" 
                    icon="pi pi-times" 
                    onClick={onCancel}
                    className="p-button-text"
                />
                <Button 
                    label="添加" 
                    icon="pi pi-check" 
                    onClick={handleAddOptionQuestion}
                />
            </div>
        </div>
    );
};

export default OptionQuestionManager;