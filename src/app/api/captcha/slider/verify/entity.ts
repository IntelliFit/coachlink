export interface SliderVerifyDto {
    id: string;
    /** 滑块中心点百分比（0-100），推荐使用 */
    percent?: number;
    /** 滑块左边缘像素位置（0~240），与 percent 二选一，兼容旧客户端 */
    position?: number;
}

export interface SliderVerifyResponseDto {
    token: string;
}
