// 教练收款码上传 API 类型定义

export interface QrCodeItem {
    type: "wechat" | "alipay";
    name: string;
    url: string;
}

export interface UpdatePaymentQrCodesDto {
    qrCodes: QrCodeItem[]; // 最多2个
}

export interface UpdatePaymentQrCodesResponseDto {
    qrCodes: QrCodeItem[];
}

export interface GetPaymentQrCodesResponseDto {
    qrCodes: QrCodeItem[];
    allowPersonalQrcode: boolean;
}
