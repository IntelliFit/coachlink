'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Play, Plus, Upload, Video, X, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { videoService } from '@/app/service/videoService';
import type { TrainingVideo } from '@/types/video';
import type { StudentVideoCollection } from '@/types/videoCollection';
import VideoUploader from '@/components/video/VideoUploader';
import { useToastContext } from '@/context/ToastContext';
import type { VideoUploadContext } from '@/types/video';

type AddMode = 'existing' | 'upload';

const parseTags = (input: string) =>
    input
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);

export const VideoCollectionSection: React.FC = () => {
    const { data: session } = useSession();
    const { showToast } = useToastContext();

    const [loading, setLoading] = useState(true);
    const [collections, setCollections] = useState<StudentVideoCollection[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [mode, setMode] = useState<AddMode>('existing');
    const [existingVideos, setExistingVideos] = useState<TrainingVideo[]>([]);
    const [selectedVideoId, setSelectedVideoId] = useState<string>('');
    const [description, setDescription] = useState('');
    const [tagsInput, setTagsInput] = useState('');
    const [isFeatured, setIsFeatured] = useState(false);
    const [loadingVideos, setLoadingVideos] = useState(false);
    const [uploading, setUploading] = useState(false);

    const tagList = useMemo(() => parseTags(tagsInput), [tagsInput]);

    const loadCollections = async () => {
        if (!session?.user?.id) return;
        setLoading(true);
        try {
            const res = await videoService.listVideoCollections({
                pagination: { page: 1, limit: 60 }
            });
            if (res) {
                setCollections(res.collections);
            }
        } catch (error) {
            console.error(error);
            showToast({ severity: 'error', summary: '加载失败', detail: '获取视频集失败' });
        } finally {
            setLoading(false);
        }
    };

    const loadExistingVideos = async () => {
        if (!session?.user?.id) return;
        setLoadingVideos(true);
        try {
            const res = await videoService.getUserVideos({
                filters: {},
                pagination: { page: 1, limit: 50 }
            });
            if (res) {
                setExistingVideos(res.videos);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingVideos(false);
        }
    };

    useEffect(() => {
        loadCollections();
    }, [session?.user?.id]);

    const resetForm = () => {
        setSelectedVideoId('');
        setDescription('');
        setTagsInput('');
        setIsFeatured(false);
    };

    const handleAddExisting = async () => {
        if (!selectedVideoId) {
            showToast({ severity: 'warn', summary: '请选择视频', detail: '请先选择一个训练视频' });
            return;
        }
        if (!description.trim()) {
            showToast({ severity: 'warn', summary: '需要描述', detail: '请填写视频描述' });
            return;
        }
        setUploading(true);
        try {
            await videoService.addVideoToCollection({
                trainingVideoId: selectedVideoId,
                description: description.trim(),
                tags: tagList,
                isFeatured
            });
            showToast({ severity: 'success', summary: '已添加', detail: '视频已加入视频集' });
            await loadCollections();
            setShowModal(false);
            resetForm();
        } catch (error: any) {
            showToast({ severity: 'error', summary: '添加失败', detail: error?.message || '请稍后再试' });
        } finally {
            setUploading(false);
        }
    };

    const handleUploadSuccess = async (videos: any[]) => {
        if (!description.trim()) {
            showToast({ severity: 'warn', summary: '需要描述', detail: '请先填写描述再上传' });
            return;
        }
        const list = Array.isArray(videos) ? videos : [videos];
        const validVideos = list.filter(Boolean);
        if (validVideos.length === 0) return;

        setUploading(true);
        try {
            for (const video of validVideos) {
                await videoService.addVideoToCollection({
                    trainingVideoId: video.id,
                    description: description.trim(),
                    tags: tagList,
                    isFeatured
                });
            }
            showToast({ severity: 'success', summary: '上传成功', detail: '视频已加入视频集' });
            await loadCollections();
            setShowModal(false);
            resetForm();
        } catch (error: any) {
            showToast({ severity: 'error', summary: '保存失败', detail: error?.message || '请稍后再试' });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('确定要删除这个视频集条目吗？')) return;
        try {
            await videoService.deleteVideoCollection({ id });
            showToast({ severity: 'success', summary: '已删除', detail: '条目已删除' });
            setCollections(prev => prev.filter(c => c.id !== id));
        } catch (error: any) {
            showToast({ severity: 'error', summary: '删除失败', detail: error?.message || '请稍后再试' });
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="animate-pulse h-6 w-32 bg-gray-100 rounded mb-4" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="h-32 bg-gray-100 rounded" />
                    <div className="h-32 bg-gray-100 rounded" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-blue-500" />
                    <h3 className="text-lg font-semibold text-gray-900">视频集</h3>
                    <span className="text-sm text-gray-500">重要视频集中管理</span>
                </div>
                <button
                    onClick={() => {
                        setShowModal(true);
                        setMode('existing');
                        loadExistingVideos();
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                    <Plus className="w-4 h-4" /> 添加视频
                </button>
            </div>

            {collections.length === 0 ? (
                <div className="flex items-center gap-3 text-gray-600">
                    <Video className="w-6 h-6 text-gray-400" />
                    <span>还没有视频，立即添加一个吧</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {collections.map(item => {
                        const titleTrim = typeof item.title === 'string' ? item.title.trim() : '';
                        const descTrim = typeof item.description === 'string' ? item.description.trim() : '';
                        const displayTitle = titleTrim || descTrim || '未命名视频';
                        // 避免 title 与 description 相同导致重复显示
                        const displaySubtitle = titleTrim && descTrim && descTrim !== titleTrim ? descTrim : '';

                        return (
                            <div key={item.id} className="border rounded-xl overflow-hidden bg-gray-50">
                            <div className="relative">
                                <div className="aspect-video bg-black/5 flex items-center justify-center overflow-hidden relative">
                                    {item.thumbnail_url ? (
                                        <img src={item.thumbnail_url} alt={displayTitle} className="w-full h-full object-cover" />
                                    ) : item.video_url ? (
                                        <video
                                            src={item.video_url}
                                            className="w-full h-full object-cover"
                                            preload="metadata"
                                            muted
                                            playsInline
                                            onLoadedMetadata={(e) => {
                                                try { e.currentTarget.currentTime = 0.1; } catch { /* ignore */ }
                                            }}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.parentElement?.classList.add('bg-gray-200');
                                            }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                            <Play className="w-10 h-10 text-gray-500" />
                                        </div>
                                    )}
                                    {item.video_url && (
                                        <a
                                            href={item.video_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
                                        >
                                            <Play className="w-12 h-12 text-white" />
                                        </a>
                                    )}
                                </div>
                                <div className="absolute top-2 left-2">
                                    <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700">
                                        {item.is_featured ? '置顶' : item.source}
                                    </span>
                                </div>
                            </div>
                            <div className="p-3 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900 line-clamp-1">
                                            {displayTitle}
                                        </p>
                                {displaySubtitle ? (
                                    <p className="text-xs text-gray-500 line-clamp-2">{displaySubtitle}</p>
                                ) : null}
                                    </div>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="text-gray-400 hover:text-red-500"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                {item.tags && item.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {item.tags.map(tag => (
                                            <span key={tag} className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <p className="text-xs text-gray-500">
                                    {new Date(item.created_at).toLocaleString()}
                                </p>
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
                    <div className="bg-white rounded-xl w-full max-w-3xl p-4 shadow-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Upload className="w-5 h-5 text-blue-500" />
                                <h4 className="text-lg font-semibold">添加到视频集</h4>
                            </div>
                            <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-500 hover:text-gray-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex gap-2 mb-3">
                            <button
                                className={`px-3 py-2 rounded-lg text-sm ${mode === 'existing' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                                onClick={() => { setMode('existing'); }}
                            >
                                从已有视频选择
                            </button>
                            <button
                                className={`px-3 py-2 rounded-lg text-sm ${mode === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                                onClick={() => { setMode('upload'); }}
                            >
                                上传/链接新视频
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">视频描述（必填，作用于本次添加的单个视频）</label>
                                <textarea
                                    className="w-full border rounded-lg px-3 py-2 text-sm"
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="请写下视频的重点、场景或目的"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">标签（逗号分隔，可选）</label>
                                    <input
                                        className="w-full border rounded-lg px-3 py-2 text-sm"
                                        value={tagsInput}
                                        onChange={(e) => setTagsInput(e.target.value)}
                                        placeholder="例如：技术示范, 进步, 参考"
                                    />
                                </div>
                                <div className="flex items-center gap-2 mt-6">
                                    <input
                                        type="checkbox"
                                        id="vc-featured"
                                        checked={isFeatured}
                                        onChange={(e) => setIsFeatured(e.target.checked)}
                                        className="w-4 h-4"
                                    />
                                    <label htmlFor="vc-featured" className="text-sm text-gray-700">设为主页置顶</label>
                                </div>
                            </div>

                            {mode === 'existing' ? (
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">选择已有训练视频</label>
                                    <select
                                        className="w-full border rounded-lg px-3 py-2 text-sm"
                                        value={selectedVideoId}
                                        onChange={(e) => setSelectedVideoId(e.target.value)}
                                    >
                                        <option value="">请选择视频</option>
                                        {loadingVideos && <option value="">加载中...</option>}
                                        {existingVideos.map(video => (
                                            <option key={video.id} value={video.id}>
                                                {video.exercise_name || '训练视频'} - {new Date(video.created_at).toLocaleString()}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="flex justify-end">
                                        <button
                                            onClick={handleAddExisting}
                                            disabled={uploading}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                                        >
                                            {uploading ? '提交中...' : '加入视频集'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <VideoUploader
                                        context={{
                                            type: 'training',
                                            requires_review: false
                                        } satisfies VideoUploadContext}
                                        onUploadSuccess={handleUploadSuccess}
                                        onUploadError={(e) => showToast({ severity: 'error', summary: '上传失败', detail: e?.message || '请稍后再试' })}
                                        showUrlInput
                                        showNotes={false}
                                        maxFiles={1}
                                        submitDisabled={!description.trim()}
                                        submitDisabledMessage="请先填写视频描述"
                                    />
                                    <p className="text-xs text-gray-500">
                                        单次仅支持 1 个视频；上传完成后将使用上方描述与标签自动加入视频集。
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

