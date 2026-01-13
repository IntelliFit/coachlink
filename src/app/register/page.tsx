'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Checkbox } from 'primereact/checkbox';
import { FloatLabel } from 'primereact/floatlabel';
import { Dialog } from 'primereact/dialog';
import { useToastContext } from '@/context/ToastContext';
import { authService } from '../service/authService';
import { smsService } from '../service/smsService';
import { Phone, ShieldCheck, ArrowLeft, UserPlus } from 'lucide-react';
import MarkdownIt from 'markdown-it';

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
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
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

    // Persist share attribution for embedded browsers that may drop query params/cookies during navigation.
    useEffect(() => {
        const share = searchParams.get('share');
        if (share) {
            try {
                localStorage.setItem('share_id', share);
            } catch {}
        }

        // Also try cookie-based attribution if present
        try {
            const m = document.cookie.match(/(?:^|; )share_attribution=([^;]+)/);
            if (m && m[1]) {
                const decoded = decodeURIComponent(m[1]);
                const obj = JSON.parse(decoded);
                if (obj?.shareId) localStorage.setItem('share_id', obj.shareId);
            }
        } catch {}
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
            const invitationCode = searchParams.get('invite') || undefined;
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
                phone: phone.trim(),
                password: password.trim(),
                verifyCode: verificationCode.trim(),
                ref,
                shareId,
                invitationCode,
            });
            if (res) {
                showToast({ severity: 'success', summary: '注册成功' });
                router.push('/login');
            }
        } catch (error: any) {
            showToast({ severity: 'error', summary: '注册失败', detail: error.message });
        } finally {
            setLoading(false);
        }
    };

    const sendVerificationCode = async () => {
        if (!/^1[3-9]\d{9}$/.test(phone)) {
            showToast({ severity: 'warn', summary: '手机号格式错误' });
            return;
        }
        setSendingCode(true);
        try {
            await smsService.sendVerificationCode({ phoneNumber: phone });
            setCountdown(60);
            showToast({ severity: 'success', summary: '验证码已发送' });
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
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center overflow-y-auto overflow-x-hidden p-6 sm:p-10">

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
                    <div className='mb-10'>
                        <FloatLabel>
                            <InputText
                                id="phone"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                                className="w-full"
                                placeholder=""
                            />
                            <label htmlFor="phone">手机号</label>
                        </FloatLabel>
                    </div>

                    <div className='mb-10'>
                        <FloatLabel>
                            <Password
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full"
                                placeholder=" "
                                toggleMask
                                promptLabel="请选择密码"
                                weakLabel="密码太简单"
                                mediumLabel="密码复杂度一般"
                                strongLabel="密码复杂度较高"
                                feedback={true}
                            />
                            <label htmlFor="password">密码</label>
                        </FloatLabel>
                    </div>

                    <div className='mb-10'>
                        <FloatLabel>
                            <Password
                                id="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="w-full"
                                placeholder=" "
                                toggleMask
                                feedback={false}
                            />
                            <label htmlFor="confirmPassword">确认密码</label>
                        </FloatLabel>
                    </div>

                    <div className='mb-10'>
                        <FloatLabel>
                            <div className="flex gap-2">
                                <InputText
                                    id="verificationCode"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value)}
                                    className="w-[50%]"
                                    required
                                />
                                <Button
                                    type="button"
                                    label={countdown > 0 ? `${countdown}秒后重发` : "获取验证码"}
                                    onClick={sendVerificationCode}
                                    disabled={countdown > 0 || sendingCode || !phone.trim()}
                                    loading={sendingCode}
                                    outlined
                                    className="w-40"
                                />
                            </div>
                            <label htmlFor="verificationCode">验证码</label>
                        </FloatLabel>
                    </div>

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
                        label='注册'
                        disabled={loading}
                        loading={loading}
                        className="w-full bg-gradient-to-br from-[#FBB94D] to-[#EF793B] hover:bg-primary-100 text-surface font-medium py-3 rounded-lg transition"
                    />
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