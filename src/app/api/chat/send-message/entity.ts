// 视频引用项
export interface VideoReferenceItem {
    videoId: string;
    videoUrl: string;
    thumbnailUrl: string | null;
    actionName: string;
    setNumber: number;
    weight: number | null;
    reps: number | null;
    isProgress: boolean;
    createdAt: string;
    dayIndex?: number | null;
}

export interface SendMessageDto {
    roomId: string;
    messageType:
        | "text"
        | "image"
        | "video"
        | "voice"
        | "file"
        | "video_reference";
    content: string;
    mediaUrl?: string;
    fileName?: string;
    fileSize?: number;
    duration?: number;
    videoReferences?: VideoReferenceItem[]; // 新增：视频引用列表
}

export interface SendMessageResponseDto {
    messageId: string;
    createdAt: string;
}
