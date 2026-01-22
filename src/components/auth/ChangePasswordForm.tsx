'use client';

import { useState, useMemo, useEffect } from 'react';
import { Password } from 'primereact/password';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { useToastContext } from '@/context/ToastContext';
import { useSession } from 'next-auth/react';
import { userService } from '@/app/service/userService';
import { smsService } from '@/app/service/smsService';
import { sesService } from '@/app/service/sesService';
import { Lock, Phone, Mail, ShieldCheck } from 'lucide-react';

type VerifyType = 'phone' | 'email';

const phoneRegex = /^1[3-9]\d{9}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function maskPhone(phone: string) {
    if (!phone) return '';
    return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

function maskEmail(email: string) {
    if (!email) return '';
    const [name, domain] = email.split('@');
    if (!domain) return email;
    const maskedName = name.length <= 2 ? `${name[0] || ''}*` : `${name.slice(0, 2)}***`;
    return `${maskedName}@${domain}`;
}

export default function ChangePasswordForm() {
    const { showToast } = useToastContext();
    const { data: session } = useSession();
    const user = session?.user as any;
    const boundPhone = (user?.phone as string | null) || '';
    const boundEmail = (user?.email as string | null) || '';

    const [verifyType, setVerifyType] = useState<VerifyType | null>(null);
    const [verifyCode, setVerifyCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        if (countdown <= 0) return;
        const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [countdown]);

    // 自动选择可用的验证方式
    useEffect(() => {
        if (!verifyType) {
            if (boundPhone) {
                setVerifyType('phone');
            } else if (boundEmail) {
                setVerifyType('email');
            }
        }
    }, [boundPhone, boundEmail, verifyType]);

    const availableTypes = useMemo(() => {
        const types: VerifyType[] = [];
        if (boundPhone) types.push('phone');
        if (boundEmail) types.push('email');
        return types;
    }, [boundPhone, boundEmail]);

    const currentContactValue = verifyType === 'phone' ? boundPhone : boundEmail;
    const canSend = useMemo(() => {
        if (!currentContactValue) return false;
        if (verifyType === 'phone') return phoneRegex.test(currentContactValue);
        return emailRegex.test(currentContactValue);
    }, [verifyType, currentContactValue]);

    const handleSendCode = async () => {
        if (!verifyType || !currentContactValue) {
            showToast({ severity: 'warn', summary: '请先选择验证方式' });
            return;
        }
        if (countdown > 0) return;

        setSending(true);
        try {
            if (verifyType === 'phone') {
                await smsService.sendVerificationCode({ phoneNumber: currentContactValue });
            } else {
                await sesService.sendVerificationCode({ email: currentContactValue });
            }
            setCountdown(60);
            showToast({ severity: 'success', summary: '验证码已发送' });
        } catch (e: any) {
            showToast({ severity: 'error', summary: '发送失败', detail: e?.message || '请稍后重试' });
        } finally {
            setSending(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!verifyType) {
            showToast({ severity: 'warn', summary: '请选择验证方式' });
            return;
        }

        if (!verifyCode || !newPassword || !confirmPassword) {
            showToast({ severity: 'warn', summary: '请填写完整信息' });
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast({ severity: 'warn', summary: '两次输入的新密码不一致' });
            return;
        }

        setLoading(true);
        try {
            await userService.resetPassword({
                type: verifyType,
                verifyCode: verifyCode.trim(),
                newPassword: newPassword.trim(),
            });
            showToast({ severity: 'success', summary: '密码重置成功' });
            // 清空表单
            setVerifyCode('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            showToast({ severity: 'error', summary: '重置失败', detail: error.message });
        } finally {
            setLoading(false);
        }
    };

    if (availableTypes.length === 0) {
        return (
            <div className="bg-surface rounded-2xl shadow-sm border border-surface-200 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm sm:text-lg font-black text-surface-900 flex items-center gap-2">
                        <Lock className="text-primary" size={20} />
                        修改密码
                    </h2>
                </div>
                <div className="text-sm text-surface-500 py-4">
                    请先绑定手机号或邮箱，然后才能重置密码。
                </div>
            </div>
        );
    }

    return (
        <div className="bg-surface rounded-2xl shadow-sm border border-surface-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm sm:text-lg font-black text-surface-900 flex items-center gap-2">
                    <Lock className="text-primary" size={20} />
                    修改密码
                </h2>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="divide-y divide-surface-100">
                    {/* 选择验证方式 */}
                    {availableTypes.length > 1 && (
                        <>
                            <div className="flex items-center justify-between gap-3 py-3">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="w-10 h-10 rounded-2xl bg-surface-50 border border-surface-200 flex items-center justify-center shrink-0">
                                        <ShieldCheck size={18} className="text-surface-500" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-black text-surface-900 mb-2">验证方式</div>
                                        <div className="flex gap-2">
                                            {availableTypes.map((type) => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => {
                                                        setVerifyType(type);
                                                        setVerifyCode('');
                                                    }}
                                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                                        verifyType === type
                                                            ? 'bg-primary-500 text-surface'
                                                            : 'bg-surface-50 border border-surface-200 text-surface-700 hover:border-primary-300'
                                                    }`}
                                                >
                                                    {type === 'phone' ? (
                                                        <div className="flex items-center gap-2">
                                                            <Phone size={16} />
                                                            <span>手机号</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <Mail size={16} />
                                                            <span>邮箱</span>
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* 验证码 */}
                    <div className="flex items-center justify-between gap-3 py-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-2xl bg-surface-50 border border-surface-200 flex items-center justify-center shrink-0">
                                {verifyType === 'phone' ? (
                                    <Phone size={18} className="text-surface-500" />
                                ) : (
                                    <Mail size={18} className="text-surface-500" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-black text-surface-900 mb-2">
                                    {verifyType === 'phone' ? '手机号验证码' : '邮箱验证码'}
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <InputText
                                            value={verifyCode}
                                            onChange={(e) => setVerifyCode(e.target.value)}
                                            placeholder="6位验证码"
                                            maxLength={6}
                                            className="w-full h-9 rounded-xl bg-surface-50 border border-surface-200 font-bold text-sm"
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={handleSendCode}
                                        disabled={sending || countdown > 0 || !canSend}
                                        className="h-9 px-4 rounded-xl bg-surface border border-surface-200 text-surface-700 font-black hover:border-primary-400 hover:text-primary-600 transition-all shrink-0"
                                    >
                                        {sending ? '发送中…' : countdown > 0 ? `${countdown}s` : '发送验证码'}
                                    </Button>
                                </div>
                                {currentContactValue && (
                                    <div className="text-xs text-surface-500 mt-1">
                                        将发送到：{verifyType === 'phone' ? maskPhone(currentContactValue) : maskEmail(currentContactValue)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 新密码 */}
                    <div className="flex items-center justify-between gap-3 py-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-2xl bg-surface-50 border border-surface-200 flex items-center justify-center shrink-0">
                                <Lock size={18} className="text-surface-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-black text-surface-900 mb-2">新密码</div>
                                <Password
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="设置新密码"
                                    toggleMask
                                    feedback={true}
                                    promptLabel="请输入密码"
                                    weakLabel="太弱"
                                    mediumLabel="一般"
                                    strongLabel="安全"
                                    className="w-full"
                                    pt={{
                                        root: { className: 'w-full' },
                                        input: {
                                            className: 'w-full h-9 rounded-xl bg-surface-50 border border-surface-200 font-bold text-sm'
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 确认新密码 */}
                    <div className="flex items-center justify-between gap-3 py-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-2xl bg-surface-50 border border-surface-200 flex items-center justify-center shrink-0">
                                <Lock size={18} className="text-surface-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-black text-surface-900 mb-2">确认新密码</div>
                                <Password
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="再次输入新密码"
                                    toggleMask
                                    feedback={false}
                                    className="w-full"
                                    pt={{
                                        root: { className: 'w-full' },
                                        input: {
                                            className: 'w-full h-9 rounded-xl bg-surface-50 border border-surface-200 font-bold text-sm'
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-3 flex justify-end">
                    <Button
                        type="submit"
                        loading={loading}
                        className="h-9 px-4 rounded-2xl bg-primary-500 border-none text-surface font-black active:scale-[0.98] transition-all"
                    >
                        保存修改
                    </Button>
                </div>
            </form>
        </div>
    );
}
