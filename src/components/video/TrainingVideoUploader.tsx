import React from 'react';
import VideoUploader from './VideoUploader';
import { VideoUploadContext } from '@/types/video';

interface TrainingVideoUploaderProps {
    context: VideoUploadContext;
    onUploadSuccess?: (video: any) => void; // 兼容父组件传入“单个视频”的签名
    onUploadError?: (error: Error) => void;
    showUrlInput?: boolean;
}

const TrainingVideoUploader: React.FC<TrainingVideoUploaderProps> = ({
    context,
    onUploadSuccess,
    onUploadError,
    showUrlInput = true
}) => {
    return (
        <VideoUploader
            context={context}
            onUploadSuccess={(result: any) => {
                // VideoUploader 会返回数组（可能包含 1..N 个视频）
                if (Array.isArray(result)) {
                    result.filter(Boolean).forEach((v) => onUploadSuccess?.(v));
                } else if (result) {
                    onUploadSuccess?.(result);
                }
            }}
            onUploadError={onUploadError}
            showUrlInput={showUrlInput}
        />
    );
};

export default TrainingVideoUploader;