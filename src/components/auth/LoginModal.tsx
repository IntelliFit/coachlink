'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { FloatLabel } from 'primereact/floatlabel';
import { useToastContext } from '@/context/ToastContext';
import { signIn } from 'next-auth/react';
import { smsService } from '@/app/service/smsService';

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
    const [countdown, setCountdown] = useState(0); // 验证码倒计时
    const [sendingCode, setSendingCode] = useState(false); // 发送验证码状态

    // 从环境变量读取开发账号
    const devUsers = useMemo<DevUser[]>(() => {
        try {
            const envValue = process.env.NEXT_PUBLIC_DEV_USERS;
            if (envValue) {
                return JSON.parse(envValue);
            }
        } catch (e) {
            console.error('Failed to parse NEXT_PUBLIC_DEV_USERS:', e);
        }
        return [];
    }, []);

    // 倒计时效果
    useMemo(() => {
        let timer: NodeJS.Timeout;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

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
            await smsService.sendVerificationCode({ phoneNumber: phone });
            setCountdown(60); // 设置60秒倒计时
            showToast({ severity: 'success', summary: '验证码已发送，请注意查收' });
        } catch (error: any) {
            console.error('发送验证码失败:', error);
            showToast({ severity: 'error', summary: '发送验证码失败', detail: error.message || '请稍后重试' });
        } finally {
            setSendingCode(false);
        }
    };

    const handleLogin = async (e?: React.FormEvent) => {
        e?.preventDefault();

        if (!phone.trim() || !password.trim() || !verificationCode.trim()) {
            showToast({ severity: 'warn', summary: '请输入手机号、密码和验证码' });
            return;
        }

        // 验证手机号格式
        if (!/^1[3-9]\d{9}$/.test(phone)) {
            showToast({ severity: 'warn', summary: '请输入正确的手机号' });
            return;
        }

        // 验证验证码格式
        if (!/^\d{6}$/.test(verificationCode)) {
            showToast({ severity: 'warn', summary: '请输入6位数字验证码' });
            return;
        }

        setLoading(true);

        try {

            // 验证码正确，执行登录
            const result = await signIn('credentials', {
                phone: phone.trim(),
                password: password.trim(),
                verifyCode: verificationCode.trim(), // 传递验证码给后端
                redirect: false,
            });

            if (result?.error) {
                showToast({ severity: 'error', summary: '登录失败', detail: result.error });
            } else {
                showToast({ severity: 'success', summary: '登录成功' });
                onClose();
                router.refresh();
            }
        } catch (error) {            
            showToast({ severity: 'error', summary: '登录失败，请重试', detail: error.toString() });
        } finally {
            setLoading(false);
        }
    };

    // 快捷登录 - 点击直接登录
    const handleQuickLogin = async (user: DevUser) => {
        setLoading(true);
        try {
            const result = await signIn('credentials', {
                phone: user.phone,
                password: user.password,
                redirect: false,
            });

            if (result?.error) {
                showToast({ severity: 'error', summary: '登录失败', detail: result.error });
            } else {
                showToast({ severity: 'success', summary: '登录成功' });
                onClose();
                router.refresh();
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '登录失败，请重试' });
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = () => {
        onClose();
        router.push('/register');
    };

    const isDev = process.env.NODE_ENV === 'development';

    return (
        <Dialog
            visible={isOpen}
            onHide={onClose}
            dismissableMask
            showHeader={false}
            className="p-0 overflow-hidden"
            style={{ width: '800px', maxWidth: '95vw' }}
            contentClassName="p-0"
        >
            <div className="flex min-h-[500px]">
                {/* 左侧品牌区域 */}
                <div 
                    className="hidden md:flex flex-col justify-center items-center w-2/5 p-8"
                    style={{
                        background: 'linear-gradient(135deg, #fff5eb 0%, #ffe4c4 100%)'
                    }}
                >
                    <img 
                        src="/favicon.jpg" 
                        alt="CoachLink Logo" 
                        className="h-32 rounded-2xl shadow-lg mb-6"
                    />
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">
                        CoachLink - 智健联盟
                    </h1>
                    <p className="text-gray-600 text-sm mb-8">专业教练订阅平台</p>
                    
                    {/* 开发模式快捷登录 */}
                    {isDev && devUsers.length > 0 && (
                        <div className="w-full">
                            <p className="text-center text-sm text-gray-600 mb-3">开发模式快速登录:</p>
                            <div className="flex flex-wrap justify-center gap-2">
                                {devUsers.map((user, index) => (
                                    <Button
                                        key={index}
                                        label={user.name}
                                        outlined
                                        size="small"
                                        onClick={() => handleQuickLogin(user)}
                                        disabled={loading}
                                        className="text-xs"
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* 右侧表单区域 */}
                <div className="flex-1 p-8 flex flex-col justify-center relative bg-white">
                    {/* 关闭按钮 */}
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <i className="pi pi-times text-xl"></i>
                    </button>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <FloatLabel>
                            <InputText
                                id="login_phone"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full"
                                autoFocus
                            />
                            <label htmlFor="login_phone">手机号</label>
                        </FloatLabel>

                        <FloatLabel>
                            <Password
                                id="login_password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full"
                                toggleMask
                                feedback={false}
                            />
                            <label htmlFor="login_password">密码</label>
                        </FloatLabel>

                        <div className="flex gap-2">
                            <div className="flex-1">
                                <FloatLabel>
                                    <InputText
                                        id="login_code"
                                        value={verificationCode}
                                        onChange={(e) => setVerificationCode(e.target.value)}
                                        className="w-full"
                                        maxLength={6}
                                    />
                                    <label htmlFor="login_code">验证码</label>
                                </FloatLabel>
                            </div>
                            <Button
                                label={countdown > 0 ? `${countdown}秒后重发` : "获取验证码"}
                                onClick={sendVerificationCode}
                                disabled={countdown > 0 || sendingCode || !phone.trim()}
                                loading={sendingCode}
                                outlined
                                className="w-32"
                            />
                        </div>

                        <Button
                            label="登录"
                            onClick={handleLogin}
                            loading={loading}
                            className="w-full"
                            type="submit"
                        />

                        <div className="text-center text-sm text-gray-500">
                            还没有账户？{' '}
                            <button
                                onClick={handleRegister}
                                className="text-primary hover:underline font-medium"
                                type="button"
                            >
                                立即注册
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Dialog>
    );
}