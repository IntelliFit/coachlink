/**
 * 训练执行系统 - TypeScript类型定义
 * 
 * 本文件包含训练执行系统的所有类型定义
 */

// =====================================================
// 基础类型
// =====================================================

/**
 * 组状态枚举
 */
export type SetStatus = 
  | 'pending'      // 待完成
  | 'in_progress'  // 进行中
  | 'completed'    // 已完成
  | 'skipped'      // 已跳过
  | 'failed';      // 失败

/**
 * 训练记录状态枚举
 */
export type TrainingStatus = 
  | 'in_progress'  // 进行中
  | 'completed'    // 已完成
  | 'abandoned';   // 已放弃

/**
 * 视频上传状态枚举
 */
export type UploadStatus = 
  | 'uploading'    // 上传中
  | 'uploaded'     // 已上传
  | 'failed';      // 上传失败

// =====================================================
// 训练记录相关类型
// =====================================================

/**
 * 单组记录
 */
export interface SetRecord {
  set_index: number;
  
  // 计划参数
  planned_weight?: number;
  planned_reps: string | number;
  planned_rest_seconds: number;
  
  // 实际完成
  actual_weight?: number;
  actual_reps?: number;
  actual_rest_seconds?: number;
  
  // 状态
  status: SetStatus;
  is_pr: boolean; // 是否为个人记录
  is_breakthrough?: boolean; // 是否为进步组（学员标记的突破性表现）
  
  // 媒体
  video_id?: string;
  has_video?: boolean;
  
  // 时间
  started_at?: string;
  completed_at?: string;
  
  // 备注
  notes?: string;
}

/**
 * 动作记录
 */
export interface ExerciseRecord {
  exercise_index: number;
  exercise_name: string;
  exercise_category?: string;
  sets: SetRecord[];
  notes?: string;
  
  // 统计信息
  total_sets?: number;
  completed_sets?: number;
  skipped_sets?: number;
}

/**
 * 训练记录（数据库表对应）
 */
export interface TrainingRecord {
  id: string;
  user_id: string;
  plan_id: string;
  training_date: string;
  week_number: number;
  day_number: number;
  
  // 训练内容
  exercises: ExerciseRecord[];
  
  // 统计
  total_sets: number;
  completed_sets: number;
  skipped_sets: number;
  
  // 时间
  started_at: string;
  completed_at?: string;
  duration_minutes?: number;
  
  // 状态
  status: TrainingStatus;
  
  // 笔记
  notes?: string;
  
  // 时间戳
  created_at: string;
  updated_at: string;
}

/**
 * 组视频记录
 */
export interface SetVideo {
  id: string;
  training_record_id: string;
  exercise_index: number;
  set_index: number;
  
  // 视频信息
  video_url: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  file_size_bytes?: number;
  
  // 状态
  upload_status: UploadStatus;
  
  // 教练反馈
  coach_feedback?: string;
  coach_rating?: number; // 1-5
  reviewed_at?: string;
  reviewed_by?: string;
  
  created_at: string;
}

// =====================================================
// 本地缓存类型
// =====================================================

/**
 * 训练缓存（localStorage）
 */
export interface TrainingCache {
  exercises: ExerciseRecord[];
  currentExerciseIndex: number;
  lastSaveTime: string;
  autoSaveEnabled: boolean;
}

// =====================================================
// 组件Props类型
// =====================================================

/**
 * SetItem 组件 Props
 */
export interface SetItemProps {
  userId: string; // 当前用户ID
  trainingRecordId: string; // 当前训练记录ID
  set: SetRecord; // 组记录
  exerciseIndex: number; // 动作索引
  setIndex: number; // 组索引
  exerciseName: string; // 动作名称
  exerciseCategory?: string; // 动作类别（main/accessory/warmup/cooldown）
  
  // 回调函数
  onComplete: (data: SetRecord) => void;
  onSkip: () => void;
  onUpdate: (data: Partial<SetRecord>) => void;
  onDelete?: () => void;
  
  // 可选配置
  showLastRecord?: boolean;
  showVideo?: boolean;
  showPR?: boolean;
  readOnly?: boolean; // 只读模式
  disabled?: boolean;
}

/**
 * ExerciseItem 组件 Props
 */
export interface ExerciseItemProps {
  userId: string; // 当前用户ID
  trainingRecordId: string; // 当前训练记录ID
  exercise: ExerciseRecord; // 动作记录
  exerciseIndex: number; // 动作索引
  
  // 回调函数
  onSetComplete: (setIndex: number, data: SetRecord) => void;
  onSetSkip: (setIndex: number) => void;
  onSetUpdate: (setIndex: number, data: Partial<SetRecord>) => void;
  onSetDelete?: (setIndex: number) => void;
  onAddSet: () => void;
  onUpdateNotes: (notes: string) => void;
  
  // 状态
  expanded?: boolean;
  onToggleExpand?: () => void;
  readOnly?: boolean; // 只读模式
}

/**
 * RestTimer 组件 Props
 */
export interface RestTimerProps {
  seconds: number;
  onComplete: () => void;
  onSkip?: () => void;
  autoStart?: boolean;
}

/**
 * VideoUploader 组件 Props
 */
export interface VideoUploaderProps {
  trainingRecordId: string;
  exerciseIndex: number;
  setIndex: number;
  
