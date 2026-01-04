// 管理员设置教练支付配置 API 类型定义

export interface UpdateCoachPaymentSettingsDto {
    coachId: string;
    paymentMode?: "qrcode" | "alipay_api" | "both" | null;
    allowPersonalQrcode?: boolean;
}

export interface UpdateCoachPaymentSettingsResponseDto {
    coach: {
        id: string;
        payment_mode: string | null;
        allow_personal_qrcode: boolean;
    };
}

export interface GetCoachPaymentSettingsDto {
    coachId: string;
}

export interface GetCoachPaymentSettingsResponseDto {
    coach: {
        id: string;
        name: string;
        payment_mode: string | null;
        allow_personal_qrcode: boolean;
        payment_qr_codes: QrCodeItem[];
    };
}

export interface QrCodeItem {
    type: "wechat" | "alipay";
    name: string;
    url: string;
}
