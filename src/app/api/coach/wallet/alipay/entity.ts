export interface BindAlipayDto {
    payee_account: string;
    payee_type?: 'ALIPAY_LOGON_ID' | 'ALIPAY_USERID' | string;
    real_name?: string;
    verification_method?: string;
}

export interface BindAlipayResponse {
    id: string;
    payee_account_masked: string;
    verified: boolean;
}

export interface WithdrawDto {
    amount: number;
    account_id?: string; // optional, if omitted use default bound account
}

export interface WithdrawResponse {
    id: string;
    status: string;
    out_biz_no?: string;
}
