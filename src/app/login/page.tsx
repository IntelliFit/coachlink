'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Card } from 'primereact/card';
import { User } from 'lucide-react';
import { FloatLabel } from 'primereact/floatlabel';
import { Toast } from 'primereact/toast';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();
    const toast = useRef<Toast>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 模拟登录延迟
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 显示成功消息
            toast.current?.show({
                severity: 'success',
                summary: '登录成功',
                detail: '欢迎回来，正在跳转到仪表板...',
                life: 3000000
            });
            
            router.push('/dashboard');
            router.refresh();
        } catch (err: any) {
            setError(err.message || '登录失败');
            // 显示错误消息
            toast.current?.show({
                severity: 'error',
                summary: '登录失败',
                detail: err.message || '登录失败，请检查您的凭据',
                life: 5000
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className={`min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-300 p-4`}
        >
            <Toast ref={toast} />
            <Card
                title="登录 CoachLink 账户"
                className="w-full max-w-md shadow-xl rounded-2xl p-6 sm:p-8"
            >
                <div className="flex flex-col items-center mb-6">
                    <div className="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16 flex items-center justify-center mb-3">
                        <User className="text-gray-500" size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-center">智健联盟</h2>
                    <p className="text-center text-gray-600 dark:text-gray-300 mt-1">
                        专业教练订阅平台
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 text-red-700 bg-red-100 rounded-md">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="mb-2">
                    <div className='mb-10'>
                        <FloatLabel>
                            <InputText
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full"
                                placeholder=""
                            />
                            <label htmlFor="email">手机号</label>
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
                                feedback={false}
                            />
                            <label htmlFor="password">密码</label>
                        </FloatLabel>
                    </div>


                    <Button
                        type="submit"
                        label={loading ? '登录中...' : '登录'}
                        disabled={loading}
                        className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-lg transition"
                    />
                </form>

                <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-300">
                    还没有账户？{' '}
                    <button
                        onClick={() => router.push('/register')}
                        className="font-medium text-primary hover:underline"
                    >
                        立即注册
                    </button>
                </div>
            </Card>
        </div>
    );
}