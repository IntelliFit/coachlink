'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Card } from 'primereact/card';
import { FloatLabel } from 'primereact/floatlabel';
import { useToastContext } from '@/components/ToastContext';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoginSuccess?: () => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { showToast } = useToastContext();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 模拟登录延迟
            await new Promise(resolve => setTimeout(resolve, 1000));

            showToast({
                severity: 'success',
                summary: '登录成功',
                detail: '欢迎回来，正在跳转到仪表板...',
                life: 3000
            });

            // 关闭模态框
            onClose();
            
            // 如果提供了成功回调，则调用它
            if (onLoginSuccess) {
                onLoginSuccess();
            } else {
                // 否则重定向到仪表板
                router.push('/dashboard');
            }
            
            router.refresh();
        } catch (err: any) {
            showToast({
                severity: 'error',
                summary: '登录失败',
                detail: err.message || '登录失败，请检查您的凭据',
                life: 5000
            });
        } finally {
            setLoading(false);
        }
    };

    // 如果模态框未打开，则不渲染任何内容
    if (!isOpen) return null;

    return (
        <>
            {/* 遮罩层 - 点击返回上一页 */}
            <div
                className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-50"
                onClick={onClose}
            />

            {/* 居中容器 + 动画 */}
            <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
                <motion.div
                    onClick={(e) => e.stopPropagation()}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="w-full max-w-4xl"
                >
                    <Card className="shadow-xl rounded-2xl p-6 sm:p-8 relative login-card">
                        {/* 关闭按钮 */}
                        <button
                            onClick={onClose}
                            className="
                                absolute top-4 right-4 
                                text-gray-400 hover:text-gray-700 
                                dark:text-gray-300 dark:hover:text-white
                                transition-colors
                            "
                            aria-label="关闭"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* 关键部分：左右布局 */}
                        <div className="flex flex-col md:flex-row md:space-x-8 items-center justify-center">
                            {/* 左侧 Logo + 标题 */}
                            <div className="mb-6 md:mb-0 flex flex-col items-center text-center md:w-1/2">
                                <img src="/favicon.svg" alt="CoachLink Logo" className="h-20 md:h-[150px] mb-4" />
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    CoachLink - 智健联盟
                                </h2>
                                <p className="mt-2 text-gray-600 dark:text-gray-300">
                                    专业教练订阅平台
                                </p>
                            </div>

                            {/* 右侧 登录表单 */}
                            <div className="w-full md:w-1/2">
                                <form onSubmit={handleLogin} className="space-y-8">
                                    <div>
                                        <FloatLabel>
                                            <InputText
                                                id="phone"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                required
                                                className="w-full"
                                            />
                                            <label htmlFor="phone">手机号</label>
                                        </FloatLabel>
                                    </div>

                                    <div>
                                        <FloatLabel>
                                            <Password
                                                id="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                className="w-full"
                                                toggleMask
                                                feedback={false}
                                            />
                                            <label htmlFor="password">密码</label>
                                        </FloatLabel>
                                    </div>

                                    <div>
                                        <FloatLabel>
                                            <InputText
                                                id="verificationCode"
                                                value={verificationCode}
                                                onChange={(e) => setVerificationCode(e.target.value)}
                                                required
                                                className="w-full"
                                            />
                                            <label htmlFor="verificationCode">验证码</label>
                                        </FloatLabel>
                                    </div>

                                    <br />

                                    <Button
                                        type="submit"
                                        label={loading ? '登录中...' : '登录'}
                                        disabled={loading}
                                        className="
                                            w-full rounded-lg bg-primary py-3 
                                            text-white font-medium 
                                            transition-colors hover:bg-primary/90
                                        "
                                    />
                                </form>

                                <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-300">
                                    还没有账户？{' '}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onClose();
                                            router.push('/register');
                                        }}
                                        className="font-medium text-primary hover:underline"
                                    >
                                        立即注册
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Card>
                </motion.div>
            </div>
        </>
    );
}