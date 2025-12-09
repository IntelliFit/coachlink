export interface VerifyCodeDto {
    phoneNumber: string;
    code: string;
}

export interface VerifyCodeResponseDto {
    success: boolean;
    message: string;
    verified: boolean;
}