'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from 'primereact/button';
import { WalletData } from '@/app/api/coach/wallet/route';
import { ArrowUpRight, ArrowDownLeft, Wallet } from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

interface WithdrawalRecord {
    id: string;
    amount: number;
    fee: number;
    status: 'pending' | 'success' | 'failed' | 'cancelled';
    out_biz_no: string | null;
    alipay_order_id: string | null;
    created_at: string;
    processed_at: string | null;
}

export default function CoachWalletPage() {
    const [data, setData] = useState<WalletData | null>(null);
    const [loading, setLoading] = useState(true);
    const [boundAccount, setBoundAccount] = useState<any>(null);
    const [showWithdraw, setShowWithdraw] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState<string>('');
    const [processingWithdraw, setProcessingWithdraw] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
    const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const router = useRouter();

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

    const fetchWithdrawals = async () => {
        try {
            setLoadingWithdrawals(true);
            const res = await axios.get('/api/coach/wallet/alipay/withdraw');
            if (res.data && res.data.success) {
                setWithdrawals(res.data.data || []);
            }
        } catch (error) {
            console.error('加载提现记录失败:', error);
        } finally {
            setLoadingWithdrawals(false);
        }
    };

    useEffect(() => {
        fetchWallet();
        fetchWithdrawals();
    }, []);

    const handleCancelWithdrawal = async (withdrawalId: string) => {
        if (!confirm('确定要撤回这笔提现吗？撤回后余额将退回您的钱包。')) {
            return;
        }

        setCancellingId(withdrawalId);
        try {
            const res = await axios.post('/api/coach/wallet/alipay/withdraw/cancel', { id: withdrawalId });
            if (res.data && res.data.success) {
                setMessage('提现已撤回，余额已退回');
                await fetchWallet();
                await fetchWithdrawals();
            } else {
                setMessage(res.data?.message || '撤回失败');
            }
        } catch (err: any) {
            console.error(err);
            setMessage(err?.response?.data?.message || '撤回失败');
        } finally {
            setCancellingId(null);
        }
    };

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
                            <div className="mb-3 text-sm text-surface-700">可提现余额: ¥ {data?.balance?.toFixed(2) || '0.00'}</div>
                            <div className="mb-3 text-xs text-surface-500">提现后预计 48 小时内到账</div>
                            <div className="flex flex-col md:flex-row md:items-center md:gap-4">
                                <input
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    placeholder="输入提现金额（元）"
                                    className="w-64 px-3 py-2 rounded border border-surface-200 bg-surface-50 text-surface-900 dark:bg-surface-800 dark:text-white mb-3 md:mb-0"
                                    type="number"
                                    step="0.01"
                                    min="0.1"
                                />
                                <div className="flex items-center gap-3">
                                    <Button
                                        disabled={processingWithdraw}
                                        onClick={async () => {
                                            setMessage(null);
                                            const amt = Number(withdrawAmount);
                                            if (!amt || amt <= 0) { setMessage('请输入合法金额'); return; }
                                            if (amt < 0.1) { setMessage('单笔提现金额不能低于 0.10 元'); return; }
                                            if (!data || amt > data.balance) { setMessage('余额不足'); return; }
                                            setProcessingWithdraw(true);
                                            try {
                                                const res = await axios.post('/api/coach/wallet/alipay/withdraw', { amount: amt });
                                                if (res.data && res.data.success) {
                                                    setMessage('提现申请已提交，预计 48 小时内到账');
                                                    setShowWithdraw(false);
                                                    setWithdrawAmount('');
                                                    await fetchWallet();
                                                    await fetchWithdrawals();
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
                            {message ? <div className={`text-sm mt-3 ${message.includes('成功') || message.includes('提交') ? 'text-green-600' : 'text-red-600'}`}>{message}</div> : null}
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

            <div className="bg-surface-0 border border-surface-200 rounded-xl p-6 shadow-sm">
                <div className="mb-4">
                    <h3 className="text-lg font-bold text-surface-900">提现记录</h3>
                </div>
                {loadingWithdrawals ? (
                    <div className="text-center py-10 text-surface-500">加载中...</div>
                ) : withdrawals.length > 0 ? (
                    <div className="space-y-4">
                        {withdrawals.map((wd) => {
                            const statusMap: Record<string, { label: string; className: string }> = {
                                pending: { label: '待处理', className: 'bg-yellow-100 text-yellow-800' },
                                success: { label: '已到账', className: 'bg-green-100 text-green-800' },
                                failed: { label: '失败', className: 'bg-red-100 text-red-800' },
                                cancelled: { label: '已撤回', className: 'bg-gray-100 text-gray-800' },
                            };
                            const statusInfo = statusMap[wd.status] || { label: wd.status, className: 'bg-gray-100 text-gray-800' };
                            return (
                                <div key={wd.id} className="flex items-center justify-between py-3 border-b border-surface-100 last:border-0">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-full bg-blue-100">
                                            <ArrowUpRight className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm text-surface-900">提现 ¥{Number(wd.amount).toFixed(2)}</p>
                                            <p className="text-xs text-surface-500">
                                                {format(new Date(wd.created_at), 'yyyy-MM-dd HH:mm')}
                                            </p>
                                            {wd.out_biz_no && (
                                                <p className="text-xs text-surface-400 font-mono">单号: {wd.out_biz_no.substring(0, 16)}...</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusInfo.className}`}>
                                            {statusInfo.label}
                                        </span>
                                        {wd.status === 'pending' && (
                                            <Button
                                                label="撤回"
                                                icon="pi pi-times"
                                                size="small"
                                                onClick={() => handleCancelWithdrawal(wd.id)}
                                                loading={cancellingId === wd.id}
                                                className="p-button-text p-button-sm text-red-600"
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-10 text-surface-500">暂无提现记录</div>
                )}
            </div>
        </div>
    );
}
