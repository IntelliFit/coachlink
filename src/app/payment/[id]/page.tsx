'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { Toast } from 'primereact/toast';
import { useRef } from 'react';
import { alipayService } from '@/app/service/alipayService';

const PaymentPage = () => {
    const router = useRouter();
    const params = useParams();
    const toast = useRef(null);
    const { data: session } = useSession();
    
    const [loading, setLoading] = useState(true);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [paymentId, setPaymentId] = useState('');
    const [amount, setAmount] = useState(0);
    const [orderId, setOrderId] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<'pending' | 'success' | 'failed'>('pending');

    // 从路由参数中获取支付ID
    useEffect(() => {
        const id = params.id;
        if (!id || Array.isArray(id)) {
            toast.current?.show({
                severity: 'error',
                summary: '错误',
                detail: '无效的支付ID',
                life: 3000
            });
            router.back();
            return;
        }
        
        setPaymentId(id);
        // 获取支付订单详情
        fetchPaymentDetails(id);
    }, [params]);

    const fetchPaymentDetails = async (id: string) => {
        try {
            setLoading(true);
            
            // 调用支付服务获取支付订单详情
            const response = await alipayService.queryOrder({
                // backward compat: API accepts paymentId too, but type wants orderId
                orderId: id as any
            } as any);
            
            if (response) {
                const order = (response as any).order || response;
                setQrCodeUrl(order.qr_code || '');
                setAmount(Number(order.total_amount || 0));
                setOrderId(order.id || '');
                setDescription(order.subject || '');

                const ts = order.trade_status;
                if (order.status === 'paid' || ts === 'TRADE_SUCCESS' || ts === 'TRADE_FINISHED') {
                    setStatus('success');
                } else if (order.status === 'cancelled' || ts === 'TRADE_CLOSED') {
                    setStatus('failed');
                } else {
                    setStatus('pending');
                }
            } else {
                throw new Error('获取支付订单详情失败');
            }
        } catch (error) {
            console.error('获取支付订单详情失败:', error);
            toast.current?.show({
                severity: 'error',
                summary: '错误',
                detail: '获取支付订单详情失败',
                life: 3000
            });
            router.back();
        } finally {
            setLoading(false);
        }
    };

    // 定期检查支付状态
    useEffect(() => {
        if (!paymentId || status !== 'pending') return;
        
        const interval = setInterval(() => {
            fetchPaymentDetails(paymentId);
        }, 5000); // 每5秒检查一次支付状态
        
        return () => clearInterval(interval);
    }, [paymentId, status]);

    // 骨架屏组件
    const LoadingSkeleton = () => (
        <div className="max-w-md mx-auto p-6">
            <div className="text-center mb-8">
                <Skeleton width="60%" height="2rem" className="mb-4 mx-auto" />
                <Skeleton width="100%" height="1.5rem" className="mb-2" />
                <Skeleton width="80%" height="1.5rem" className="mx-auto" />
            </div>
            
            <div className="flex justify-center mb-8">
                <Skeleton width="200px" height="200px" borderRadius="12px" />
            </div>
            
            <div className="text-center mb-6">
                <Skeleton width="50%" height="2rem" className="mx-auto mb-4" />
                <Skeleton width="100%" height="3rem" borderRadius="6px" />
            </div>
            
            <div className="flex justify-center">
                <Skeleton width="100px" height="2.5rem" borderRadius="6px" />
            </div>
        </div>
    );

    // 处理支付完成
    const handlePaymentComplete = () => {
        router.push('/coach/subscription');
        toast.current?.show({
            severity: 'success',
            summary: '支付成功',
            detail: '支付已完成，正在跳转...',
            life: 3000
        });
    };

    if (loading) {
        return <LoadingSkeleton />;
    }

    return (
        <div className="max-w-md mx-auto p-6">
            <Toast ref={toast} />
            
            <div className="text-center mb-8">
                <h1 className="text-2xl font-bold mb-2">扫码支付</h1>
                <p className="text-gray-600 dark:text-gray-400">
                    订单金额: ¥{amount.toFixed(2)}
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                    订单号: {orderId}
                </p>
                {description && (
                    <p className="text-gray-600 dark:text-gray-400">
                        描述: {description}
                    </p>
                )}
                <div className="mt-2">
                    {status === 'pending' && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                            <span className="animate-pulse w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                            等待支付
                        </span>
                    )}
                    {status === 'success' && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                            支付成功
                        </span>
                    )}
                    {status === 'failed' && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                            <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                            支付失败
                        </span>
                    )}
                </div>
            </div>
            
            {status === 'pending' && qrCodeUrl ? (
                <div className="flex justify-center mb-8">
                    <img 
                        src={qrCodeUrl} 
                        alt="支付二维码" 
                        className="border rounded-xl p-4 shadow-md"
                        width={200}
                        height={200}
                    />
                </div>
            ) : status === 'pending' && !qrCodeUrl ? (
                <div className="text-center text-red-500 mb-8">
                    无法生成支付二维码，请稍后重试
                </div>
            ) : null}
            
            {status === 'success' && (
                <div className="text-center mb-8">
                    <div className="text-green-500 text-5xl mb-4">✓</div>
                    <p className="font-medium">支付成功！</p>
                </div>
            )}
            
            {status === 'failed' && (
                <div className="text-center text-red-500 mb-8">
                    <div className="text-red-500 text-5xl mb-4">✗</div>
                    <p className="font-medium">支付失败，请重试</p>
                </div>
            )}
            
            <div className="text-center mb-6">
                {status === 'pending' && (
                    <>
                        <p className="font-medium mb-4">请使用微信或支付宝扫描上方二维码完成支付</p>
                        <Button 
                            label="已完成支付" 
                            icon="pi pi-check"
                            className="w-full py-3"
                            onClick={() => fetchPaymentDetails(paymentId)}
                        />
                    </>
                )}
                
                {status === 'success' && (
                    <Button 
                        label="继续" 
                        icon="pi pi-arrow-right"
                        className="w-full py-3"
                        onClick={handlePaymentComplete}
                    />
                )}
                
                {status === 'failed' && (
                    <Button 
                        label="重新支付" 
                        icon="pi pi-refresh"
                        className="w-full py-3 p-button-danger"
                        onClick={() => router.push('/coach/subscription')}
                    />
                )}
            </div>
            
            <div className="text-center">
                <Button 
                    label="返回上一页" 
                    icon="pi pi-arrow-left"
                    className="p-button-text"
                    onClick={() => router.back()}
                />
            </div>
        </div>
    );
};

export default PaymentPage;