import { UsersRow } from "@/types";

export interface RegisterDto {
    phoneOrEmail: string;
    password: string;
    verifyCode: string;
    /** 邀请码（当前实现为 inviter 的 userId） */
    ref?: string;
    /** 分享二维码的 shareId（/s/<shareId> 跳转后带到 /register?share=...） */
    shareId?: string;
    /** 教练邀请码（通过教练分享链接注册时携带） */
    invitationCode?: string;
    /** 通过教练邀请链接注册时可指定视野模式：exclusive/open（用于“专属/公开”两种海报） */
    invitationMode?: "exclusive" | "open";
}

export interface RegisterResponseDto {
    user: UsersRow;
    token?: string; // JWT token for automatic login
}
