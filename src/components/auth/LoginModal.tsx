'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { useToastContext } from '@/context/ToastContext';
import { signIn } from 'next-auth/react';
import { smsService } from '@/app/service/smsService';
import { Phone, Lock, ShieldCheck, X, LogIn, Send } from 'lucide-react';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface DevUser {
    name: string;
    phone: string;
    password: string;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
    const router = useRouter();
    const { showToast } = useToastContext();
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [sendingCode, setSendingCode] = useState(false);

    const devUsers = useMemo<DevUser[]>(() => {
        try {
            const envValue = process.env.NEXT_PUBLIC_DEV_USERS;
            return envValue ? JSON.parse(envValue) : [];
        } catch (e) { return []; }
    }, []);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    const sendVerificationCode = async () => {
        if (!/^1[3-9]\d{9}$/.test(phone)) {
            showToast({ severity: 'warn', summary: '请输入正确的手机号' });
            return;
        }
        setSendingCode(true);
        try {
            if (process.env.NODE_ENV === 'development') {
                setCountdown(60);
                showToast({ severity: 'info', summary: '验证码已发送', detail: '模拟验证码：123456' });
            } else {
                await smsService.sendVerificationCode({ phoneNumber: phone });
                setCountdown(60);
                showToast({ severity: 'success', summary: '验证码已发送' });
            }
        } catch (error: any) {
            showToast({ severity: 'error', summary: '发送失败', detail: error.message });
        } finally { setSendingCode(false); }
    };

    const handleLogin = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!phone || !password || !verificationCode) {
            showToast({ severity: 'warn', summary: '请填写完整登录信息' });
            return;
        }
        setLoading(true);
        try {
            const result = await signIn('credentials', {
                phone: phone.trim(),
                password: password.trim(),
                verifyCode: verificationCode.trim(),
                redirect: false,
            });
            if (result?.error) {
                showToast({ severity: 'error', summary: '登录失败', detail: result.error });
            } else {
                // Close modal and redirect to dashboard/home after successful login
                onClose();
                // Check if we're on the login page - if so, redirect to home/dashboard instead of going back
                if (typeof window !== 'undefined' && window.location.pathname.includes('/login')) {
                    router.push('/');
                } else {
                    router.refresh();
                }
            }
        } catch (error: any) {
            showToast({ severity: 'error', summary: '登录失败' });
        } finally { setLoading(false); }
    };

    const handleQuickLogin = async (user: DevUser) => {
        setLoading(true);
        try {
            const result = await signIn('credentials', {
                phone: user.phone,
                password: user.password,
                redirect: false,
            });
            if (!result?.error) {
                // Close modal and redirect to dashboard/home after successful login
                onClose();
                // Check if we're on the login page - if so, redirect to home/dashboard instead of going back
                if (typeof window !== 'undefined' && window.location.pathname.includes('/login')) {
                    router.push('/');
                } else {
                    router.refresh();
                }
            }
        } finally { setLoading(false); }
    };

    return (
        <Dialog
            visible={isOpen}
            onHide={onClose}
            showHeader={false}
            className="border-none shadow-2xl rounded-3xl overflow-hidden"
            style={{ width: '850px', maxWidth: '95vw' }}
            contentClassName="p-0"
        >
            <div className="flex flex-col md:flex-row min-h-[550px] bg-surface">
                {/* 左侧品牌区域 - 延续导航栏风格 */}
                <div className="hidden md:flex w-[38%] bg-surface-50 p-10 flex-col justify-between relative overflow-hidden">
                    {/* 背景装饰球 */}
                    <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary-100/50 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-primary-200/30 rounded-full blur-3xl"></div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-12">
                            <img src="/favicon.jpg" alt="logo" className="h-10 w-auto rounded-xl shadow-md object-contain" />
                            <div className="flex flex-col leading-none">
                                <span className="text-xl font-black tracking-tighter text-surface-900">教<span className="text-primary-500">链</span></span>
                                <span className="text-[10px] font-bold text-primary-500/80 uppercase tracking-widest mt-0.5">CoachLink</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h1 className="text-3xl font-bold text-surface-900 tracking-tight leading-tight">
                                开启您的<br /><span className="text-primary-500">专业健身</span>之旅
                            </h1>
                            <p className="text-sm text-surface-500 leading-relaxed font-light">
                                无论您是寻求进步的学员，还是追求卓越的教练，在这里连接无限可能。
                            </p>
                        </div>
                    </div>

                    {/* 开发模式快捷入口 */}
                    {process.env.NODE_ENV === 'development' && devUsers.length > 0 && (
                        <div className="relative z-10 pt-8 border-t border-surface-200">
                            <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mb-4">快速接入 (Dev)</p>
                            <div className="flex flex-wrap gap-2">
                                {devUsers.map((user, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleQuickLogin(user)}
                                        className="px-3 py-1.5 text-xs bg-surface border border-surface-200 rounded-lg text-surface-600 hover:border-primary-500 hover:text-primary-600 transition-all active:scale-95 shadow-sm"
                                    >
                                        {user.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* 右侧表单区域 */}
                <div className="flex-1 p-8 md:p-14 flex flex-col justify-center relative">
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 text-surface-400 hover:text-primary-500 hover:bg-primary-50 rounded-full transition-all"
                    >
                        <X size={20} />
                    </button>

                    <div className="mb-10 text-center md:text-left">
                        <h2 className="text-2xl font-bold text-surface-900 mb-2">登录账户</h2>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-4">
                            {/* 手机号 */}
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-4 flex items-center text-surface-400 group-focus-within:text-primary-500 transition-colors">
                                    <Phone size={18} />
                                </div>
                                <InputText
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="手机号码"
                                    className="w-full pl-12 pr-4 py-3.5 bg-surface-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500/20 transition-all"
                                />
                            </div>

                            {/* 密码 */}
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-4 flex items-center z-10 text-surface-400 group-focus-within:text-primary-500 transition-colors">
                                    <Lock size={18} />
                                </div>
                                <Password
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="输入登录密码"
                                    toggleMask
                                    feedback={false}
                                    // 关键点：通过 pt 属性强制控制 root 容器和 input 元素
                                    pt={{
                                        root: { className: 'w-full' }, // 强制外层容器撑满
                                        input: {
                                            className: 'w-full pl-12 pr-12 py-3.5 bg-surface-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500/20 transition-all'
                                        }
                                    }}
                                />
                            </div>

                            {/* 验证码 */}
                            <div className="flex gap-3">
                                <div className="relative flex-1 group">
                                    <div className="absolute inset-y-0 left-4 flex items-center text-surface-400 group-focus-within:text-primary-500 transition-colors">
                                        <ShieldCheck size={18} />
                                    </div>
                                    <InputText
                                        value={verificationCode}
                                        onChange={(e) => setVerificationCode(e.target.value)}
                                        placeholder="6位验证码"
                                        maxLength={6}
                                        className="w-full pl-12 pr-4 py-3.5 bg-surface-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500/20 transition-all"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={sendVerificationCode}
                                    disabled={countdown > 0 || sendingCode || !phone}
                                    className="px-5 rounded-2xl text-sm font-bold border border-primary-100 text-primary-600 hover:bg-primary-50 disabled:opacity-50 transition-all min-w-[120px] flex items-center justify-center gap-2"
                                >
                                    {sendingCode ? '发送中...' : countdown > 0 ? `${countdown}s` : <><Send size={16} /> 获取</>}
                                </button>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button
                                loading={loading}
                                className="w-full py-4 bg-primary-500 border-none rounded-2xl shadow-lg shadow-primary-200 dark:shadow-primary-700 hover:bg-primary-600 transition-all transform active:scale-[0.98]"
                            >
                                <div className="flex items-center justify-center gap-2 w-full">
                                    <LogIn size={20} />
                                    <span className="font-bold text-lg">立即登录</span>
                                </div>
                            </Button>
                        </div>

                        <div className="pt-6 text-center">
                            <p className="text-sm text-surface-400">
                                还没有账户？{' '}
                                <button
                                    onClick={() => { onClose(); router.push('/register'); }}
                                    className="text-primary-600 hover:text-primary-700 font-bold ml-1 transition-colors"
                                    type="button"
                                >
                                    立即注册
                                </button>
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </Dialog>
    );
}