'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Checkbox } from 'primereact/checkbox';
import { Dialog } from 'primereact/dialog';
import { useToastContext } from '@/context/ToastContext';
import { authService } from '../service/authService';
import { smsService } from '../service/smsService';
import { Phone, ShieldCheck, ArrowLeft, UserPlus, User, Lock, Dumbbell, KeyRound } from 'lucide-react';
import MarkdownIt from 'markdown-it';
import { sesService } from '../service/sesService';
import { signIn, useSession } from 'next-auth/react';

const fetchMarkdown = async (filename: string) => {
    const md = new MarkdownIt({
        html: true,
        linkify: true,
        typographer: true,
    });
    try {
        // 在 Next.js 中，public 目录下的文件通过 "/" 直接访问
        const response = await fetch(`/docs/${filename}`);
        if (!response.ok) throw new Error('Failed to fetch doc');
        const text = await response.text();
        return md.render(text);
    } catch (error) {
        console.error(`Error loading ${filename}:`, error);
        return '<p>内容加载失败，请稍后再试。</p>';
    }
};

export default function RegisterPage() {
    const [phoneOrEmail, setPhoneOrEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [invitationCode, setInvitationCode] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [agreed, setAgreed] = useState(false);

    const [loading, setLoading] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [showUserAgreement, setShowUserAgreement] = useState(false);
    const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
    const [terms, setTerms] = useState<string>('');
    const [disclaimer, setDisclaimer] = useState<string>('');

    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToastContext();

    const { data: session } = useSession();

    useEffect(() => {
        const share = searchParams.get('share');
        const invitation = invitationCode.trim() || searchParams.get('invite') || undefined;

        if ((share || invitation) && session) {
            console.log(session);
            router.push('/');
            showToast({ severity: 'warn', summary: '您已登录，如需注册新账号，请先登出。' });
        }
    }, [session]);

    // Persist share attribution for embedded browsers that may drop query params/cookies during navigation.
    useEffect(() => {
        const share = searchParams.get('share');
        if (share) {
            try {
                localStorage.setItem('share_id', share);
            } catch { }
        }

        // Also try cookie-based attribution if present
        try {
            const m = document.cookie.match(/(?:^|; )share_attribution=([^;]+)/);
            if (m && m[1]) {
                const decoded = decodeURIComponent(m[1]);
                const obj = JSON.parse(decoded);
                if (obj?.shareId) localStorage.setItem('share_id', obj.shareId);
            }
        } catch { }


    }, [searchParams]);

    const loadDocs = async () => {
        const [tHtml, dHtml] = await Promise.all([
            fetchMarkdown('terms.md'),
            fetchMarkdown('disclaimer.md') // 假设你的免责声明文件名
        ]);
        setTerms(tHtml);
        setDisclaimer(dHtml);
    };

    useEffect(() => {
        loadDocs();
    }, []);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (countdown > 0) {
            timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
        }
        return () => clearInterval(timer);
    }, [countdown]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!agreed) {
            showToast({ severity: 'warn', summary: '请阅读并同意协议' });
            return;
        }
        if (password !== confirmPassword) {
            showToast({ severity: 'error', summary: '密码不匹配' });
            return;
        }

        setLoading(true);
        try {
            const ref = searchParams.get('ref') || undefined;
            // Use local state value if available, otherwise check URL param
            const finalInvitationCode = invitationCode.trim() || searchParams.get('invite') || undefined;
            const invitationModeRaw = searchParams.get('im') || searchParams.get('invitationMode') || undefined;
            const invitationMode =
                invitationModeRaw === 'exclusive' || invitationModeRaw === 'open'
                    ? (invitationModeRaw as 'exclusive' | 'open')
                    : undefined;
            const shareId =
                searchParams.get('share') ||
                (() => {
                    try {
                        return localStorage.getItem('share_id') || undefined;
                    } catch {
                        return undefined;
                    }
                })();
            const res = await authService.register({
                phoneOrEmail: phoneOrEmail.trim(),
                password: password.trim(),
                verifyCode: verificationCode.trim(),
                ref,
                shareId,
                invitationCode: finalInvitationCode,
                invitationMode,
            });
            if (res) {
                showToast({ severity: 'success', summary: '注册成功，正在自动登录...' });

                // Automatically sign in the user after registration
                const signInResult = await signIn('credentials', {
                    phoneOrEmail: phoneOrEmail.trim(),
                    password: password.trim(),
                    redirect: false, // Don't redirect automatically, we'll handle it
                });

                if (signInResult?.ok) {
                    // If login succeeds, redirect to home page
                    router.push('/');
                    router.refresh(); // Refresh to update session state
                } else {
                    // If auto-login fails, redirect to login page
                    router.push('/login');
                }
            }
        } catch (error: any) {
            showToast({ severity: 'error', summary: '注册失败', detail: error.message });
        } finally {
            setLoading(false);
        }
    };

    const sendVerificationCode = async () => {
        // Check if input is a valid phone number or email
        const isPhone = /^1[3-9]\d{9}$/.test(phoneOrEmail);
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(phoneOrEmail);

        if (!isPhone && !isEmail) {
            showToast({ severity: 'warn', summary: isPhone ? '手机号格式错误' : '邮箱格式错误' });
            return;
        }
        setSendingCode(true);
        try {
            if (isEmail) {
                await sesService.sendVerificationCode({ email: phoneOrEmail });
            } else {
                await smsService.sendVerificationCode({ phoneNumber: phoneOrEmail });
            }
            setCountdown(60);

            // 检查是否使用模拟短信（通过环境变量控制）
            const useMockSms = process.env.NEXT_PUBLIC_USE_MOCK_SMS === 'true';
            if (useMockSms) {
                showToast({ severity: 'info', summary: '验证码已发送', detail: '模拟验证码：123456' });
            } else {
                showToast({ severity: 'success', summary: '验证码已发送' });
            }
        } catch (error: any) {
            showToast({ severity: 'error', summary: '发送失败', detail: error.message });
        } finally {
            setSendingCode(false);
        }
    };

    return (
        /** * 使用 z-[100] 和 fixed inset-0 确保彻底遮盖全局 Header/Footer 
         * 这种方案不需要修改全局 layout，最适合独立注册页
         */
        <div className="fixed inset-0 z-[100] bg-surface flex flex-col items-center justify-center overflow-y-auto overflow-x-hidden p-6 sm:p-10">

            {/* 背景美化元素 */}
            <div className="absolute top-0 left-0 w-full h-full -z-10 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-50 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-50 rounded-full blur-[120px]" />
            </div>

            <div className="w-full max-w-[480px] animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* 返回按钮 */}
                <button
                    onClick={() => router.back()}
                    className="mb-8 flex items-center gap-2 text-surface-400 hover:text-primary transition-colors font-bold text-sm group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    <span>返回</span>
                </button>

                {/* Logo & Header */}
                <div className="mb-10">
                    <h1 className="text-4xl font-black tracking-tighter text-surface-900 mb-2">
                        创建新账号 <span className="text-primary">.</span>
                    </h1>
                    <p className="text-surface-500 font-medium leading-relaxed">
                        欢迎加入 CoachLink！无论你是想先作为学员体验训练，还是计划升级为教练建立个人品牌，都可以从这里开始。
                    </p>
                </div>

                {/* Form Section */}
                <form onSubmit={handleRegister} className="mb-2">
                    <div className='space-y-2 mb-4'>
                        <div className="flex justify-between items-center px-1">
                            <label className="text-xs font-bold text-surface-500 uppercase tracking-wider">手机号或邮箱</label>
                            <span></span>
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-4 flex items-center text-surface-400 group-focus-within:text-primary-500 transition-colors z-10">
                                <User size={18} />
                            </div>
                            <InputText
                                value={phoneOrEmail}
                                placeholder="手机号或邮箱"
                                onChange={(e) => setPhoneOrEmail(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-surface-50 rounded-2xl shadow-primary-500"
                            />
                        </div>
                    </div>


                    <div className="space-y-2 mb-4">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-xs font-bold text-surface-500 uppercase tracking-wider">登录密码</label>
                            <span></span>
                        </div>

                        <div className="relative group">
                            <div className="absolute inset-y-0 left-4 flex items-center z-10 text-surface-400 group-focus-within:text-primary-500 transition-colors">
                                <Lock size={18} />
                            </div>
                            <Password
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                toggleMask
                                placeholder='请输入密码'
                                promptLabel="请选择密码"
                                weakLabel="密码太简单"
                                mediumLabel="密码复杂度一般"
                                strongLabel="密码复杂度较高"
                                feedback={true}
                                pt={{
                                    root: { className: 'w-full' },
                                    input: {
                                        className: 'w-full pl-12 pr-12 py-4 bg-surface-50 rounded-2xl shadow-primary-500'
                                    }
                                }}
                            />
                        </div>
                    </div>

                    <div className='sapce-y-4 mb-4'>
                        <div>
                            <label className="text-xs font-bold text-surface-500 uppercase tracking-wider">确认密码</label>
                            <span></span>
                        </div>
                        <div className='relative group'>
                            <div className="absolute inset-y-0 left-4 flex items-center z-10 text-surface-400 group-focus-within:text-primary-500 transition-colors">
                                <Lock size={18} />
                            </div>
                            <Password
                                id="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="w-full"
                                placeholder='请再次输入密码'
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

                    {/* Invitation Code Field */}
                    <div className='space-y-2 mb-4'>
                        <div className="flex justify-between items-center px-1">
                            <label className="text-xs font-bold text-surface-500 uppercase tracking-wider">邀请码（可选）</label>
                            <span></span>
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-4 flex items-center text-surface-400 group-focus-within:text-primary-500 transition-colors z-10">
                                <KeyRound size={18} />
                            </div>
                            <InputText
                                value={invitationCode}
                                onChange={(e) => setInvitationCode(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-surface-50 rounded-2xl shadow-primary-500"
                                placeholder="请输入邀请码（可选）"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 mb-4">
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
                            disabled={countdown > 0 || sendingCode || !phoneOrEmail.trim()}
                            className="px-6 rounded-2xl text-sm font-bold bg-surface border text-primary-600 hover:border-primary-500 disabled:opacity-50 transition-all min-w-[110px] whitespace-nowrap"
                        >
                            {sendingCode ? '...' : countdown > 0 ? `${countdown}s` : '获取验证码'}
                        </button>
                    </div>

                    <br />
                    <hr />
                    <br />

                    {/* 用户协议 */}
                    <div className="flex items-center gap-3 mb-6">
                        <Checkbox
                            inputId="agreement"
                            checked={agreed}
                            onChange={e => setAgreed(e.checked || false)}
                            className="mt-1"
                        />
                        <label htmlFor="agreement" className="text-[13px] text-surface-500 leading-relaxed cursor-pointer select-none">
                            同意 CoachLink 的
                            <span
                                className="text-primary font-bold cursor-pointer hover:underline mx-1 text-xs"
                                onClick={(e) => {
                                    e.preventDefault();
                                    setShowUserAgreement(true);
                                }}
                            >
                                用户协议
                            </span>
                            与
                            <span
                                className="text-primary font-bold cursor-pointer hover:underline mx-1 text-xs"
                                onClick={(e) => {
                                    e.preventDefault();
                                    setShowPrivacyPolicy(true);
                                }}
                            >
                                免责声明
                            </span>
                        </label>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        loading={loading}
                        className="w-full py-4 bg-primary-500 border-none rounded-2xl shadow-xl shadow-primary-500/20 hover:bg-primary-600 transition-all transform active:scale-[0.98]"
                    >
                        <div className="flex items-center justify-center gap-2 w-full">
                            {!loading && <Dumbbell size={20} />}
                            <span className="font-bold">注册</span>
                        </div>
                    </Button>
                </form>

                {/* 用户协议对话框 */}
                <Dialog
                    header="用户协议"
                    visible={showUserAgreement}
                    onHide={() => setShowUserAgreement(false)}
                    style={{ width: '90%', maxWidth: '800px' }}
                    className="text-surface-900"
                >
                    <div className="p-6 md:p-10">
                        <div
                            className="prose max-w-none text-surface-700"
                            dangerouslySetInnerHTML={{ __html: terms }}
                        />
                    </div>
                </Dialog>

                {/* 免责声明对话框 */}
                <Dialog
                    header="免责声明"
                    visible={showPrivacyPolicy}
                    onHide={() => setShowPrivacyPolicy(false)}
                    style={{ width: '90%', maxWidth: '800px' }}
                    className="text-surface-900"
                >
                    <div className="p-6 md:p-10">
                        <div
                            className="prose max-w-none text-surface-700"
                            dangerouslySetInnerHTML={{ __html: disclaimer }}
                        />
                    </div>
                </Dialog>
            </div>

        </div>
    );
}