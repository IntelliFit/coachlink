'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { Toast } from 'primereact/toast';
import { useRef } from 'react';
import paymentService from '@/app/service/paymentService';

const PaymentPage = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const toast = useRef(null);
    const { data: session } = useSession();
    
    const [loading, setLoading] = useState(true);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [paymentId, setPaymentId] = useState('');
    const [amount, setAmount] = useState(0);
    const [orderId, setOrderId] = useState('');

    // 从查询参数中获取支付信息
    useEffect(() => {
        const amountParam = searchParams.get('amount');
        const orderIdParam = searchParams.get('orderId');
        const descriptionParam = searchParams.get('description') || '教练服务订阅';
        
        if (!amountParam || !orderIdParam) {
            toast.current?.show({
                severity: 'error',
                summary: '错误',
                detail: '缺少必要参数',
                life: 3000
            });
            router.back();
            return;
        }
        
        setAmount(parseFloat(amountParam));
        setOrderId(orderIdParam);
        
        // 创建支付订单
        createPaymentOrder(parseFloat(amountParam), orderIdParam, descriptionParam);
    }, [searchParams]);

    const createPaymentOrder = async (amount: number, orderId: string, description: string) => {
        try {
            setLoading(true);
            
            // 调用支付服务创建支付订单
            const response = await paymentService.createPayment({
                amount,
                currency: 'CNY',
                orderId,
                description,
                returnUrl: `${window.location.origin}/coach/subscription`,
                cancelUrl: `${window.location.origin}/coach/subscription`
            });
            
            if (response) {
                setQrCodeUrl(response.qrCodeUrl || '');
                setPaymentId(response.paymentId);
            } else {
                throw new Error('创建支付订单失败');
            }
        } catch (error) {
            console.error('创建支付订单失败:', error);
            toast.current?.show({
                severity: 'error',
                summary: '错误',
                detail: '创建支付订单失败',
                life: 3000
            });
            router.back();
        } finally {
            setLoading(false);
        }
    };

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
            </div>
            
            {qrCodeUrl ? (
                <div className="flex justify-center mb-8">
                    <img 
                        src={qrCodeUrl} 
                        alt="支付二维码" 
                        className="border rounded-xl p-4 shadow-md"
                        width={200}
                        height={200}
                    />
                </div>
            ) : (
                <div className="text-center text-red-500 mb-8">
                    无法生成支付二维码，请稍后重试
                </div>
            )}
            
            <div className="text-center mb-6">
                <p className="font-medium mb-4">请使用微信或支付宝扫描上方二维码完成支付</p>
                <Button 
                    label="已完成支付" 
                    icon="pi pi-check"
                    className="w-full py-3"
                    onClick={() => router.push('/coach/subscription')}
                />
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