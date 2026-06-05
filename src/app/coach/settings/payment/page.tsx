'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';

export default function CoachPaymentSettingsPage() {
    const router = useRouter();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <Message
                severity="info"
                text="个人收款码已停用。学员给教练的订阅付款统一走汇付平台通道，不再支持微信、支付宝个人收款码。"
                className="w-full"
            />
            <div className="rounded-[24px] border border-surface-100 bg-surface p-8">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
                        <i className="pi pi-wallet text-xl" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-black text-surface-900 tracking-tight">
                            使用汇付收款账户
                        </h2>
                        <p className="mt-2 text-sm text-surface-500 leading-relaxed">
                            教练需要完成汇付开户和银行卡绑定后，才能设置套餐并让学员完成平台支付。
                        </p>
                        <Button
                            label="去开通/查看收款账户"
                            icon="pi pi-arrow-right"
                            className="mt-6 rounded-2xl"
                            onClick={() => router.push('/dashboard/wallet/merchant')}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
