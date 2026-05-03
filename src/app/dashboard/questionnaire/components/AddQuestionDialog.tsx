import React from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';

export type QuestionnaireComposerType = 'text' | 'option-single' | 'option-multiple';

interface AddQuestionDialogProps {
    visible: boolean;
    newQuestionType: QuestionnaireComposerType | null;
    renderNewQuestionForm: () => React.ReactNode;
    onAddTextQuestion: () => void;
    onCancel: () => void;
}

const AddQuestionDialog: React.FC<AddQuestionDialogProps> = ({
    visible,
    newQuestionType,
    renderNewQuestionForm,
    onAddTextQuestion,
    onCancel
}) => {
    // 对于选项问题，我们不再使用对话框底部的按钮，因为OptionQuestionManager有自己的按钮
    const isOptionQuestion = newQuestionType === 'option-single' || newQuestionType === 'option-multiple';
    const dialogTitle = newQuestionType === 'option-single'
        ? '添加单选题'
        : newQuestionType === 'option-multiple'
            ? '添加多选题'
            : '添加文本问题';

    return (
        <Dialog 
            header={dialogTitle}
            visible={visible} 
            onHide={onCancel}
            style={{ width: '500px' }}
            modal
        >
            <div>
                {renderNewQuestionForm()}
                {!isOptionQuestion && (
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
                            onClick={() => {
                                if (newQuestionType === 'text') {
                                    onAddTextQuestion();
                                }
                            }}
                        />
                    </div>
                )}
            </div>
        </Dialog>
    );
};

export default AddQuestionDialog;
