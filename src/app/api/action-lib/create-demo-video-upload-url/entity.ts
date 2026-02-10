export interface CreateDemoVideoUploadUrlDto {
    originalFilename: string;
    contentType: string;
    fileSizeBytes: number;
}

export interface CreateDemoVideoUploadUrlResponseDto {
    bucket: "videos";
    path: string;
    token: string;
    publicUrl: string;
    /** 由服务端生成的完整直传 URL，前端仅用于 PUT 上传，不暴露 key */
    uploadUrl: string;
}

