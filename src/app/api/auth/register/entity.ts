export interface RegisterDto {
    phone: string;
    password: string;
    verifyCode: string;
    /** 邀请码（当前实现为 inviter 的 userId） */
    ref?: string;
    /** 分享二维码的 shareId（/s/<shareId> 跳转后带到 /register?share=...） */
    shareId?: string;
}

export interface RegisterResponseDto {
    user: any;
}