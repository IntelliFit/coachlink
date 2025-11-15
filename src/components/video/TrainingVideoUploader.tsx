import React from 'react';
import VideoUploader from './VideoUploader';
import { VideoUploadContext } from '@/types/video';

interface TrainingVideoUploaderProps {
    userId: string;
    context: VideoUploadContext;
    onUploadSuccess?: (video: any) => void;
    onUploadError?: (error: Error) => void;
    showUrlInput?: boolean;
}

const TrainingVideoUploader: React.FC<TrainingVideoUploaderProps> = ({
    userId,
    context,
    onUploadSuccess,
    onUploadError,
    showUrlInput = true
}) => {
    return (
        <VideoUploader
            userId={userId}
            context={context}
            onUploadSuccess={onUploadSuccess}
            onUploadError={onUploadError}
            showUrlInput={showUrlInput}
        />
    );
};

export default TrainingVideoUploader;