/**
 * SetVideoUploader - 组视频上传组件
 * 
 * 支持两种上传方式：
 * 1. 本地文件上传
 * 2. 粘贴视频链接
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, Video, ExternalLink, AlertCircle } from 'lucide-react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { ProgressBar } from 'primereact/progressbar';
import { trainingService } from '@/app/service/trainingService';
import { coachVideoService } from '@/app/service/coachVideoService';
import { useToastContext } from '@/context/ToastContext';

interface SetVideoUploaderProps {
  trainingRecordId: string;
  exerciseIndex: number;
  setIndex: number;
  currentVideoId?: string;
  visible: boolean;
  onHide: () => void;
  onUploadSuccess: (videoId: string, videoUrl: string) => void;
}

const SetVideoUploader: React.FC<SetVideoUploaderProps> = ({
  trainingRecordId,
  exerciseIndex,
  setIndex,
  currentVideoId,
  visible,
  onHide,
  onUploadSuccess
}) => {
  const { showToast } = useToastContext();
  
  // 上传模式：'file' 或 'url'
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('url');
  
  // 文件上传相关
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // URL上传相关
  const [videoUrl, setVideoUrl] = useState('');
  const [videoNotes, setVideoNotes] = useState('');
  
  // 状态
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
  // 文件大小和格式限制
  const maxFileSize = 100; // MB
  const acceptedFormats = ['video/mp4', 'video/mov', 'video/avi', 'video/webm', 'video/quicktime'];
  
  // 验证文件
  const validateFile = useCallback((file: File): string | null => {
    if (!acceptedFormats.includes(file.type)) {
      return `不支持的文件格式。请使用: MP4, MOV, AVI, WEBM`;
    }
    
    if (file.size > maxFileSize * 1024 * 1024) {
      return `文件过大。最大支持 ${maxFileSize}MB`;
    }
    
    return null;
  }, []);
  
  // 处理文件选择
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      showToast({ severity: 'error', summary: validationError });
      return;
    }
    
    setSelectedFile(file);
    setError('');
  }, [validateFile, showToast]);
  
  // 上传文件
  const handleFileUpload = async () => {
    if (!selectedFile) {
      setError('请选择文件');
      return;
    }
    
    if (trainingRecordId === 'preview') {
      showToast({ severity: 'warn', summary: '请先保存训练记录' });
      return;
    }
    
    setUploading(true);
    setError('');
    
    try {
      // 1. 上传文件到视频服务
      const uploadedVideo = await coachVideoService.uploadVideoFile(
        selectedFile,
        {
          type: 'training',
          training_plan_id: undefined,
          training_session_id: undefined,
          requires_review: false
        },
        (progressEvent) => {
          if (progressEvent.total && progressEvent.loaded) {
            const percentage = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            setUploadProgress(percentage);
          }
        }
      );
      
      if (!uploadedVideo?.video_url) {
        throw new Error('视频上传失败，未返回视频URL');
      }
      
      // 2. 将视频关联到组
      const result = await trainingService.uploadSetVideo({
        training_record_id: trainingRecordId,
        exercise_index: exerciseIndex,
        set_index: setIndex,
        video_url: uploadedVideo.video_url
      });
      
      if (result && 'id' in result && typeof result.id === 'string') {
        showToast({ severity: 'success', summary: '视频上传成功' });
        onUploadSuccess(result.id, uploadedVideo.video_url);
        handleClose();
      } else {
        throw new Error('视频关联失败');
      }
    } catch (err) {
      console.error('上传文件失败:', err);
      const errorMessage = err instanceof Error ? err.message : '视频上传失败';
      setError(errorMessage);
      showToast({ severity: 'error', summary: errorMessage });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };
  
  // 上传URL
  const handleUrlUpload = async () => {
    if (!videoUrl.trim()) {
      setError('请输入视频链接');
      return;
    }
    
    if (trainingRecordId === 'preview') {
      showToast({ severity: 'warn', summary: '请先保存训练记录' });
      return;
    }
    
    setUploading(true);
    setError('');
    
    try {
      const result = await trainingService.uploadSetVideo({
        training_record_id: trainingRecordId,
        exercise_index: exerciseIndex,
        set_index: setIndex,
        video_url: videoUrl.trim()
      });
      
      if (result && 'id' in result && typeof result.id === 'string') {
        showToast({ severity: 'success', summary: '视频链接保存成功' });
        onUploadSuccess(result.id, videoUrl.trim());
        handleClose();
      } else {
        throw new Error('视频链接保存失败');
      }
    } catch (err) {
      console.error('保存视频链接失败:', err);
      const errorMessage = err instanceof Error ? err.message : '视频链接保存失败';
      setError(errorMessage);
      showToast({ severity: 'error', summary: errorMessage });
    } finally {
      setUploading(false);
    }
  };
  
  // 关闭对话框
  const handleClose = () => {
    setSelectedFile(null);
    setVideoUrl('');
    setVideoNotes('');
    setError('');
    setUploadProgress(0);
    setUploadMode('url');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onHide();
  };
  
  // 对话框底部按钮
  const dialogFooter = (
    <div className="flex justify-content-end gap-2">
      <Button
        label="取消"
        severity="secondary"
        outlined
        onClick={handleClose}
        disabled={uploading}
      />
      <Button
        label={uploading ? (uploadMode === 'file' ? '上传中...' : '保存中...') : (uploadMode === 'file' ? '上传视频' : '保存链接')}
        severity="success"
        onClick={uploadMode === 'file' ? handleFileUpload : handleUrlUpload}
        disabled={uploading || (uploadMode === 'file' ? !selectedFile : !videoUrl.trim())}
        loading={uploading}
      />
    </div>
  );
  
  return (
    <Dialog
      header="上传训练视频"
      visible={visible}
      onHide={handleClose}
      style={{ width: '600px' }}
      footer={dialogFooter}
      closable={!uploading}
    >
      <div className="flex flex-column gap-4">
        {/* 上传模式切换 */}
        <div className="flex gap-2">
          <Button
            label="上传文件"
            icon={<Upload className="w-4 h-4" />}
            severity={uploadMode === 'file' ? 'info' : 'secondary'}
            outlined={uploadMode !== 'file'}
            onClick={() => setUploadMode('file')}
            disabled={uploading}
            className="flex-1"
          />
          <Button
            label="粘贴链接"
            icon={<ExternalLink className="w-4 h-4" />}
            severity={uploadMode === 'url' ? 'info' : 'secondary'}
            outlined={uploadMode !== 'url'}
            onClick={() => setUploadMode('url')}
            disabled={uploading}
            className="flex-1"
          />
        </div>
        
        {/* 文件上传模式 */}
        {uploadMode === 'file' && (
          <div className="flex flex-column gap-3">
            <div
              className="border-2 border-dashed surface-border border-round p-6 text-center cursor-pointer hover:surface-hover transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedFormats.join(',')}
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploading}
              />
              
              <Upload className="w-12 h-12 text-500 mx-auto mb-3" />
              <p className="text-surface-foreground mb-2">
                {selectedFile ? selectedFile.name : '点击选择视频文件'}
              </p>
              <p className="text-sm text-500 mb-1">
                支持: MP4, MOV, AVI, WEBM
              </p>
              <p className="text-xs text-500">
                最大文件大小: {maxFileSize}MB
              </p>
              {selectedFile && (
                <p className="text-sm text-primary mt-2">
                  文件大小: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>
            
            {selectedFile && !uploading && (
              <Button
                label="移除文件"
                icon={<X className="w-4 h-4" />}
                severity="danger"
                text
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              />
            )}
            
            {/* 上传进度 */}
            {uploading && uploadProgress > 0 && (
              <div>
                <div className="flex justify-content-between mb-2">
                  <span className="text-sm text-600">上传进度</span>
                  <span className="text-sm font-semibold text-primary">{uploadProgress}%</span>
                </div>
                <ProgressBar value={uploadProgress} />
              </div>
            )}
            
            {/* 视频备注 */}
            <div>
              <label className="block text-sm font-medium text-surface-foreground mb-2">
                视频备注（可选）
              </label>
              <InputTextarea
                value={videoNotes}
                onChange={(e) => setVideoNotes(e.target.value)}
                placeholder="例如：今天的训练感觉不错，负重增加了5kg"
                rows={3}
                className="w-full"
                disabled={uploading}
              />
            </div>
          </div>
        )}
        
        {/* URL上传模式 */}
        {uploadMode === 'url' && (
          <div className="flex flex-column gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-foreground mb-2">
                视频链接
              </label>
              <InputText
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="粘贴抖音、B站、YouTube等视频链接"
                className="w-full"
                disabled={uploading}
              />
              <small className="text-600 mt-1 block">
                支持抖音、B站、YouTube等主流视频平台链接
              </small>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-surface-foreground mb-2">
                视频备注（可选）
              </label>
              <InputTextarea
                value={videoNotes}
                onChange={(e) => setVideoNotes(e.target.value)}
                placeholder="例如：今天的训练感觉不错，负重增加了5kg"
                rows={3}
                className="w-full"
                disabled={uploading}
              />
            </div>
          </div>
        )}
        
        {/* 错误提示 */}
        {error && (
          <div className="flex align-items-center gap-2 p-3 bg-red-50 border-round">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm text-red-600">{error}</span>
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default SetVideoUploader;

