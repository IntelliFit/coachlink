export interface GetCartItemsDto {}

export interface GetCartItemsResponseDto {
    items: Array<{
        id: string;
        coachId: string;
        coachName: string;
        productId: string;
        productName: string;
        productTier: 'basic' | 'standard' | 'vip';
        durationMonths: number;
        price: number;
        createdAt: string;
        updatedAt: string;
    }>;
    total: number;
}
