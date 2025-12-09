export interface SendVerificationCodeDto {
    phoneNumber: string;
}

export interface SendVerificationCodeResponseDto {
    requestId?: string;
}