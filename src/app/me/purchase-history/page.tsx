'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useToastContext } from '@/context/ToastContext';
import { Card } from 'primereact/card';
import { Skeleton } from 'primereact/skeleton';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Receipt, CheckCircle, Clock, XCircle, Package, User } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PurchaseHistoryItem {
    id: string | number;
    orderType: 'subscription' | 'student_membership' | 'other';
    subject: string;
    amount: number;
    status: 'pending' | 'paid' | 'failed' | 'closed' | 'refunded';
    createdAt: string;
    paidAt?: string;
    coachId?: string;
    coachName?: string;
    subscriptionId?: string;
    productKey?: string;
}

export default function PurchaseHistoryPage() {
    const { data: session } = useSession();
    const { showToast } = useToastContext();
    const router = useRouter();
    const [orders, setOrders] = useState<PurchaseHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 20;

    const loadOrders = async () => {
        if (!session?.user?.id) return;
        
        setLoading(true);
        try {
            const res = await fetch(`/api/purchase-history/list?page=${page}&limit=${limit}`);
            const data = await res.json();
            
            if (data.success && data.data) {
                setOrders(data.data.orders);
                setTotal(data.data.total);
            } else {
                showToast({ severity: 'error', summary: '加载失败', detail: data.message || '无法加载购买记录' });
            }
        } catch (error: any) {
            showToast({ severity: 'error', summary: '加载失败', detail: error.message || '网络错误' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOrders();
    }, [session?.user?.id, page]);

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'paid':
                return { label: '已支付', color: 'green', icon: CheckCircle };
            case 'pending':
                return { label: '待支付', color: 'yellow', icon: Clock };
            case 'failed':
            case 'closed':
                return { label: '已关闭', color: 'red', icon: XCircle };
            case 'refunded':
                return { label: '已退款', color: 'orange', icon: XCircle };
            default:
                return { label: status, color: 'gray', icon: Clock };
        }
    };

    const getOrderTypeLabel = (orderType: string) => {
        switch (orderType) {
            case 'subscription':
                return '教练订阅';
            case 'student_membership':
                return '会员服务';
            default:
                return '其他';
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="min-h-screen py-10 px-4 bg-surface-50">
            <div className="container mx-auto max-w-4xl">
                {/* 页面标题 */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-primary-50 text-primary-600 rounded-2xl">
                        <Receipt size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-surface-900 tracking-tight">购买记录</h1>
                        <p className="text-sm text-surface-500 font-medium">查看您的所有支付记录</p>
                    </div>
                </div>

                {/* 订单列表 */}
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <Card key={i} className="border border-surface-100 rounded-2xl shadow-sm">
                                <Skeleton width="100%" height="120px" />
                            </Card>
                        ))}
                    </div>
                ) : orders.length === 0 ? (
                    <Card className="border border-surface-100 rounded-2xl shadow-sm">
                        <div className="py-20 text-center">
                            <Package className="w-16 h-16 text-surface-200 mx-auto mb-4" />
                            <h3 className="text-xl font-black text-surface-900 tracking-tight mb-2">暂无购买记录</h3>
                            <p className="text-surface-500">您还没有任何支付记录</p>
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {orders.map((order) => {
                            const statusConfig = getStatusConfig(order.status);
                            const StatusIcon = statusConfig.icon;
                            
                            return (
                                <Card 
                                    key={order.id} 
                                    className="border border-surface-100 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-3 flex-wrap">
                                                <h3 className="text-lg font-black text-surface-900 tracking-tight">{order.subject}</h3>
                                                <Tag
                                                    value={getOrderTypeLabel(order.orderType)}
                                                    severity="info"
                                                    className="text-xs rounded-xl"
                                                />
                                                <Tag
                                                    value={statusConfig.label}
                                                    severity={statusConfig.color as any}
                                                    icon={<StatusIcon size={12} />}
                                                    className="text-xs rounded-xl"
                                                />
                                            </div>
                                            
                                            <div className="flex flex-wrap items-center gap-4 text-sm text-surface-600">
                                                <div className="flex items-center gap-1">
                                                    <span className="font-semibold text-surface-700">金额：</span>
                                                    <span className="text-primary-600 font-black text-lg">¥{order.amount.toFixed(2)}</span>
                                                </div>
                                                
                                                {order.coachName && (
                                                    <div className="flex items-center gap-1">
                                                        <User size={14} className="text-surface-400" />
                                                        <span>教练：{order.coachName}</span>
                                                    </div>
                                                )}
                                                
                                                <div className="flex items-center gap-1">
                                                    <span>下单时间：{formatDate(order.createdAt)}</span>
                                                </div>
                                                
                                                {order.paidAt && (
                                                    <div className="flex items-center gap-1">
                                                        <span>支付时间：{formatDate(order.paidAt)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {order.status === 'paid' && order.coachId && (
                                            <Button
                                                label="查看教练"
                                                icon="pi pi-user"
                                                outlined
                                                onClick={() => router.push(`/coach/profile/${order.coachId}`)}
                                                className="rounded-2xl"
                                            />
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* 分页 */}
                {!loading && total > limit && (
                    <div className="mt-8 flex justify-center items-center gap-3">
                        <Button
                            label="上一页"
                            icon="pi pi-chevron-left"
                            outlined
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="rounded-2xl"
                        />
                        <span className="text-sm text-surface-600 font-medium">
                            第 {page} 页，共 {Math.ceil(total / limit)} 页
                        </span>
                        <Button
                            label="下一页"
                            icon="pi pi-chevron-right"
                            iconPos="right"
                            outlined
                            onClick={() => setPage(p => p + 1)}
                            disabled={page >= Math.ceil(total / limit)}
                            className="rounded-2xl"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
