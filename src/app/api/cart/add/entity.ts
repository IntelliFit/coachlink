export interface AddToCartDto {
    coachId: string;
    coachName: string;
    productId: string;
    productName: string;
    productTier: 'basic' | 'standard' | 'vip';
    durationMonths: number;
    price: number;
}

export interface AddToCartResponseDto {
    item: {
        id: string;
        coachId: string;
        coachName: string;
        productId: string;
        productName: string;
        productTier: 'basic' | 'standard' | 'vip';
        durationMonths: number;
        price: number;
        createdAt: string;
    };
}
