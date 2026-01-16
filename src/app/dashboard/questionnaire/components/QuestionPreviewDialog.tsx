import React, { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { RadioButton } from 'primereact/radiobutton';
import { Checkbox } from 'primereact/checkbox';
import { Skeleton } from 'primereact/skeleton';
import { planLibService } from '@/app/service/planLibService';
import type { TrainingItem } from '@/types/questionnaires';
import { actionLibService } from '@/app/service/actionLibService';
import { CoachActionRow } from '@/types';
import { FloatLabel } from 'primereact/floatlabel';
import { useSession } from 'next-auth/react';
import { AeroInputNumber } from '@/components/AeroInputNumber';

interface QuestionPreviewDialogProps {
    visible: boolean;
    onHide: () => void;
    coachId?: string;
    questions: TrainingItem[];
}

const QuestionPreviewDialog: React.FC<QuestionPreviewDialogProps> = ({
    visible,
    onHide,
    coachId,
    questions
}) => {
    // 状态用于存储用户对问题的回答
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [tags, setTags] = useState<string[]>([]);
    const [loadingTags, setLoadingTags] = useState<boolean>(true);
    
    const [autoComputeActions, setAutoComputeActions] = useState<CoachActionRow[]>([]);
    const [loadingActions, setLoadingActions] = useState<boolean>(true);

    const { data: session } = useSession();

    useEffect(() => {

        const fetchTags = async () => {
            setLoadingTags(true);
            try {
                const res = await planLibService.getUniqueTemplateTags({});
                if (res && res.tags) {
                    setTags(res.tags);
                }
            } catch (error) {
                console.error("获取训练标签失败:", error);
                // Fallback to default tags
                setTags(['胸部训练', '背部训练', '腿部训练', '肩部训练', '手臂训练']);
            } finally {
                setLoadingTags(false);
            }
        };

        const fetchAutoComputeActions = async () => {
            setLoadingActions(true);
            try {
                const res = await actionLibService.listAutoComputeActions({
                    coachId: session.user.id
                });

                if (res && res.actions) {
                    setAutoComputeActions(res.actions);
                }
            } catch (error) {
                console.error("获取自动计算动作失败:", error);
            } finally {
                setLoadingActions(false);
            }
        };

        if (visible) {
            fetchTags();
            fetchAutoComputeActions();
        }
    }, [visible]);

    // 更新答案
    const updateAnswer = (questionIndex: number, value: any) => {
        setAnswers(prev => ({
            ...prev,
            [questionIndex]: value
        }));
    };

    // 渲染问题预览
    const renderQuestionPreview = (question: TrainingItem, index: number) => {
        switch (question.type) {
            case 'tags':
                return (
                    <div className="mb-4">
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
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">
                            Q{index + 1}. {(question as any).question || '您希望每周训练几次？'}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {(
                                Array.isArray((question as any).options) && (question as any).options.length > 0
                                    ? (question as any).options
                                    : [1, 2, 3, 4, 5, 6, 7]
                            ).map((num: number) => (
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
            
            case 'rm':
                return (
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-4">Q{index + 1}. 请输入以下动作您的极限重量</label>
                        {loadingActions ? (
                            <div className="flex flex-col gap-3">
                                {[1, 2, 3].map((_, i) => (
                                    <div key={i} className="flex flex-column gap-2">
                                        <Skeleton width="100px" height="0.75rem" />
                                        <Skeleton width="150px" height="2rem" />
                                    </div>
                                ))}
                            </div>
                        ) : autoComputeActions && (
                            <div className="flex flex-col gap-4">
                                {autoComputeActions.map((action, actionIndex) => (
                                    <div key={actionIndex} className="flex flex-col">
                                        <label className="block text-xs text-600 mb-1">{action.name}</label>
                                        
                                        <AeroInputNumber
                                            className='text-xs'
                                            showButtons
                                            min={0}
                                            suffix='RM'
                                            value={answers[index]?.weight}
                                            onValueChange={(e) => updateAnswer(index, { ...answers[index], })}
                                        />
                                        
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )

            case 'option':
                return (
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-4">
                            Q{index + 1}. {question.question || `问题 ${index + 1}`}
                        </label>
                        <div className="flex flex-col gap-4">
                            {question.options.map((option, optionIndex) => (
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
                return (
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">Q{index + 1}. {question.question}</label>
                        <InputTextarea
                            value={answers[index] || ''}
                            onChange={(e) => updateAnswer(index, e.target.value)}
                            className="w-full"
                            rows={3}
                        />
                    </div>
                );
            
            default:
                return null;
        }
    };

    const footerContent = (
        <div className="flex justify-end pt-2 gap-2">
            <Button label="关闭" icon="pi pi-times" onClick={onHide} className="p-button-text" />
            <Button label="提交" icon="pi pi-check" onClick={onHide} />
        </div>
    );

    return (
        <Dialog
            header="问卷预览"
            visible={visible}
            onHide={onHide}
            style={{ width: '50vw' }}
            breakpoints={{ '960px': '75vw', '641px': '90vw' }}
            footer={footerContent}
            maximizable
        >
            <div className="p-4">
                {questions.length === 0 ? (
                    <div className="text-center py-8">
                        <i className="pi pi-question text-5xl text-surface-300 mb-4 block"></i>
                        <p className="text-surface-500">暂无问题可预览</p>
                    </div>
                ) : (
                    <div>
                        {questions.map((question, index) => (
                            <div key={index} className="py-2 border-bottom-1 border-surface-200">
                                {renderQuestionPreview(question, index)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Dialog>
    );
};

export default QuestionPreviewDialog;