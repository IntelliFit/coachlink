export interface SliderVerifyDto {
    id: string;
    percent: number; // 滑块中心点百分比（0-100）
}

export interface SliderVerifyResponseDto {
    token: string;
}
