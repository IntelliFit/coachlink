'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Card } from 'primereact/card';
import { useTheme } from '@/context/ThemeContext';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();
    const { theme } = useTheme();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (error) throw error;

            // 登录成功，重定向到仪表板
            router.push('/dashboard');
            router.refresh();
        } catch (err: any) {
            setError(err.message || '登录失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <Card title="登录到 CoachLink">
                    {error && (
                        <div className="mb-4 p-3 rounded">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium mb-1">
                                邮箱
                            </label>
                            <InputText
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full"
                                placeholder="your@example.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium mb-1">
                                密码
                            </label>
                            <Password
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full"
                                placeholder="••••••••"
                                toggleMask
                                feedback={false}
                            />
                        </div>

                        <Button
                            type="submit"
                            label={loading ? '登录中...' : '登录'}
                            disabled={loading}
                            className="w-full"
                        />
                    </form>

                    <div className="mt-4 text-center">
                        <p>
                            还没有账户？{' '}
                            <button
                                onClick={() => router.push('/register')}
                                className="font-medium"
                            >
                                立即注册
                            </button>
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
}