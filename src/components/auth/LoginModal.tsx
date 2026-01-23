'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { TabView, TabPanel, TabViewTabChangeEvent } from 'primereact/tabview';
import { useToastContext } from '@/context/ToastContext';
import { signIn } from 'next-auth/react';
import { smsService } from '@/app/service/smsService';
import { Phone, Lock, ShieldCheck, X, LogIn, Send, User } from 'lucide-react';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';
import SliderCaptcha from '@/components/auth/SliderCaptcha';
import { sesService } from '@/app/service/sesService';
import WechatIcon from '@/components/icons/wechat';

interface LoginModalProps {
    isOpen: boolean;
    onClose: (back: boolean) => void;
}

interface DevUser {
    name: string;
    phone: string;
    password: string;
}

type AuthView = 'login' | 'reset-password';
type LoginMode = 'password' | 'verifyCode';

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
    const router = useRouter();
    const { showToast } = useToastContext();
    const [currentView, setCurrentView] = useState<AuthView>('login');
    const [loginMode, setLoginMode] = useState<LoginMode>('password');
    const [phoneOrEmail, setPhoneOrEmail] = useState('');
    const [password, setPassword] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [sendingCode, setSendingCode] = useState(false);
    const [wechatAuthUrl, setWechatAuthUrl] = useState<string | null>(null);
    const [showWechatQr, setShowWechatQr] = useState(false);
    const [quickUserId, setQuickUserId] = useState(''); // 快速接入：用户 ID 输入
    const [sliderCaptchaVisible, setSliderCaptchaVisible] = useState(false);

    // 重置视图状态当弹窗关闭
    useEffect(() => {
        if (!isOpen) {
            // 给一个小延迟，让动画播完
            const timer = setTimeout(() => {
                setCurrentView('login');
                setLoginMode('password');
                setPhoneOrEmail('');
                setPassword('');
                setVerificationCode('');
                setWechatAuthUrl(null);
                setShowWechatQr(false);
                setQuickUserId('');
                setSliderCaptchaVisible(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // 监听微信登录完成（来自 /wechat-auth/bridge）
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            const data = event.data as any;
            if (data?.type !== 'coachlink:wechat-auth-complete') return;

            const returnTo = typeof data.returnTo === 'string' ? data.returnTo : '/';
            setShowWechatQr(false);
            setWechatAuthUrl(null);

            onClose(false);
            // 刷新 session（以及页面数据）
            try {
                router.refresh();
            } catch { }
            // 如果需要跳转（如从 /login 打开登录框）
            if (typeof returnTo === 'string' && returnTo && returnTo !== window.location.pathname) {
                router.push(returnTo);
            }
        };

        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [onClose, router]);

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

    const handleCaptchaSuccess = async (token: string) => {
        const isPhone = /^1[3-9]\d{9}$/.test(phoneOrEmail);
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(phoneOrEmail);
        setSendingCode(true);
        try {
            if (process.env.NODE_ENV === 'development') {
                setCountdown(60);
                showToast({ severity: 'info', summary: '验证码已发送', detail: '模拟验证码：123456' });
            } else {
                if (isEmail) {
                    await sesService.sendVerificationCode({ email: phoneOrEmail, captchaToken: token });
                } else {
                    await smsService.sendVerificationCode({ phoneNumber: phoneOrEmail, captchaToken: token });
                }
                setCountdown(60);
                showToast({ severity: 'success', summary: '验证码已发送' });
            }
        } catch (error: any) {
            showToast({ severity: 'error', summary: '发送失败', detail: error.message });
        } finally {
            setSendingCode(false);
        }
    };

    const sendVerificationCode = () => {
        const isPhone = /^1[3-9]\d{9}$/.test(phoneOrEmail);
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(phoneOrEmail);
        if (!isPhone && !isEmail) {
            showToast({ severity: 'warn', summary: '请输入正确的手机号或邮箱' });
            return;
        }
        setSliderCaptchaVisible(true);
    };

    const handleLogin = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const trimmedPhoneOrEmail = phoneOrEmail.trim();
        const trimmedPassword = password.trim();
        const trimmedCode = verificationCode.trim();

        if (!trimmedPhoneOrEmail) {
            showToast({ severity: 'warn', summary: '请输入手机号或邮箱' });
            return;
        }

        if (loginMode === 'password') {
            if (!trimmedPassword) {
                showToast({ severity: 'warn', summary: '请输入密码' });
                return;
            }
        } else {
            if (!trimmedCode) {
                showToast({ severity: 'warn', summary: '请输入验证码' });
                return;
            }
        }
        setLoading(true);
        try {
            const result = await signIn('credentials', {
                redirect: false,
                callbackUrl: '/today-training',
                ...(loginMode === 'password'
                    ? { phoneOrEmail: trimmedPhoneOrEmail, password: trimmedPassword }
                    : { phoneOrEmail: trimmedPhoneOrEmail, verifyCode: trimmedCode }
                ),
            });
            if (result?.error) {
                showToast({ severity: 'error', summary: '登录失败', detail: result.error });
                return;
            }
            onClose(false);
            if (typeof window !== 'undefined' && window.location.pathname.includes('/login')) {
                router.push('/today-training');
            } else {
                router.refresh();
            }
        } catch (error: any) {
            showToast({ severity: 'error', summary: '登录失败', detail: error?.message });
        } finally {
            setLoading(false);
        }
    };

    const handleQuickLogin = async (user: DevUser) => {
        setLoading(true);
        try {
            const result = await signIn('credentials', {
                phoneOrEmail: user.phone,
                password: user.password,
                redirect: false,
                callbackUrl: '/today-training',
            });
            if (!result?.error) {
                // Close modal and redirect to dashboard/home after successful login
                onClose(false);
                // Check if we're on the login page - if so, redirect to home/dashboard instead of going back
                if (typeof window !== 'undefined' && window.location.pathname.includes('/login')) {
                    router.push('/');
                } else {
                    router.refresh();
                }
            }
        } finally { setLoading(false); }
    };

    const handleQuickLoginByUserId = async () => {
        const trimmedUserId = quickUserId.trim();
        if (!trimmedUserId) {
            showToast({ severity: 'warn', summary: '请输入用户 ID' });
            return;
        }
        setLoading(true);
        try {
            const result = await signIn('credentials', {
                userId: trimmedUserId,
                redirect: false,
                callbackUrl: '/today-training',
            });
            if (result?.error) {
                showToast({ severity: 'error', summary: '登录失败', detail: result.error });
            } else {
                onClose(false);
                if (typeof window !== 'undefined' && window.location.pathname.includes('/login')) {
                    router.push('/');
                } else {
                    router.refresh();
                }
            }
        } catch (error: any) {
            showToast({ severity: 'error', summary: '登录失败', detail: error.message });
        } finally { setLoading(false); }
    };

    return (
        <>
        <Dialog
            visible={isOpen}
            onHide={() => onClose(true)}
            showHeader={false}
            className="border-none shadow-2xl rounded-none sm:rounded-3xl overflow-hidden"
            style={{ width: '850px' }}
            contentClassName="p-0"
            pt={{
                root: {
                    className: 'shadow-none border-none bg-transparent min-h-screen md:min-h-[fit-content]'
                },
                header: {
                    className: 'p-8 pb-4 border-none bg-surface rounded-t-none sm:rounded-t-[24px]'
                },
                content: {
                    className: 'text-xl font-black tracking-tight rounded-none sm:rounded-b-[24px]'
                }
            }}
        >
            <div className="flex flex-col md:flex-row min-h-[550px] bg-surface">
                {/* 左侧品牌区域 - 延续导航栏风格 */}
                <div className="hidden md:flex w-[38%] bg-surface-50 p-10 flex-col justify-between relative overflow-hidden">
                    {/* 背景装饰球 */}
                    <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary-100/50 dark:bg-primary-800/50 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-primary-200/30 dark:bg-primary-700/30 rounded-full blur-3xl"></div>

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
                                {currentView === 'login' ? (
                                    <>开启您的<br /><span className="text-primary-500">专业健身</span>之旅</>
                                ) : (
                                    <>重置您的<br /><span className="text-primary-500">登录密码</span></>
                                )}
                            </h1>
                            <p className="text-sm text-surface-500 leading-relaxed font-light">
                                {currentView === 'login'
                                    ? "无论您是寻求进步的学员，还是追求卓越的教练，在这里连接无限可能。"
                                    : "设置一个新的安全密码，重新开始您的旅程。"
                                }
                            </p>
                        </div>
                    </div>

                    {/* 开发模式快捷入口 - 仅在登录页显示 */}
                    {currentView === 'login' && process.env.NODE_ENV === 'development' && (
                        <div className="relative z-10 pt-8 border-t border-surface-200 space-y-4">
                            <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mb-4">快速接入 (Dev)</p>
                            
                            {/* 预设开发用户列表 */}
                            {devUsers.length > 0 && (
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
                            )}

                            {/* 通过用户 ID 快速登录 */}
                            <div className="space-y-2">
                                <div className="flex gap-2 flex-col">
                                    <InputText
                                        value={quickUserId}
                                        onChange={(e) => setQuickUserId(e.target.value)}
                                        placeholder="输入用户 ID"
                                        className="flex-1 text-xs py-2 px-3 bg-surface border border-surface-200 rounded-lg"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleQuickLoginByUserId();
                                            }
                                        }}
                                    />
                                    <Button
                                        onClick={handleQuickLoginByUserId}
                                        loading={loading}
                                        disabled={!quickUserId.trim()}
                                        className="px-3 py-2 text-xs bg-primary-500 border-none rounded-lg text-white hover:bg-primary-600 transition-all active:scale-95 shadow-sm"
                                    >
                                        快速登录
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 右侧表单区域 */}
                <div className="flex-1 p-8 md:p-14 flex flex-col justify-center relative min-h-screen sm:min-h-[unset]">
                    <button
                        onClick={() => onClose(true)}
                        className="absolute top-6 right-6 p-2 text-surface-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-surface-50 rounded-full transition-all"
                    >
                        <X size={20} />
                    </button>

                    {currentView === 'reset-password' ? (
                        <ResetPasswordForm
                            onBackToLogin={() => setCurrentView('login')}
                            onSuccess={() => setCurrentView('login')}
                        />
                    ) : (
                        <>
                            <div className="mb-10 text-center md:text-left">
                                <h2 className="text-2xl font-bold text-surface-900 mb-2">登录账户</h2>
                            </div>

                            <form onSubmit={handleLogin} className="space-y-6">
                                <div className="space-y-5">
                                    {/* 1. 胶囊切换器 */}
                                    <div className="relative p-1.5 bg-surface-100/80 rounded-[20px] flex">
                                        <div
                                            className={`absolute inset-y-1.5 left-1.5 w-[calc(50%-6px)] bg-surface rounded-[14px] shadow-sm transition-all duration-300 cubic-bezier(0.34, 1.56, 0.64, 1) ${loginMode === 'password' ? 'translate-x-0' : 'translate-x-full'
                                                }`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => { setLoginMode('password'); setVerificationCode(''); }}
                                            className={`relative flex-1 py-2 text-sm font-bold z-10 transition-colors ${loginMode === 'password' ? 'text-primary-600' : 'text-surface-500 hover:text-surface-700'}`}
                                        >
                                            密码登录
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setLoginMode('verifyCode'); setPassword(''); }}
                                            className={`relative flex-1 py-2 text-sm font-bold z-10 transition-colors ${loginMode === 'verifyCode' ? 'text-primary-600' : 'text-surface-500 hover:text-surface-700'}`}
                                        >
                                            验证码登录
                                        </button>
                                    </div>

                                    {/* 2. 输入区域 */}
                                    <div className="space-y-4">
                                        {/* 手机号 */}
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-4 flex items-center text-surface-400 group-focus-within:text-primary-500 transition-colors z-10">
                                                <User size={18} />
                                            </div>
                                            <InputText
                                                value={phoneOrEmail}
                                                onChange={(e) => setPhoneOrEmail(e.target.value)}
                                                placeholder="手机号或邮箱"
                                                className="w-full pl-12 pr-4 py-4 bg-surface-50 rounded-2xl shadow-primary-500"
                                            />
                                        </div>

                                        {/* 动态切换：密码或验证码 */}
                                        {loginMode === 'password' ? (
                                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="flex justify-between items-center px-1">
                                                    <label className="text-xs font-bold text-surface-500 uppercase tracking-wider">登录密码</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCurrentView('reset-password')}
                                                        className="text-xs text-primary-500 hover:text-primary-700 font-bold transition-colors"
                                                    >
                                                        忘记密码？
                                                    </button>
                                                </div>
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
                                                        pt={{
                                                            root: { className: 'w-full' },
                                                            input: {
                                                                className: 'w-full pl-12 pr-12 py-4 bg-surface-50 rounded-2xl shadow-primary-500'
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="relative flex-1 group">
                                                    <div className="absolute inset-y-0 left-4 flex items-center text-surface-400 group-focus-within:text-primary-500 transition-colors z-10">
                                                        <ShieldCheck size={18} />
                                                    </div>
                                                    <InputText
                                                        value={verificationCode}
                                                        onChange={(e) => setVerificationCode(e.target.value)}
                                                        placeholder="6位验证码"
                                                        maxLength={6}
                                                        className="w-full pl-12 pr-4 py-4 bg-surface-50 rounded-2xl"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={sendVerificationCode}
                                                    disabled={countdown > 0 || sendingCode || sliderCaptchaVisible || !phoneOrEmail.trim()}
                                                    className="px-6 rounded-2xl text-sm font-bold bg-surface border text-primary-600 hover:border-primary-500 disabled:opacity-50 transition-all min-w-[110px] whitespace-nowrap"
                                                >
                                                    {sendingCode ? '...' : countdown > 0 ? `${countdown}s` : '获取验证码'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 3. 登录按钮 */}
                                <div className="pt-2">
                                    <Button
                                        loading={loading}
                                        className="w-full py-4 bg-primary-500 border-none rounded-2xl shadow-xl shadow-primary-500/20 hover:bg-primary-600 transition-all transform active:scale-[0.98]"
                                    >
                                        <div className="flex items-center justify-center gap-2 w-full">
                                            {!loading && <LogIn size={20} />}
                                            <span className="font-bold">立即登录</span>
                                        </div>
                                    </Button>
                                </div>

                                {/* 4. 注册跳转 */}
                                <div className="text-center">
                                    <p className="text-sm text-surface-400">
                                        还没有账户？
                                        <button
                                            onClick={() => { onClose(false); router.push('/register'); }}
                                            className="text-primary-600 hover:text-primary-700 font-bold ml-1 transition-colors"
                                            type="button"
                                        >
                                            立即注册
                                        </button>
                                    </p>
                                </div>

                                {/* 5. 分割线和其它登录方式 */}
                                <div className="relative my-6">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-surface-200"></div>
                                    </div>
                                    <div className="relative flex justify-center text-sm">
                                        <span className="px-4 bg-surface text-surface-500 text-xs font-bold uppercase tracking-widest">其他登录方式</span>
                                    </div>
                                </div>

                                {/* 6. 社交登录按钮 */}
                                <div className="flex justify-center space-x-4">
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            setLoading(true);
                                            try {
                                                const origin = window.location.origin;
                                                // 默认登录后回到当前页；如果是 /login 页，则回到 /today-training
                                                const isLoginPage = window.location.pathname.includes('/login');
                                                const returnTo = isLoginPage
                                                    ? '/today-training'
                                                    : `${window.location.pathname}${window.location.search}`;

                                                const callbackUrl = `${origin}/wechat-auth/bridge?returnTo=${encodeURIComponent(returnTo)}`;

                                                const result = await signIn('wechat', {
                                                    redirect: false,
                                                    callbackUrl,
                                                });

                                                if (result?.error) {
                                                    showToast({
                                                        severity: 'error',
                                                        summary: '微信登录失败',
                                                        detail: result.error,
                                                    });
                                                    return;
                                                }

                                                if (result?.url) {
                                                    // 跳转到新页面显示二维码
                                                    window.location.href = result.url;
                                                } else {
                                                }
                                            } catch (error: any) {
                                                showToast({
                                                    severity: 'error',
                                                    summary: '微信登录失败',
                                                    detail: error.message || '未知错误',
                                                });
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        className="flex items-center justify-center p-3 border border-surface-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all"
                                        title="微信登录"
                                    >
                                        <WechatIcon className="w-6 h-6" fill="#07C160" />
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </Dialog>
        <SliderCaptcha
            visible={sliderCaptchaVisible}
            onHide={() => setSliderCaptchaVisible(false)}
            onSuccess={handleCaptchaSuccess}
        />
        </>
    );
}
