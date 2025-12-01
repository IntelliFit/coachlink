// 请求参数的接口类型
export interface GetAlipayQrcodeDto {
    order_id: string;
}

// 返回参数的接口类型
export interface GetAlipayQrcodeResponseDto {
    qr_code: string;
    order_id: string;
    out_trade_no: string;
}