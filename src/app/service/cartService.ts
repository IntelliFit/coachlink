import { BaseService } from '@/lib/baseService';
import type { AddToCartDto, AddToCartResponseDto } from '../api/cart/add/entity';
import type { GetCartItemsResponseDto } from '../api/cart/list/entity';
import type { RemoveFromCartDto, RemoveFromCartResponseDto } from '../api/cart/remove/entity';
import type { ClearCartResponseDto } from '../api/cart/clear/entity';

class CartService extends BaseService {
    async addToCart(reqData: AddToCartDto) {
        const res = await this.post<AddToCartResponseDto>('add', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async getCartItems() {
        const res = await this.post<GetCartItemsResponseDto>('list', {});
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async removeFromCart(reqData: RemoveFromCartDto) {
        const res = await this.post<RemoveFromCartResponseDto>('remove', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async clearCart() {
        const res = await this.post<ClearCartResponseDto>('clear', {});
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }
}

export const cartService = new CartService('/api/cart');