  // 回调
  onUploadStart?: () => void;
  onUploadProgress?: (progress: number) => void;
  onUploadComplete: (video: SetVideo) => void;
  onUploadError?: (error: Error) => void;
  
  // 配置
  maxFileSize?: number; // bytes
  quality?: 'high' | 'medium' | 'low';
  wifiOnly?: boolean;
}

/**
 * TrainingHeader 组件 Props
 */
export interface TrainingHeaderProps {
  week: number;
  day: number;
  completedSets: number;
  totalSets: number;
  saving?: boolean;
  lastSaved?: Date | null;
  onBack?: () => void;
}

/**
 * TrainingFooter 组件 Props
 */
export interface TrainingFooterProps {
  completedSets: number;
  totalSets: number;
  onFinish: () => void;
  onSaveDraft: () => void;
  onAbandon?: () => void;
  disabled?: boolean;
}

/**
 * TrainingSummary 组件 Props
 */
export interface TrainingSummaryProps {
  record: TrainingRecord;
  onClose: () => void;
  onShare?: () => void;
  onViewHistory?: () => void;
}

// =====================================================
// 工具类型
// =====================================================

/**
 * 训练统计
 */
export interface TrainingStats {
  total_sessions: number;
  completed_sessions: number;
  total_completed_sets: number;
  total_sets: number;
  avg_duration_minutes: number;
  last_training_date: string;
  completion_percentage: number;
}

/**
 * PR记录
 */
export interface PRRecord {
  exercise_name: string;
  set_index: number;
  weight: number;
  reps: number;
  date: string;
  training_record_id: string;
}

/**
 * 训练进度
 */
export interface TrainingProgress {
  week_number: number;
  day_number: number;
  completed: boolean;
  completion_percentage: number;
  date: string;
}

/**
 * 视频上传进度
 */
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// =====================================================
// API 请求/响应类型
// =====================================================

/**
 * 保存训练记录请求
 */
export interface SaveTrainingRecordRequest {
  user_id: string;
  plan_id: string;
  training_date: string;
  week_number: number;
  day_number: number;
  exercises: ExerciseRecord[];
  status: TrainingStatus;
  notes?: string;
}

/**
 * 保存训练记录响应
 */
export interface SaveTrainingRecordResponse {
  success: boolean;
  data?: TrainingRecord;
  error?: string;
}

/**
 * 上传视频请求
 */
export interface UploadVideoRequest {
  training_record_id: string;
  exercise_index: number;
  set_index: number;
  file: File;
}

/**
 * 上传视频响应
 */
export interface UploadVideoResponse {
  success: boolean;
  data?: SetVideo;
  error?: string;
}

// =====================================================
// 配置类型
// =====================================================

/**
 * 训练执行配置
 */
export interface TrainingExecutionConfig {
  autoSave: boolean;
  autoSaveInterval: number; // 秒
  enableNotifications: boolean;
  enableSound: boolean;
  restTimerSound: boolean;
  defaultRestTime: number; // 秒
  videoQuality: 'high' | 'medium' | 'low';
  uploadOnWifiOnly: boolean;
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: TrainingExecutionConfig = {
  autoSave: true,
  autoSaveInterval: 30,
  enableNotifications: true,
  enableSound: true,
  restTimerSound: true,
  defaultRestTime: 180,
  videoQuality: 'medium',
  uploadOnWifiOnly: true
};

// =====================================================
// 错误类型
// =====================================================

/**
 * 训练执行错误
 */
export class TrainingExecutionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'TrainingExecutionError';
  }
}

/**
 * 错误码枚举
 */
export enum ErrorCode {
  SAVE_FAILED = 'SAVE_FAILED',
  LOAD_FAILED = 'LOAD_FAILED',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_DATA = 'INVALID_DATA',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS'
}

// =====================================================
// 辅助类型
// =====================================================

/**
 * 深度部分类型（递归）
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * 只读深度类型
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * 可选字段
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * 必填字段
 */
export type Required<T, K extends keyof T> = T & {
  [P in K]-?: T[P];
};

// =====================================================
// Hooks 返回类型
// =====================================================

/**
 * useTrainingState Hook 返回类型
 */
export interface UseTrainingStateReturn {
  record: TrainingRecord | null;
  exercises: ExerciseRecord[];
  loading: boolean;
  saving: boolean;
  error: Error | null;
  currentExerciseIndex: number;
  completedSets: number;
  totalSets: number;
  progress: number;
  updateSet: (exerciseIndex: number, setIndex: number, data: Partial<SetRecord>) => void;
  markComplete: (exerciseIndex: number, setIndex: number, data: SetRecord) => void;
  skipSet: (exerciseIndex: number, setIndex: number) => void;
  addSet: (exerciseIndex: number) => void;
  deleteSet: (exerciseIndex: number, setIndex: number) => void;
  updateExerciseNotes: (exerciseIndex: number, notes: string) => void;
  saveRecord: () => Promise<void>;
  finishTraining: (notes?: string) => Promise<void>;
  abandonTraining: () => Promise<void>;
}

/**
 * useRestTimer Hook 返回类型
 */
export interface UseRestTimerReturn {
  timeLeft: number;
  isRunning: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  skip: () => void;
}

/**
 * useAutoSave Hook 返回类型
 */
export interface UseAutoSaveReturn {
  saving: boolean;
  lastSaved: Date | null;
  error: Error | null;
  forceSave: () => Promise<void>;
  enableAutoSave: () => void;
  disableAutoSave: () => void;
}
