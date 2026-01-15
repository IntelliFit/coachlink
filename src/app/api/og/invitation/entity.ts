// 请求参数的接口类型
export interface GenerateInvitationOgImageDto {
    name?: string;
    title?: string;
    experience?: string;
    avatar?: string;
    qrCode?: string;
}

// 返回参数的接口类型
export interface GenerateInvitationOgImageResponseDto {
    imageUrl: string;
}