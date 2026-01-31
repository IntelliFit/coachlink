export interface SendVerificationCodeDto {
    phoneNumber: string;
    /** 滑块验证通过后获得的 token，发送前必传 */
    captchaToken?: string;
}

export interface SendVerificationCodeResponseDto {
    requestId?: string;
}