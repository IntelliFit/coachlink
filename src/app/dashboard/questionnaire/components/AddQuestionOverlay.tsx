import React from 'react';
import { OverlayPanel } from 'primereact/overlaypanel';
import { Button } from 'primereact/button';

interface AddQuestionOverlayProps {
    overlayPanel: React.RefObject<OverlayPanel>;
    onAddTagsQuestion: () => void;
    onAddTimesQuestion: () => void;
    onAddOptionQuestion: () => void;
    onAddTextQuestion: () => void;
}

const AddQuestionOverlay: React.FC<AddQuestionOverlayProps> = ({
    overlayPanel,
    onAddTagsQuestion,
    onAddTimesQuestion,
    onAddOptionQuestion,
    onAddTextQuestion
}) => {
    return (
        <OverlayPanel ref={overlayPanel} showCloseIcon>
            <div className="p-3" style={{ minWidth: '260px' }}>
                <div className="flex flex-col gap-2">

                    <Button
                        label="训练项目偏好"
                        icon="pi pi-tags"
                        onClick={onAddTagsQuestion}
                        raised
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
                        onClick={onAddTimesQuestion}
                        raised
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

                    <div className="border-top-1 border-300 my-1"></div>

                    <Button
                        label="选项问题"
                        icon="pi pi-list"
                        onClick={onAddOptionQuestion}
                        raised
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
                        raised
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
            </div>
        </OverlayPanel>
    );
};

export default AddQuestionOverlay;
