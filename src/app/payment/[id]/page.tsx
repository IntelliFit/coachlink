'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { alipayService } from '@/app/service/alipayService';

const PaymentPage = () => {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const toast = useRef<Toast>(null);

    const [loading, setLoading] = useState(true);
    const [paymentId, setPaymentId] = useState('');
    const [amount, setAmount] = useState(0);
    const [orderId, setOrderId] = useState('');
    const [status, setStatus] = useState<'pending' | 'success' | 'failed' | 'cancelled'>('pending');
    const [isMobile, setIsMobile] = useState(false);
    const [redirectTarget, setRedirectTarget] = useState<string>('');

    // 1. 设备环境检测
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // 2. 初始化与支付详情获取
    useEffect(() => {
        const id = params.id;
        if (!id || Array.isArray(id)) {
            toast.current?.show({ severity: 'error', summary: '错误', detail: '无效的支付ID' });
            router.back();
            return;
        }
        setPaymentId(id);
        fetchPaymentDetails(id);
    }, [params]);

    // 3. 轮询逻辑：每5秒自动同步状态
    useEffect(() => {
        if (!paymentId || status !== 'pending') return;
        const interval = setInterval(() => fetchPaymentDetails(paymentId, true), 5000);
        return () => clearInterval(interval);
    }, [paymentId, status]);

    const fetchPaymentDetails = async (id: string, isSilent = false) => {
        try {
            if (!isSilent) setLoading(true);
            const res = await alipayService.queryOrder({ orderId: id as any } as any);

            if (res) {
                const order = res.order;
                setAmount(Number(order.total_amount || 0));
                setOrderId(order.id || '');

                // Resolve redirect target: querystring has higher priority, then order_data.redirect
                const qpRedirect = searchParams?.get('redirect') || '';
                const odRedirect = (order as any)?.order_data?.redirect || '';
                const target = String(qpRedirect || odRedirect || '');
                if (target) setRedirectTarget(target);

                const ts = res.tradeStatus;
                if (order.status === 'paid' || ts === 'TRADE_SUCCESS' || ts === 'TRADE_FINISHED') {
                    setStatus('success');
                } else if (order.status === 'closed' || order.status === 'cancelled' || ts === 'TRADE_CLOSED') {
                    setStatus('cancelled'); // 用户取消支付
                } else if (order.status === 'failed' || order.status === 'refunded') {
                    setStatus('failed');
                }
            }
        } catch (error) {
            console.error('Fetch error:', error);
            if (!isSilent) {
                const msg = error instanceof Error ? error.message : '无法同步支付状态';
                const isCancelled = /取消|closed|TRADE_CLOSED/i.test(msg);
                toast.current?.show({
                    severity: isCancelled ? 'warn' : 'error',
                    summary: isCancelled ? '支付已取消' : '查询失败',
                    detail: isCancelled ? '您已取消支付' : msg,
                });
                if (isCancelled) setStatus('cancelled');
            }
        } finally {
            if (!isSilent) setLoading(false);
        }
    };

    const handlePaymentComplete = () => {
        const target = redirectTarget && redirectTarget.startsWith('/') ? redirectTarget : '';
        router.push(target || '/coach/subscription');
    };

    return (
        <div className="max-w-md mx-auto p-8 space-y-8 animate-in fade-in duration-700">
            <Toast ref={toast} />

            {/* 头部：数值中心化排版 (规范 2) */}
            <div className="text-center space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-surface-400">支付确认中</div>
                <div className="flex items-baseline justify-center gap-1 text-surface-900">
                    <span className="text-2xl font-bold">¥</span>
                    <span className="text-5xl font-black tracking-tighter">{amount.toFixed(2)}</span>
                </div>
                <p className="text-xs text-surface-400 font-medium pt-1">订单号: {orderId}</p>
            </div>

            {/* 核心状态显示区 */}
            <div className="relative">
                {status === 'pending' ? (
                    <div className="bg-surface-0 dark:bg-surface-900 rounded-3xl p-8 border border-surface-100/50 shadow-[0_8px_30px_rgba(0,0,0,0.02)] flex flex-col items-center text-center space-y-6">
                        {/* 动态呼吸图标 */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary-500/10 rounded-full animate-ping scale-75"></div>
                            <div className="relative w-16 h-16 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-2xl flex items-center justify-center">
                                <i className="pi pi-sync animate-spin text-2xl" style={{ animationDuration: '3s' }}></i>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <h2 className="text-lg font-bold tracking-tight text-surface-800">正在等待支付结果...</h2>
                            <p className="text-sm text-surface-500 px-4 leading-relaxed">
                                {isMobile ? "请在弹出的支付页面完成操作" : "请在您的手机设备上完成支付"}
                            </p>
                        </div>
                    </div>
                ) : (
                    /* 成功/失败/取消状态 */
                    <div className="py-8 text-center animate-in zoom-in-95 duration-500">
                        <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center border ${
                            status === 'success' ? 'bg-green-50 text-green-600 border-green-100' :
                            status === 'cancelled' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            'bg-red-50 text-red-600 border-red-100'
                        }`}>
                            <i className={`pi ${status === 'success' ? 'pi-check' : status === 'cancelled' ? 'pi-minus-circle' : 'pi-times'} text-3xl font-bold`}></i>
                        </div>
                        <h2 className="text-xl font-bold text-surface-900 tracking-tight">
                            {status === 'success' ? '支付已成功' : status === 'cancelled' ? '您已取消支付' : '支付未成功'}
                        </h2>
                    </div>
                )}
            </div>

            {/* 安全提示：规范 4 - 周期性动效引导 */}
            {status === 'pending' && (
                <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100/50 rounded-2xl p-5 flex items-start gap-4 transition-all">
                    <i className="pi pi-exclamation-circle text-amber-500 mt-0.5 animate-pulse text-lg"></i>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">安全提醒</p>
                        <p className="text-xs text-amber-600/80 leading-relaxed font-medium">
                            支付过程中 <span className="text-amber-700 underline underline-offset-4 decoration-2 decoration-amber-200">请勿关闭当前窗口</span> 或刷新页面，系统正在实时同步您的支付结果。
                        </p>
                    </div>
                </div>
            )}

            {/* 操作区 */}
            <div className="space-y-4 pt-4">
                {status === 'pending' && (
                    <Button 
                        label="我已完成支付" 
                        loading={loading}
                        className="w-full py-4 rounded-2xl font-bold tracking-tight bg-surface-900 border-none transition-transform active:scale-[0.98]"
                        onClick={() => fetchPaymentDetails(paymentId)}
                    />
                )}
                
                {status === 'success' && (
                    <Button 
                        label="继续" 
                        icon="pi pi-arrow-right"
                        className="w-full py-4 rounded-2xl font-bold bg-primary-600 border-none transition-transform active:scale-[0.98]"
                        onClick={handlePaymentComplete}
                    />
                )}

                {(status === 'failed' || status === 'cancelled') && (
                    <Button 
                        label={status === 'cancelled' ? '重新订阅' : '重新尝试'} 
                        icon="pi pi-refresh"
                        className={`w-full py-4 rounded-2xl font-bold border-none transition-transform active:scale-[0.98] ${
                            status === 'cancelled' ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        onClick={() => router.push('/coach/subscription')}
                    />
                )}

                <button 
                    className="w-full py-2 text-xs text-surface-400 font-bold uppercase tracking-widest hover:text-surface-600 transition-colors"
                    onClick={() => router.back()}
                >
                    <i className="pi pi-angle-left mr-1"></i>
                    返回
                </button>
            </div>
        </div>
    );
};

export default PaymentPage;