import React from 'react';
import { OverlayPanel } from 'primereact/overlaypanel';
import { Button } from 'primereact/button';
import { TrainingItem } from '@/types/questionnaires';

interface AddQuestionOverlayProps {
    overlayPanel: React.RefObject<OverlayPanel>;
    questions: TrainingItem[];
    onAddTextQuestion: () => void;
    onAddSingleOptionQuestion: () => void;
    onAddMultiOptionQuestion: () => void;
}

const AddQuestionOverlay: React.FC<AddQuestionOverlayProps> = ({
    overlayPanel,
    questions,
    onAddTextQuestion,
    onAddSingleOptionQuestion,
    onAddMultiOptionQuestion
}) => {
    const safeQuestions = Array.isArray(questions) ? questions : [];
    const questionCount = safeQuestions.length;

    return (
        <OverlayPanel ref={overlayPanel}>
            <div className="flex flex-col gap-1">
                <Button
                    label="文本问题"
                    icon="pi pi-pencil"
                    onClick={onAddTextQuestion}
                    text
                    className="
                        w-full flex justify-start gap-2 
                        p-3 border-round 
                        text-left
                        surface-100 
                        hover:surface-200
                        transition-colors
                    "
                />

                <Button
                    label="选项问题（单选）"
                    icon="pi pi-circle"
                    onClick={onAddSingleOptionQuestion}
                    text
                    className="
                        w-full flex justify-start gap-2 
                        p-3 border-round 
                        text-left
                        surface-100 
                        hover:surface-200 
                        transition-colors 
                    "
                />

                <Button
                    label="选项问题（多选）"
                    icon="pi pi-check-square"
                    onClick={onAddMultiOptionQuestion}
                    text
                    className="
                        w-full flex justify-start gap-2 
                        p-3 border-round 
                        text-left
                        surface-100 
                        hover:surface-200
                        transition-colors
                    "
                />
                {questionCount === 0 && (
                    <div className="px-3 pt-2 text-[11px] text-surface-500">
                        当前还是空白问卷，请先添加第一个问题。
                    </div>
                )}
            </div>
        </OverlayPanel>
    );
};

export default AddQuestionOverlay;
