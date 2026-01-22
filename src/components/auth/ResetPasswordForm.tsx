'use client';

import { useState, useEffect } from 'react';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Button } from 'primereact/button';
import { useToastContext } from '@/context/ToastContext';
import { authService } from '@/app/service/authService';
import { smsService } from '@/app/service/smsService';
import SliderCaptcha from '@/components/auth/SliderCaptcha';
import { Phone, Lock, ShieldCheck, Send, RotateCcw } from 'lucide-react';

interface ResetPasswordFormProps {
    onBackToLogin: () => void;
    onSuccess: () => void;
}

export default function ResetPasswordForm({ onBackToLogin, onSuccess }: ResetPasswordFormProps) {
    const { showToast } = useToastContext();
    const [phone, setPhone] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [sendingCode, setSendingCode] = useState(false);
    const [sliderCaptchaVisible, setSliderCaptchaVisible] = useState(false);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    const handleCaptchaSuccess = async (token: string) => {
        setSendingCode(true);
        try {
            if (process.env.NODE_ENV === 'development') {
                setCountdown(60);
                showToast({ severity: 'info', summary: '验证码已发送', detail: '模拟验证码：123456' });
            } else {
                await smsService.sendVerificationCode({ phoneNumber: phone, captchaToken: token });
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
        if (!/^1[3-9]\d{9}$/.test(phone)) {
            showToast({ severity: 'warn', summary: '请输入正确的手机号' });
            return;
        }
        setSliderCaptchaVisible(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone || !verificationCode || !newPassword || !confirmPassword) {
            showToast({ severity: 'warn', summary: '请填写完整信息' });
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showToast({ severity: 'warn', summary: '两次输入的密码不一致' });
            return;
        }

        setLoading(true);
        try {
            await authService.resetPassword({
                phone: phone.trim(),
                verifyCode: verificationCode.trim(),
                newPassword: newPassword.trim(),
            });
            showToast({ severity: 'success', summary: '密码重置成功', detail: '请使用新密码登录' });
            onSuccess();
        } catch (error: any) {
            showToast({ severity: 'error', summary: '重置失败', detail: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
        <div className="w-full">
            <div className="mb-8 text-center md:text-left">
                <h2 className="text-2xl font-bold text-surface-900 mb-2">重置密码</h2>
                <p className="text-surface-500 text-sm">通过手机验证码找回您的密码</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
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
                            disabled={countdown > 0 || sendingCode || sliderCaptchaVisible || !phone}
                            className="px-5 rounded-2xl text-sm font-bold border border-primary-100 text-primary-600 hover:bg-primary-50 disabled:opacity-50 transition-all min-w-[120px] flex items-center justify-center gap-2"
                        >
                            {sendingCode ? '发送中...' : countdown > 0 ? `${countdown}s` : <><Send size={16} /> 获取</>}
                        </button>
                    </div>

                    {/* 新密码 */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center z-10 text-surface-400 group-focus-within:text-primary-500 transition-colors">
                            <Lock size={18} />
                        </div>
                        <Password
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="新密码"
                            toggleMask
                            feedback={true}
                            promptLabel="请输入密码"
                            weakLabel="太弱"
                            mediumLabel="一般"
                            strongLabel="安全"
                            pt={{
                                root: { className: 'w-full' },
                                input: {
                                    className: 'w-full pl-12 pr-12 py-3.5 bg-surface-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500/20 transition-all'
                                }
                            }}
                        />
                    </div>

                    {/* 确认新密码 */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center z-10 text-surface-400 group-focus-within:text-primary-500 transition-colors">
                            <Lock size={18} />
                        </div>
                        <Password
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="确认新密码"
                            toggleMask
                            feedback={false}
                            pt={{
                                root: { className: 'w-full' },
                                input: {
                                    className: 'w-full pl-12 pr-12 py-3.5 bg-surface-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500/20 transition-all'
                                }
                            }}
                        />
                    </div>
                </div>

                <div className="pt-4 flex flex-col gap-3">
                    <Button
                        type="submit"
                        loading={loading}
                        className="w-full py-4 bg-primary-500 border-none rounded-2xl shadow-lg shadow-primary-200 dark:shadow-primary-700 hover:bg-primary-600 transition-all transform active:scale-[0.98]"
                    >
                        <div className="flex items-center justify-center gap-2 w-full">
                            <RotateCcw size={20} />
                            <span className="font-bold text-lg">重置密码</span>
                        </div>
                    </Button>

                    <button
                        type="button"
                        onClick={onBackToLogin}
                        className="w-full py-3 text-surface-500 font-medium hover:text-surface-700 transition-colors"
                    >
                        返回登录
                    </button>
                </div>
            </form>
        </div>
        <SliderCaptcha
            visible={sliderCaptchaVisible}
            onHide={() => setSliderCaptchaVisible(false)}
            onSuccess={handleCaptchaSuccess}
        />
        </>
    );
}
