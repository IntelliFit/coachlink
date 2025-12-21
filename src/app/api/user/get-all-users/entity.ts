export interface GetAllUsersDto {
    page?: number;
    limit?: number;
    search?: string;
}

export interface GetAllUsersResponseDto {
    success: boolean;
    message: string;
    data?: {
        users: any[];
        count: number;
        pagination: {
            page: number;
            limit: number;
        };
    };
}