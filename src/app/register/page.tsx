'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Card } from 'primereact/card';
import { User } from 'lucide-react';
import { FloatLabel } from 'primereact/floatlabel';
import { useToastContext } from '@/context/ToastContext';
import { authService } from '../service/authService';
import { smsService } from '../service/smsService';

export default function RegisterPage() {
    const [phone, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [countdown, setCountdown] = useState(0); // 验证码倒计时

    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const { showToast } = useToastContext();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            showToast({ severity: 'error', summary: '密码不匹配' });
            return;
        }

        setLoading(true);

        try {
            const res = await authService.register({
                phone: phone.trim(),
                password: password.trim(),
                verifyCode: verificationCode.trim(),
            });

            if (res) {
                showToast({ severity: 'success', summary: '注册成功' });
                router.push('/login');
            } else {
                showToast({ severity: 'error', summary: '注册失败' });
            }
        } catch (error) {
            // 726182
            showToast({ severity: 'error', summary: '注册失败', detail: error.message || '请稍后重试' });
        } finally {
            setLoading(false);
        }
    };

    const [sendingCode, setSendingCode] = useState(false);

    // 倒计时效果
    useMemo(() => {
        let timer: NodeJS.Timeout;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    // 开发模式使用模拟验证码
    const useMockSms = process.env.NODE_ENV === 'development';

    // 发送验证码
    const sendVerificationCode = async () => {
        if (!phone.trim()) {
            showToast({ severity: 'warn', summary: '请输入手机号' });
            return;
        }

        // 验证手机号格式
        if (!/^1[3-9]\d{9}$/.test(phone)) {
            showToast({ severity: 'warn', summary: '请输入正确的手机号' });
            return;
        }

        setSendingCode(true);
        try {
            if (useMockSms) {
                // 模拟模式：使用模拟验证码
                setCountdown(60);
                showToast({ severity: 'info', summary: '验证码已发送', detail: '模拟验证码：123456' });
            } else {
                // 生产模式：使用真实短信服务
                await smsService.sendVerificationCode({ phoneNumber: phone });
                setCountdown(60);
                showToast({ severity: 'success', summary: '验证码已发送，请注意查收' });
            }
        } catch (error: any) {
            console.error('发送验证码失败:', error);
            showToast({ severity: 'error', summary: '发送验证码失败', detail: error.message || '请稍后重试' });
        } finally {
            setSendingCode(false);
        }
    };


    return (
        <>

            {/* 注册表单 - 浮在最顶层 */}
            <div
                className={`fixed inset-0 min-h-screen flex items-center justify-center bg-gradient-to-r from-primary-200 to-primary-600 transition-colors duration-300 p-4 z-[51]`}
            >
                <div className="w-full max-w-md">
                    <div className="mb-6 flex flex-col items-center">
                        <img src="/favicon.jpg" alt="CoachLink Logo" className="h-20" />
                        <p className="mt-1 text-center text-surface-600 dark:text-surface-300">
                            专业教练订阅平台
                        </p>
                    </div>
                    <Card
                        title="加入 CoachLink"
                        className="w-full max-w-md shadow-xl rounded-2xl p-6 sm:p-8"
                    >

                        <form onSubmit={handleRegister} className="mb-2">
                            <div className='mb-10'>
                                <FloatLabel>
                                    <InputText
                                        id="phone"
                                        value={phone}
                                        onChange={(e) => setEmail(e.target.value)}
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

                            <Button
                                type="submit"
                                label='注册'
                                disabled={loading}
                                loading={loading}
                                className="w-full bg-primary hover:bg-primary/90 text-surface font-medium py-3 rounded-lg transition"
                            />
                        </form>

                        <div className="mt-6 text-center text-sm text-surface-600 dark:text-surface-300">
                            已有账户？{' '}
                            <button
                                onClick={() => router.push('/login')}
                                className="font-medium text-primary hover:underline"
                            >
                                立即登录
                            </button>
                        </div>
                    </Card>
                </div>
            </div>
        </>
    );
}