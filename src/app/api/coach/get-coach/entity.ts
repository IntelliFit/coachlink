import { CoachesRow } from "@/types";

export interface GetCoachDto {
    id?: string;
    userId?: string;
    needQrCode?: boolean;
    needPaymentInfo?: boolean; // 是否需要支付相关信息
    needInvitationInfo?: boolean;
}

export interface QrCodeItem {
    type: "wechat" | "alipay";
    name: string;
    url: string;
}

export interface GetCoachResponseDto {
    coach: CoachesRow | null;
    paymentInfo?: {
        effectivePaymentMode: "qrcode" | "alipay_api" | "both";
        allowPersonalQrcode: boolean;
        qrCodes: QrCodeItem[];
    };
    invitationInfo?: {
        invitationCode: string;
        invitationMode: "exclusive" | "open";
        inviteUrl: string;
        inviteUrlExclusive: string;
        inviteUrlOpen: string;
    };
}
