'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { cartService } from '@/app/service/cartService';

export interface CartItem {
    id: string;
    coachId: string;
    coachName: string;
    productId: string;
    productName: string;
    productTier: 'basic' | 'standard' | 'vip';
    durationMonths: number;
    price: number;
    createdAt: string;
    updatedAt?: string;
}

interface CartContextType {
    items: CartItem[];
    addToCart: (item: Omit<CartItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    removeFromCart: (itemId: string) => Promise<void>;
    clearCart: () => Promise<void>;
    getTotalPrice: () => number;
    getItemCount: () => number;
    loading: boolean;
    refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
    const { data: session } = useSession();
    const [items, setItems] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(false);

    // 从数据库加载购物车
    const loadCart = useCallback(async () => {
        if (!session?.user?.id) {
            setItems([]);
            return;
        }

        setLoading(true);
        try {
            const res = await cartService.getCartItems();
            if (res) {
                setItems(res.items);
            }
        } catch (error) {
            console.error('加载购物车失败:', error);
        } finally {
            setLoading(false);
        }
    }, [session?.user?.id]);

    // 当用户登录状态变化时，重新加载购物车
    useEffect(() => {
        loadCart();
    }, [loadCart]);

    const addToCart = useCallback(async (item: Omit<CartItem, 'id' | 'createdAt' | 'updatedAt'>) => {
        if (!session?.user?.id) {
            throw new Error('用户未登录');
        }

        try {
            const res = await cartService.addToCart({
                coachId: item.coachId,
                coachName: item.coachName,
                productId: item.productId,
                productName: item.productName,
                productTier: item.productTier,
                durationMonths: item.durationMonths,
                price: item.price,
            });

            if (res?.item) {
                // 重新加载购物车以获取最新数据
                await loadCart();
            }
        } catch (error) {
            console.error('添加购物车失败:', error);
            throw error;
        }
    }, [session?.user?.id, loadCart]);

    const removeFromCart = useCallback(async (itemId: string) => {
        if (!session?.user?.id) {
            throw new Error('用户未登录');
        }

        try {
            await cartService.removeFromCart({ itemId });
            // 重新加载购物车
            await loadCart();
        } catch (error) {
            console.error('删除购物车项失败:', error);
            throw error;
        }
    }, [session?.user?.id, loadCart]);

    const clearCart = useCallback(async () => {
        if (!session?.user?.id) {
            throw new Error('用户未登录');
        }

        try {
            await cartService.clearCart();
            setItems([]);
        } catch (error) {
            console.error('清空购物车失败:', error);
            throw error;
        }
    }, [session?.user?.id]);

    const getTotalPrice = useCallback(() => {
        return items.reduce((sum, item) => sum + item.price, 0);
    }, [items]);

    const getItemCount = useCallback(() => {
        return items.length;
    }, [items]);

    const refreshCart = useCallback(async () => {
        await loadCart();
    }, [loadCart]);

    return (
        <CartContext.Provider value={{
            items,
            addToCart,
            removeFromCart,
            clearCart,
            getTotalPrice,
            getItemCount,
            loading,
            refreshCart,
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
