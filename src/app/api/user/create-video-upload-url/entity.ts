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
}

