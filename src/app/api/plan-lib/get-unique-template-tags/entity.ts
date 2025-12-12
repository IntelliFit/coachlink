// 请求参数的接口类型
export interface GetUniqueTemplateTagsDto {
    coachId?: string;
}

// 返回参数的接口类型
export interface GetUniqueTemplateTagsResponseDto {
    tags: string[];
}