export interface ResetPasswordDto {
    type: 'phone' | 'email';
    verifyCode: string;
    newPassword: string;
}

export interface ResetPasswordResponseDto {
    success: boolean;
}
