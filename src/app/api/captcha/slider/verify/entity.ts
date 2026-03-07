export interface SliderVerifyDto {
    id: string;
    /** 用户滑块位置的百分比 (0-100) */
    percent: number;
}

export interface SliderVerifyResponseDto {
    token: string;
}
