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
}

