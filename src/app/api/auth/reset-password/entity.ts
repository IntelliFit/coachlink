export interface ResetPasswordDto {
    phone: string;
    verifyCode: string;
    newPassword: string;
}

export interface ResetPasswordResponseDto {
    success: boolean;
}
