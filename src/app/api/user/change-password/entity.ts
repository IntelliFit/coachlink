export interface ChangePasswordDto {
    oldPassword: string;
    newPassword: string;
}

export interface ChangePasswordResponseDto {
    success: boolean;
}
