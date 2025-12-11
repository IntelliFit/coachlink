import React from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { QuestionType } from '@/types/questionnaires';

interface AddQuestionDialogProps {
    visible: boolean;
    newQuestionType: QuestionType;
    renderNewQuestionForm: () => React.ReactNode;
    onAddOptionQuestion: () => void;
    onAddTextQuestion: () => void;
    onCancel: () => void;
}

const AddQuestionDialog: React.FC<AddQuestionDialogProps> = ({
    visible,
    newQuestionType,
    renderNewQuestionForm,
    onAddOptionQuestion,
    onAddTextQuestion,
    onCancel
}) => {
    return (
        <Dialog 
            header={newQuestionType === 'option' ? "添加选项问题" : "添加文本问题"}
            visible={visible} 
            onHide={onCancel}
            style={{ width: '500px' }}
            modal
        >
            <div>
                {renderNewQuestionForm()}
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
                            if (newQuestionType === 'option') {
                                onAddOptionQuestion();
                            } else if (newQuestionType === 'text') {
                                onAddTextQuestion();
                            }
                        }}
                    />
                </div>
            </div>
        </Dialog>
    );
};

export default AddQuestionDialog;