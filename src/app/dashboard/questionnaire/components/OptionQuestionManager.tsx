import React, { useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { TrainingOptionQuestion } from '@/types/questionnaires';
import { v4 as uuidv4 } from 'uuid';

interface OptionQuestionManagerProps {
    onAddOptionQuestion: (question: TrainingOptionQuestion) => void;
    onCancel: () => void;
    selectionMode: 'single' | 'multiple';
}

const OptionQuestionManager: React.FC<OptionQuestionManagerProps> = ({ 
    onAddOptionQuestion,
    onCancel,
    selectionMode
}) => {
    const [newOptionQuestion, setNewOptionQuestion] = useState<{ question: string; options: string[]; allowOther: boolean }>({ 
        question: '', 
        options: [''],
        allowOther: false,
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
                id: uuidv4(),
                type: 'option',
                question: newOptionQuestion.question,
                options: newOptionQuestion.options.filter(opt => opt.trim()),
                selectionMode,
                allowOther: newOptionQuestion.allowOther,
            };
            onAddOptionQuestion(optionQuestion);
            setNewOptionQuestion({ question: '', options: [''], allowOther: false });
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

            <div className="mb-4 rounded-xl border border-surface-200 bg-surface-50 p-3 text-xs text-surface-600">
                {selectionMode === 'single' ? '学员只能选择 1 项。' : '学员可以同时选择多项。'}
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

            <div className="mt-4 flex items-center gap-2">
                <Checkbox
                    inputId="allow-other-option"
                    checked={newOptionQuestion.allowOther}
                    onChange={(e) => setNewOptionQuestion({
                        ...newOptionQuestion,
                        allowOther: Boolean(e.checked),
                    })}
                />
                <label htmlFor="allow-other-option" className="text-sm text-surface-700">
                    增加“其他”选项，并允许学员补充文字
                </label>
            </div>
            
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
