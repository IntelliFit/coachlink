import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, Video, AlertCircle } from 'lucide-react';
import { VideoUploadContext } from '../../types/video';
import { videoService } from '@/app/service/videoService';

interface VideoFile {
    file: File;
    notes: string;
    id: string;
}

interface VideoUploaderProps {
    userId: string;
    context: VideoUploadContext;
    onUploadSuccess?: (videos: any[]) => void;
    onUploadError?: (error: Error) => void;
    maxFileSize?: number; // MB
    maxFiles?: number;
    acceptedFormats?: string[];
    showUrlInput?: boolean;
}

const VideoUploader: React.FC<VideoUploaderProps> = ({
    userId,
    context,
    onUploadSuccess,
    onUploadError,
    maxFileSize = 30,
    maxFiles = 5,
    acceptedFormats = ['video/mp4', 'video/mov', 'video/avi', 'video/webm'],
    showUrlInput = true
}) => {
    const [files, setFiles] = useState<VideoFile[]>([]);
    const [url, setUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState<{ [key: string]: number }>({});
    const [error, setError] = useState('');
    const [useUrl, setUseUrl] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const validateFile = useCallback((file: File): string | null => {
        if (!acceptedFormats.includes(file.type)) {
            return `不支持的文件格式。请使用: ${acceptedFormats.join(', ')}`;
        }

        if (file.size > maxFileSize * 1024 * 1024) {
            return `文件过大。最大支持 ${maxFileSize}MB`;
        }

        return null;
    }, [acceptedFormats, maxFileSize]);

    const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
        if (!selectedFiles || selectedFiles.length === 0) return;

        const newFiles: VideoFile[] = [];
        let hasError = false;

        // Check if adding these files would exceed the limit
        if (files.length + selectedFiles.length > maxFiles) {
            setError(`最多只能上传 ${maxFiles} 个视频文件`);
            return;
        }

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const validationError = validateFile(file);

            if (validationError) {
                setError(`${file.name}: ${validationError}`);
                hasError = true;
                break;
            }

            newFiles.push({
                file,
                notes: '',
                id: `${Date.now()}-${i}`
            });
        }

        if (!hasError) {
            setFiles(prev => [...prev, ...newFiles]);
            setError('');
            setUseUrl(false);
        }
    }, [validateFile, files.length, maxFiles]);

    const handleUpload = async () => {
        try {
            setUploading(true);
            setError('');

            const uploadedVideos: any[] = [];

            if (useUrl && url.trim()) {
                const urlNotes = files.find(f => f.id === 'url')?.notes || '';
                const uploadContext = {
                    ...context,
                    user_notes: urlNotes
                };
                const video = await videoService.submitVideoUrl({
                    videoUrl: url.trim(),
                    context: uploadContext
                });
                uploadedVideos.push(video);
            } else if (files.length > 0) {
                // Upload each file individually with delay to avoid Next.js Request body lock
                for (let i = 0; i < files.length; i++) {
                    const videoFile = files[i];
                    const uploadContext = {
                        ...context,
                        user_notes: videoFile.notes
                    };

                    const video = await videoService.uploadVideoFile(
                        userId,
                        videoFile.file,
                        uploadContext,
                        (progressData) => {
                            setProgress(prev => ({
                                ...prev,
                                [videoFile.id]: progressData.percentage
                            }));
                        }
                    );
                    uploadedVideos.push(video);

                    // Add 300ms delay between uploads to avoid Next.js 16 Request body lock issue
                    if (i < files.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }
            } else {
                throw new Error('请选择文件或输入URL');
            }

            onUploadSuccess?.(uploadedVideos);

            // 重置状态
            setFiles([]);
            setUrl('');
            setProgress({});
            setUseUrl(false);

        } catch (err) {
            const error = err as Error;
            setError(error.message);
            onUploadError?.(error);
        } finally {
            setUploading(false);
        }
    };

    const clearAllFiles = () => {
        setFiles([]);
        setUrl('');
        setError('');
        setProgress({});
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id));
        setProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[id];
            return newProgress;
        });
    };

    const updateFileNotes = (id: string, notes: string) => {
        setFiles(prev => prev.map(f =>
            f.id === id ? { ...f, notes } : f
        ));
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'baseline': return '基线评估视频';
            case 'training': return '训练视频';
            case 'completion': return '完成总结视频';
            default: return '视频';
        }
    };

    return (
        <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                    上传{getTypeLabel(context.type)}
                </h3>

                {showUrlInput && (
                    <div className="flex gap-2 mb-3">
                        <button
                            type="button"
                            onClick={() => setUseUrl(false)}
                            className={`px-3 py-1 text-sm rounded ${!useUrl ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                                }`}
                        >
                            上传文件
                        </button>
                        <button
                            type="button"
                            onClick={() => setUseUrl(true)}
                            className={`px-3 py-1 text-sm rounded ${useUrl ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                                }`}
                        >
                            粘贴链接
                        </button>
                    </div>
                )}

                {!useUrl ? (
                    <div className="space-y-3">
                        {/* File upload area */}
                        {files.length < maxFiles && (
                            <div
                                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept={acceptedFormats.join(',')}
                                    onChange={(e) => handleFileSelect(e.target.files)}
                                    className="hidden"
                                />

                                <div className="space-y-2">
                                    <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                                    <p className="text-sm text-gray-600">
                                        点击上传或拖拽文件到此处
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        支持: {acceptedFormats.map(f => f.split('/')[1]).join(', ')}，最大 {maxFileSize}MB，最多 {maxFiles} 个文件
                                    </p>
                                    <p className="text-xs text-blue-600">
                                        已选择 {files.length}/{maxFiles} 个文件
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* File list */}
                        {files.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-sm font-medium text-gray-700">已选择的视频文件:</h4>
                                    <button
                                        type="button"
                                        onClick={clearAllFiles}
                                        className="text-red-500 hover:text-red-700 text-sm"
                                    >
                                        清除全部
                                    </button>
                                </div>

                                {files.map((videoFile, index) => (
                                    <div key={videoFile.id} className="border rounded-lg p-4 bg-white">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center space-x-2">
                                                <Video className="w-5 h-5 text-blue-500" />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{videoFile.file.name}</p>
                                                    <p className="text-xs text-gray-500">{(videoFile.file.size / 1024 / 1024).toFixed(1)} MB</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeFile(videoFile.id)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Individual notes for each file */}
                                        <div className="space-y-2">
                                            <label className="block text-xs font-medium text-gray-700">
                                                视频 {index + 1} 备注（可选）
                                            </label>
                                            <textarea
                                                value={videoFile.notes}
                                                onChange={(e) => updateFileNotes(videoFile.id, e.target.value)}
                                                placeholder={
                                                    context.type === 'baseline'
                                                        ? '例如：这是我测试引体向上的视频，请指导我的动作'
                                                        : context.type === 'training'
                                                            ? '例如：今天的训练感觉不错，负重增加了5kg'
                                                            : '例如：完成了本周的训练计划，这是最后的总结视频'
                                                }
                                                rows={2}
                                                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        {/* Progress bar for individual file */}
                                        {uploading && progress[videoFile.id] !== undefined && (
                                            <div className="mt-2 space-y-1">
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                                        style={{ width: `${progress[videoFile.id]}%` }}
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-600">{progress[videoFile.id]}% 上传中...</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <input
                            type="url"
                            placeholder="请输入视频链接（如: https://www.bilibili.com/video/...）"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />

                        {/* URL 备注字段 */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                视频备注（可选）
                            </label>
                            <textarea
                                value={url ? (files.find(f => f.id === 'url')?.notes || '') : ''}
                                onChange={(e) => {
                                    // 为 URL 创建一个虚拟文件对象来存储备注
                                    setFiles(prev => {
                                        const urlFile = prev.find(f => f.id === 'url');
                                        if (urlFile) {
                                            return prev.map(f => f.id === 'url' ? { ...f, notes: e.target.value } : f);
                                        } else {
                                            return [...prev, { id: 'url', file: null as any, notes: e.target.value }];
                                        }
                                    });
                                }}
                                placeholder={
                                    context.type === 'baseline'
                                        ? '例如：这是我测试引体向上的视频，请指导我的动作'
                                        : context.type === 'training'
                                            ? '例如：今天的训练感觉不错，负重增加了5kg'
                                            : '例如：完成了本周的训练计划，这是最后的总结视频'
                                }
                                rows={3}
                                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                )}

                {error && (
                    <div className="flex items-center text-red-600 text-sm">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {error}
                    </div>
                )}

                <div className="flex justify-end">
                    <button
                        onClick={handleUpload}
                        disabled={uploading || (files.length === 0 && !url.trim())}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                        {uploading ? '上传中...' :
                            files.length > 1 ? `提交 ${files.length} 个视频` :
                                files.length === 1 ? '提交视频' :
                                    '提交视频'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VideoUploader;