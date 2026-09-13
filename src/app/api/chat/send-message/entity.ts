// 视频引用项
export interface VideoReferenceItem {
    videoId: string;
    videoUrl: string;
    thumbnailUrl: string | null;
    actionName: string;
    /** For personal videos / collections */
    description?: string | null;
    tags?: string[] | null;
    sourceType?: "execution_set" | "training_video" | "video_collection";
    setNumber: number;
    weight: number | null;
    reps: number | null;
    isProgress: boolean;
    createdAt: string;
    dayIndex?: number | null;
    studentInfo?: {
        id: string;
        fullName: string | null;
        nickname: string | null;
        avatarUrl: string | null;
    };
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
    /** Only videoId is trusted; the server rebuilds all metadata after authorization. */
    videoReferences?: Array<Pick<VideoReferenceItem, "videoId"> & Partial<VideoReferenceItem>>;
    replyToMessageId?: string;
}

export interface SendMessageResponseDto {
    messageId: string;
    createdAt: string;
}
