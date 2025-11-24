export interface RegisterDto {
    phone: string;
    password: string;
    verifyCode: string;
}

export interface RegisterResponseDto {
    user: any;
}