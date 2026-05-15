'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type StartState = 'creating' | 'redirecting' | 'failed';

export default function PaymentStartPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const startedRef = useRef(false);
    const [state, setState] = useState<StartState>('creating');
    const [message, setMessage] = useState('正在创建支付订单...');

    const params = useMemo(() => {
        const subscriptionId = searchParams.get('subscriptionId') || '';
        const subscriptionOrderId = searchParams.get('subscriptionOrderId') || '';
        const coachId = searchParams.get('coachId') || '';
        const amount = Number(searchParams.get('amount') || 0);
        const subject = searchParams.get('subject') || '';
        const renew = searchParams.get('renew') === 'true';
        const renewAdditionalWeeks = Number(searchParams.get('renewAdditionalWeeks') || 0);
        const redirect = searchParams.get('redirect') || '';
        return {
            subscriptionId,
            subscriptionOrderId,
            coachId,
            amount,
            subject,
            renew,
            renewAdditionalWeeks,
            redirect,
        };
    }, [searchParams]);

    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;

        const startPayment = async () => {
            if ((!params.subscriptionId && !params.subscriptionOrderId) || !params.coachId) {
                setState('failed');
                setMessage('支付参数不完整，请返回重新发起支付。');
                return;
            }

            try {
                const response = await fetch('/api/payment/alipay/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        subject: params.subject || (params.renew ? '教练订阅续费' : '订阅教练'),
                        totalAmount: params.amount,
                        orderType: params.renew ? 'subscription_renew' : 'subscription',
                        orderData: {
                            subscriptionId: params.subscriptionId || undefined,
                            subscriptionOrderId: params.subscriptionOrderId || undefined,
                            coachId: params.coachId,
                            renewAdditionalWeeks: params.renew ? params.renewAdditionalWeeks : undefined,
                            redirect: params.redirect || undefined,
                        },
                        returnUrlOnly: true,
                        isMobile: true,
                    }),
                });
                const result = await response.json();

                if (!response.ok || !result?.success || !result?.data) {
                    throw new Error(result?.message || '创建支付订单失败');
                }

                const orderId = result.data.order?.id;
                const paymentUrl = result.data.paymentInfo?.paymentUrl;
                if (paymentUrl) {
                    setState('redirecting');
                    setMessage('订单已创建，正在跳转到支付页面...');
                    window.location.replace(paymentUrl);
                    return;
                }

                if (orderId) {
                    const redirectQuery = params.redirect
                        ? `?redirect=${encodeURIComponent(params.redirect)}`
                        : '';
                    router.replace(`/payment/${orderId}${redirectQuery}`);
                    return;
                }

                throw new Error('支付订单缺少跳转信息');
            } catch (error) {
                setState('failed');
                setMessage(error instanceof Error ? error.message : '创建支付订单失败');
            }
        };

        void startPayment();
    }, [params, router]);

    return (
        <main className="min-h-screen bg-[#F7F4F2] px-6 py-12 text-[#1F2933]">
            <section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#CF6D4E] text-white">
                    {state === 'failed' ? '!' : '...'}
                </div>
                <h1 className="mb-3 text-2xl font-bold">支付处理中</h1>
                <p className="mb-8 text-sm leading-6 text-[#5B6472]">{message}</p>
                {state === 'failed' ? (
                    <button
                        type="button"
                        className="h-11 rounded-lg bg-[#CF6D4E] px-6 text-sm font-semibold text-white"
                        onClick={() => router.back()}
                    >
                        返回重试
                    </button>
                ) : (
                    <div className="h-2 w-36 overflow-hidden rounded-full bg-white">
                        <div className="h-full w-1/2 rounded-full bg-[#CF6D4E]" />
                    </div>
                )}
            </section>
        </main>
    );
}
