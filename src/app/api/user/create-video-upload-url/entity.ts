export interface CreateVideoUploadUrlDto {
    originalFilename: string;
    contentType: string;
    fileSizeBytes: number;
}

export interface CreateVideoUploadUrlResponseDto {
    bucket: "videos";
    path: string;
    token: string;
    publicUrl: string;
    /** 由服务端生成的完整直传 URL，前端仅用于 PUT 上传，不暴露 key */
    uploadUrl: string;
}

