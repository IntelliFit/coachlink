'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCart } from '@/context/CartContext';
import { useToastContext } from '@/context/ToastContext';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Skeleton } from 'primereact/skeleton';
import { ShoppingCart, Package, User, Calendar, Trash2 } from 'lucide-react';

export default function CartPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const { items, removeFromCart, clearCart, getTotalPrice, loading } = useCart();
    const { showToast } = useToastContext();
    const [processing, setProcessing] = useState<string | null>(null);
    const [subscribing, setSubscribing] = useState(false);

    const handleRemoveItem = async (itemId: string) => {
        try {
            await removeFromCart(itemId);
            showToast({ severity: 'success', summary: '已移除', detail: '商品已从购物车移除' });
        } catch (error: any) {
            showToast({ severity: 'error', summary: '移除失败', detail: error.message || '请稍后重试' });
        }
    };

    const handleClearCart = async () => {
        try {
            await clearCart();
            showToast({ severity: 'info', summary: '已清空', detail: '购物车已清空' });
        } catch (error: any) {
            showToast({ severity: 'error', summary: '清空失败', detail: error.message || '请稍后重试' });
        }
    };

    const handleSubscribe = async (item: typeof items[0]) => {
        if (!session?.user?.id) {
            showToast({ severity: 'warn', summary: '请先登录', detail: '需要登录后才能订阅' });
            router.push(`/login?redirect=${encodeURIComponent('/me/cart')}`);
            return;
        }

        setProcessing(item.id);
        setSubscribing(true);

        try {
            // 统一订阅入口：由“教练主页订阅区”统一处理（问卷→创建订阅→支付），避免购物车页重复写逻辑导致不一致
            const params = new URLSearchParams();
            params.set('tab', '1'); // 订阅价格现在在第二栏（index 1）
            params.set('from', 'cart');
            params.set('autoSubscribe', '1');
            params.set('productId', item.productId);
            params.set('months', String(item.durationMonths));
            router.push(`/coach/profile/${item.coachId}?${params.toString()}#choose-pricing`);
            showToast({ severity: 'info', summary: '正在跳转', detail: '将为你打开订阅流程（问卷/支付）' });
        } catch (error: any) {
            console.error('订阅失败:', error);
            showToast({ severity: 'error', summary: '订阅失败', detail: error.message || '请稍后重试' });
        } finally {
            setProcessing(null);
            setSubscribing(false);
        }
    };

    const handleSubscribeAll = async () => {
        if (!session?.user?.id) {
            showToast({ severity: 'warn', summary: '请先登录', detail: '需要登录后才能订阅' });
            router.push(`/login?redirect=${encodeURIComponent('/me/cart')}`);
            return;
        }

        if (items.length === 0) return;

        // 批量订阅会涉及多个教练/多次问卷/多次支付，先不做“自动批量”避免误触与流程混乱
        showToast({
            severity: 'info',
            summary: '暂不支持批量订阅',
            detail: '请逐个点击“立即订阅”，系统会自动进入对应教练的问卷/支付流程',
        });
    };

    const getTierLabel = (tier: string) => {
        switch (tier) {
            case 'basic':
                return '特惠基础版';
            case 'standard':
                return '专业指导版';
            case 'vip':
                return '全能指导版';
            default:
                return tier;
        }
    };

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'basic':
                return 'blue';
            case 'standard':
                return 'green';
            case 'vip':
                return 'purple';
            default:
                return 'gray';
        }
    };

    // 骨架屏
    if (loading) {
        return (
            <div className="min-h-screen py-10 px-4">
                <div className="container mx-auto max-w-4xl">
                    <div className="flex items-center gap-3 mb-8">
                        <Skeleton shape="circle" size="3rem" />
                        <div className="flex-1">
                            <Skeleton width="200px" height="2rem" className="mb-2" />
                            <Skeleton width="150px" height="1rem" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <Card key={i} className="border-none shadow-sm">
                                <Skeleton width="100%" height="120px" />
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen py-10 px-4 bg-surface-50">
            <div className="container mx-auto max-w-4xl">
                {/* 页面标题 */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-primary-50 text-primary-600 rounded-2xl">
                            <ShoppingCart size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-surface-900 tracking-tight">购物车</h1>
                            <p className="text-sm text-surface-500 font-medium">
                                {items.length > 0 ? `共 ${items.length} 件商品` : '购物车是空的'}
                            </p>
                        </div>
                    </div>
                    {items.length > 0 && (
                        <Button
                            label="清空"
                            icon="pi pi-trash"
                            outlined
                            severity="danger"
                            size="small"
                            onClick={handleClearCart}
                            className="rounded-2xl"
                        />
                    )}
                </div>

                {/* 购物车内容 */}
                {items.length === 0 ? (
                    <Card className="border border-surface-100 rounded-2xl shadow-sm">
                        <div className="py-20 text-center">
                            <Package className="w-16 h-16 text-surface-200 mx-auto mb-4" />
                            <h3 className="text-xl font-black text-surface-900 tracking-tight mb-2">购物车是空的</h3>
                            <p className="text-surface-500 mb-6">快去发现，添加服务到购物车吧</p>
                            <Button
                                label="去发现"
                                icon="pi pi-search"
                                onClick={() => router.push('/coach/discovery')}
                                className="rounded-2xl"
                            />
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {items.map((item) => (
                            <Card 
                                key={item.id} 
                                className="border border-surface-100 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300"
                            >
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-start gap-3 mb-3">
                                            <h3 className="text-lg font-black text-surface-900 tracking-tight">{item.productName}</h3>
                                            <Tag
                                                value={getTierLabel(item.productTier)}
                                                severity={getTierColor(item.productTier) as any}
                                                className="text-xs rounded-xl"
                                            />
                                        </div>
                                        
                                        <div className="space-y-2 text-sm text-surface-600">
                                            <div className="flex items-center gap-2">
                                                <User size={14} className="text-surface-400" />
                                                <span>教练：{item.coachName}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-surface-400" />
                                                <span>时长：{item.durationMonths} 个月</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-surface-700">价格：</span>
                                                <span className="text-primary-600 font-black text-lg">¥{item.price.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                        <Button
                                            label="立即订阅"
                                            icon="pi pi-check"
                                            loading={processing === item.id && subscribing}
                                            disabled={subscribing && processing !== item.id}
                                            onClick={() => handleSubscribe(item)}
                                            className="flex-1 rounded-2xl order-2 sm:order-1"
                                        />
                                        <Button
                                            icon="pi pi-trash"
                                            severity="danger"
                                            outlined
                                            onClick={() => handleRemoveItem(item.id)}
                                            disabled={subscribing}
                                            className="rounded-2xl w-full sm:w-12 sm:h-12 sm:flex-shrink-0 order-1 sm:order-2"
                                            tooltip="删除"
                                            tooltipOptions={{ position: 'top' }}
                                        />
                                    </div>
                                </div>
                            </Card>
                        ))}

                        {/* 总计和结算 */}
                        <Card className="border border-surface-100 rounded-2xl shadow-sm bg-surface">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6">
                                <div>
                                    <p className="text-sm text-surface-500 mb-1">共 {items.length} 件商品</p>
                                    <p className="text-2xl font-black text-primary-600 tracking-tight">
                                        总计：¥{getTotalPrice().toFixed(2)}
                                    </p>
                                </div>
                                <Button
                                    label="全部订阅"
                                    icon="pi pi-shopping-cart"
                                    loading={subscribing}
                                    disabled={subscribing}
                                    onClick={handleSubscribeAll}
                                    className="px-6 rounded-2xl"
                                />
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
