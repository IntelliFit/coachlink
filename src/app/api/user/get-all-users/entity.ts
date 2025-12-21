export interface GetAllUsersDto {
    page?: number;
    limit?: number;
    search?: string;
}

export interface GetAllUsersResponseDto {
    users: any[];
    count: number;
    pagination: {
        page: number;
        limit: number;
    };
}