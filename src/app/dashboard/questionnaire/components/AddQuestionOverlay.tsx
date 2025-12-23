import React from 'react';
import { OverlayPanel } from 'primereact/overlaypanel';
import { Button } from 'primereact/button';
import { TrainingItem } from '@/types/questionnaires';

interface AddQuestionOverlayProps {
    overlayPanel: React.RefObject<OverlayPanel>;
    questions: TrainingItem[];
    onAddTagsQuestion: () => void;
    onAddTimesQuestion: () => void;
    onAddRmQuestion: () => void;
    onAddOptionQuestion: () => void;
    onAddTextQuestion: () => void;
}

const AddQuestionOverlay: React.FC<AddQuestionOverlayProps> = ({
    overlayPanel,
    questions,
    onAddTagsQuestion,
    onAddTimesQuestion,
    onAddRmQuestion,
    onAddOptionQuestion,
    onAddTextQuestion
}) => {


    return (
        <OverlayPanel ref={overlayPanel}>
            <div className="flex flex-col gap-1">

                <Button
                    label="训练项目偏好"
                    icon="pi pi-tags"
                    onClick={onAddTagsQuestion}
                    disabled={questions.some(q => q.type === 'tags')}
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
                    label="每周训练次数"
                    icon="pi pi-calendar"
                    disabled={questions.some(q => q.type === 'times')}
                    onClick={onAddTimesQuestion}
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
                    label="用户极限（1RM）"
                    icon="pi pi-chart-bar"
                    disabled={questions.some(q => q.type === 'rm')}
                    onClick={onAddRmQuestion}
                    text
                    className="
                        w-full flex justify-start gap-2 
                        p-3 border-round 
                        text-left
                        surface-100 
                        hover:surface-200
                    "
                />

                <Button
                    label="选项问题"
                    icon="pi pi-list"
                    onClick={onAddOptionQuestion}
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

            </div>
        </OverlayPanel>
    );
};

export default AddQuestionOverlay;
