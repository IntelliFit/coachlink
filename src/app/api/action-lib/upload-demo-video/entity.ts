// 请求参数的接口类型（FormData: file）
export interface UploadDemoVideoDto {}

export interface UploadDemoVideoResponseDto {
    url: string;
    storage_bucket: string;
    storage_path: string;
}

