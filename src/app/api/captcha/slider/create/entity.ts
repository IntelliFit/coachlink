export interface SliderCreateDto {
    // no body
}

export interface SliderCreateResponseDto {
    id: string;
    trackWidth: number;
    imageUrl: string;
    targetPercent: number; // 兼容小程序端
}
