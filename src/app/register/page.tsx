'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Card } from 'primereact/card';
import { User } from 'lucide-react';
import { FloatLabel } from 'primereact/floatlabel';

export default function RegisterPage() {
    const [phone, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError('密码不匹配');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // 模拟注册延迟
            await new Promise(resolve => setTimeout(resolve, 1000));

            if (error) throw error;

            setSuccess(true);
        } catch (err: any) {
            setError(err.message || '注册失败');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <>
                {/* 遮罩层 - 模糊背景 */}
                <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-50" />

                {/* 成功页面 - 浮在最顶层 */}
                <div className="fixed inset-0 min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-300 p-4 z-[51]">
                    <div className="w-full max-w-md">
                        <Card title="注册成功" className="text-center bg-white dark:bg-gray-800">
                            <div className="flex flex-col items-center mb-6">
                                <div className="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16 flex items-center justify-center mb-3">
                                    <User className="text-gray-500" size={24} />
                                </div>
                                <h2 className="text-xl font-bold text-center">欢迎加入</h2>
                                <p className="text-center text-gray-600 dark:text-gray-300 mt-1">
                                    请检查您的邮箱以确认账户。
                                </p>
                            </div>
                            <Button
                                label="前往登录"
                                onClick={() => router.push('/login')}
                                className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-lg transition"
                            />
                        </Card>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            {/* 遮罩层 - 模糊背景 */}
            <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-50" />

            {/* 注册表单 - 浮在最顶层 */}
            <div
                className={`fixed inset-0 min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-300 p-4 z-[51]`}
            >
                <div className="w-full max-w-md">
                    <div className="mb-6 flex flex-col items-center">
                        <img src="/favicon.jpg" alt="CoachLink Logo" className="h-20" />
                        <h2 className="mt-3 text-xl font-bold text-center text-gray-900 dark:text-white">
                            CoachLink - 智健联盟
                        </h2>
                        <p className="mt-1 text-center text-gray-600 dark:text-gray-300">
                            专业教练订阅平台
                        </p>
                    </div>
                    <Card
                        title="加入 CoachLink"
                        className="w-full max-w-md shadow-xl rounded-2xl p-6 sm:p-8 login-card"
                    >
                        {/* Logo + 标题 */}


                        {error && (
                            <div className="mb-4 p-3 text-red-700 bg-red-100 rounded-md">
                                {error}
                            </div>
                        )}

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
                                        feedback={false}
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

                            <Button
                                type="submit"
                                label={loading ? '注册中...' : '注册'}
                                disabled={loading}
                                className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-lg transition"
                            />
                        </form>

                        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-300">
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