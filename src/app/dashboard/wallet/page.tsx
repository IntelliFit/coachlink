'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from 'primereact/button';
import { WalletData } from '@/app/api/coach/wallet/route';
import { ArrowUpRight, ArrowDownLeft, Wallet } from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

export default function CoachWalletPage() {
    const [data, setData] = useState<WalletData | null>(null);
    const [loading, setLoading] = useState(true);
    const [boundAccount, setBoundAccount] = useState<any>(null);
    const [showWithdraw, setShowWithdraw] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState<string>('');
    const [processingWithdraw, setProcessingWithdraw] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const fetchWallet = async () => {
            try {
                const res = await axios.post('/api/coach/wallet');
                if (res.data && res.data.success) {
                    setData(res.data.data);
                }
                // fetch bound alipay account (best-effort)
                try {
                    const acc = await axios.get('/api/coach/wallet/alipay/bind');
                    if (acc.data && acc.data.success) setBoundAccount(acc.data.data);
                } catch (e) {
                    // ignore
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
                        <div className="flex items-center gap-3">
                            {boundAccount ? (
                                    <div className="flex items-center gap-2 text-xs text-white/90">
                                        <span>已绑定: {boundAccount.payee_account_masked}</span>
                                        <Link href="/dashboard/wallet/bind" className="underline text-white/90 hover:text-white">重新绑定</Link>
                                    </div>
                            ) : (
                                <Link href="/dashboard/wallet/bind" className="text-xs text-white underline">绑定支付宝</Link>
                            )}
                            <Button onClick={() => setShowWithdraw(true)} label="申请提现" className="bg-white text-green-700 hover:bg-green-50 border-none" />
                        </div>
                    </div>
                </div>

            </div>

            <div className="bg-surface-0 border border-surface-200 rounded-xl p-6 shadow-sm">
                <div className="mb-4">
                    <h3 className="text-lg font-bold text-surface-900">收支明细</h3>
                </div>
                <div className="space-y-4">
                    {showWithdraw ? (
                        <div className="bg-surface-0 border border-surface-200 rounded-xl p-6">
                            <h4 className="font-medium text-red-600 ">当前提现功能开发中，请等待后续更新</h4>
                            {/*
                            <div className="mb-3 text-sm text-surface-700">可提现余额: ¥ {data?.balance?.toFixed(2) || '0.00'}</div>
                            <div className="flex flex-col md:flex-row md:items-center md:gap-4">
                                <input
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    placeholder="输入提现金额（元）"
                                    className="w-64 px-3 py-2 rounded border border-surface-200 bg-surface-50 text-surface-900 dark:bg-surface-800 dark:text-white mb-3 md:mb-0"
                                />
                                <div className="flex items-center gap-3">
                                    <Button
                                        disabled={processingWithdraw}
                                        onClick={async () => {
                                            setMessage(null);
                                            const amt = Number(withdrawAmount);
                                            if (!amt || amt <= 0) { setMessage('请输入合法金额'); return; }
                                            if (!data || amt > data.balance) { setMessage('余额不足'); return; }
                                            setProcessingWithdraw(true);
                                            try {
                                                const res = await axios.post('/api/coach/wallet/alipay/withdraw', { amount: amt });
                                                if (res.data && res.data.success) {
                                                    setMessage('提现已发起');
                                                    setShowWithdraw(false);
                                                    setWithdrawAmount('');
                                                    const w = await axios.post('/api/coach/wallet');
                                                    if (w.data && w.data.success) setData(w.data.data);
                                                } else {
                                                    setMessage(res.data?.message || '提现失败');
                                                }
                                            } catch (err: any) {
                                                console.error(err);
                                                setMessage(err?.response?.data?.message || String(err));
                                            } finally { setProcessingWithdraw(false); }
                                        }}
                                        label="确认提现"
                                        className="bg-primary-600 text-white px-4 py-2"
                                    />
                                    <Button onClick={() => { setShowWithdraw(false); setMessage(null); }} label="取消" className="bg-transparent border border-surface-200 px-4 py-2 text-surface-900" />
                                </div>
                            </div>
                            {message ? <div className="text-sm text-red-600 mt-3">{message}</div> : null}
                            */}
                        </div>
                    ) : null}
                    {data?.transactions && data.transactions.length > 0 ? (
                        data.transactions.map((tx) => {
                            const isSubscriptionIncome = tx.type === 'income' && (tx.order_type === 'subscription' || tx.order_type === 'subscription_renew') && Boolean(tx.student_id);
                            const fallbackTitle = tx.description || (tx.type === 'income' ? '课程收入' : tx.type === 'withdrawal' ? '提现' : '退款');
                            const primaryContent = isSubscriptionIncome && tx.student_id ? (
                                // TODO: 由于学生详情页尚未完成，暂时注释掉链接
                                // <>
                                //     来自{' '}
                                //     <Link href={`/dashboard/students/${tx.student_id}`} className="text-primary-600 hover:underline">
                                //         {tx.student_name || '学员'}
                                //     </Link>
                                //     的订阅
                                // </>
                                 <>
                                    来自
                                        {tx.student_name || '学员'}
                                    的订阅
                                </>
                            ) : fallbackTitle;
                            const secondaryContent = isSubscriptionIncome && tx.subject ? tx.subject : null;

                            return (
                                <div key={tx.id} className="flex items-center justify-between py-3 border-b border-surface-100 last:border-0">
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-full ${tx.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                                            {tx.type === 'income' ? <ArrowDownLeft className={`w-4 h-4 ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`} /> : <ArrowUpRight className="w-4 h-4 text-red-600" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm text-surface-900">{primaryContent}</p>
                                            {secondaryContent ? (
                                                <p className="text-xs text-surface-500">{secondaryContent}</p>
                                            ) : null}
                                            <p className="text-xs text-surface-500">{format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm')}</p>
                                        </div>
                                    </div>
                                    <div className={`font-mono font-medium ${tx.type === 'income' ? 'text-green-600' : 'text-surface-900'}`}>
                                        {tx.type === 'income' ? '+' : '-'}{tx.amount.toFixed(2)}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-10 text-surface-500">暂无交易记录</div>
                    )}
                </div>
            </div>
        </div>
    );
}
