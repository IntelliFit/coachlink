'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Button } from 'primereact/button';
import Link from 'next/link';

export default function BindAlipayPage() {
    const [payeeAccount, setPayeeAccount] = useState('');
    const [realName, setRealName] = useState('');
    const [payeeType, setPayeeType] = useState<'ALIPAY_LOGON_ID' | 'ALIPAY_USERID' | string>('ALIPAY_LOGON_ID');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const router = useRouter();

    const submit = async () => {
        setMessage(null);
        if (!payeeAccount) { setMessage('请输入支付宝账号'); return; }
        if (!realName.trim()) { setMessage('请填写真实姓名'); return; }
        setLoading(true);
        try {
            const res = await axios.post('/api/coach/wallet/alipay/bind', { payee_account: payeeAccount, real_name: realName, payee_type: payeeType });
            if (res.data && res.data.success) {
                router.push('/dashboard/wallet');
            } else {
                setMessage(res.data?.message || '绑定失败');
            }
        } catch (err: any) {
            console.error(err);
            setMessage(err?.response?.data?.message || String(err));
        } finally { setLoading(false); }
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">绑定支付宝账户</h1>
            <div className="max-w-md space-y-4 bg-white p-4 rounded shadow">
                <label className="block text-sm">支付宝账号</label>
                <input className="w-full border p-2 rounded" value={payeeAccount} onChange={(e) => setPayeeAccount(e.target.value)} placeholder="手机号/邮箱/支付宝账号" />

                <label className="block text-sm">真实姓名</label>
                <input className="w-full border p-2 rounded" value={realName} onChange={(e) => setRealName(e.target.value)} placeholder="请输入支付宝实名" />

                <label className="block text-sm">账号类型</label>
                <select className="w-full border p-2 rounded" value={payeeType} onChange={(e) => setPayeeType(e.target.value)}>
                    <option value="ALIPAY_LOGON_ID">支付宝登录号（手机号/邮箱）</option>
                    <option value="ALIPAY_USERID">支付宝UID</option>
                </select>

                <div className="flex items-center gap-2">
                    <Button onClick={submit} loading={loading} label="提交绑定" className="bg-primary-600 text-white" />
                    <Link href="/dashboard/wallet" className="text-sm text-muted-foreground">返回</Link>
                </div>

                {message ? <div className="text-sm text-red-600">{message}</div> : null}
            </div>
        </div>
    );
}
