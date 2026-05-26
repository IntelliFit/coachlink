export interface GetAdminCredentialResponseDto {
    credential: {
        loginIdentifier: string | null;
        hasPassword: boolean;
        isActive: boolean;
        role: string | null;
        permissions: string[] | null;
        linkedPhone: string | null;
        linkedEmail: string | null;
        canUnbindPhone: boolean;
    };
}

export interface UpdateAdminCredentialDto {
    loginIdentifier: string;
    password: string;
}

export interface UpdateAdminCredentialResponseDto {
    credential: {
        loginIdentifier: string;
        isActive: boolean;
    };
}
