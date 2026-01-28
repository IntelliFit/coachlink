'use client';

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { WalletData } from '@/app/api/coach/wallet/route';
import { ArrowUpRight, ArrowDownLeft, Wallet } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';

export default function CoachWalletPage() {
    const [data, setData] = useState<WalletData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchWallet = async () => {
            try {
                const res = await axios.post('/api/coach/wallet');
                if (res.data && res.data.success) {
                    setData(res.data.data);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchWallet();
    }, []);

    if (loading) {
        return <div className="flex justify-center items-center h-96"><i className="pi pi-spin pi-spinner text-4xl text-primary-500"></i></div>;
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            <h1 className="text-2xl font-bold mb-4 text-surface-900">我的钱包</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-green-500 to-emerald-700 text-white border-none shadow-lg col-span-1 md:col-span-2 rounded-xl p-6">
                    <div className="pb-2">
                        <p className="text-green-100 flex items-center gap-2 mb-2">
                            <Wallet className="w-4 h-4" /> 可提现余额
                        </p>
                        <h2 className="text-4xl font-mono font-bold">¥ {data?.balance?.toFixed(2) || '0.00'}</h2>
                    </div>
                    <div className="mt-6 flex justify-between items-end">
                        <div className="space-y-1">
                            <p className="text-xs text-green-100">冻结金额: ¥ {data?.frozen_amount.toFixed(2)}</p>
                            <p className="text-sm font-semibold text-green-50">累计总收入: ¥ {data?.total_income.toFixed(2)}</p>
                        </div>
                        <Button label="申请提现" className="bg-white text-green-700 hover:bg-green-50 border-none" />
                    </div>
                </div>

            </div>

            <div className="bg-surface-0 border border-surface-200 rounded-xl p-6 shadow-sm">
                <div className="mb-4">
                    <h3 className="text-lg font-bold text-surface-900">收支明细</h3>
                </div>
                <div className="space-y-4">
                    {data?.transactions && data.transactions.length > 0 ? (
                        data.transactions.map((tx) => (
                            <div key={tx.id} className="flex items-center justify-between py-3 border-b border-surface-100 last:border-0">
                                <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-full ${tx.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                                        {tx.type === 'income' ? <ArrowDownLeft className={`w-4 h-4 ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`} /> : <ArrowUpRight className="w-4 h-4 text-red-600" />}
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm text-surface-900">{tx.description || (tx.type === 'income' ? '课程收入' : '提现')}</p>
                                        <p className="text-xs text-surface-500">{format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm')}</p>
                                    </div>
                                </div>
                                <div className={`font-mono font-medium ${tx.type === 'income' ? 'text-green-600' : 'text-surface-900'}`}>
                                    {tx.type === 'income' ? '+' : '-'}{tx.amount.toFixed(2)}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 text-surface-500">暂无交易记录</div>
                    )}
                </div>
            </div>
        </div>
    );
}
