export interface SliderCreateDto {
    // no body
}

export interface SliderCreateResponseDto {
    id: string;
    /** 目标位置百分比（30-90），用于前端显示缺口位置 */
    targetPercent: number;
}
