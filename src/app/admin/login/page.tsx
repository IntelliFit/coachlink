'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Button } from 'primereact/button';
import { ShieldCheck } from 'lucide-react';
import { waitForSessionReady } from '@/lib/auth/sessionSync';

export default function AdminLoginPage() {
    const router = useRouter();
    const [loginIdentifier, setLoginIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await signIn('credentials', {
                redirect: false,
                callbackUrl: '/admin/payments',
                adminLogin: loginIdentifier.trim(),
                adminPassword: password,
            });

            if (result?.error) {
                setError(result.error);
                return;
            }

            await waitForSessionReady();
            router.push('/admin/payments');
        } catch (err: any) {
            setError(err?.message || '管理员登录失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center px-6 py-12">
            <div className="w-full max-w-md rounded-[32px] border border-surface-200 bg-white p-8 shadow-xl shadow-black/5">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#CF6D4E]/10 text-[#CF6D4E]">
                        <ShieldCheck size={28} />
                    </div>
                    <h1 className="text-2xl font-black text-surface-900">管理端登录</h1>
                    <p className="mt-2 text-sm text-surface-500">
                        使用独立管理员凭证登录，不再占用教练或学员手机号。
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-bold text-surface-700">
                            管理员账号
                        </label>
                        <InputText
                            value={loginIdentifier}
                            onChange={(e) => setLoginIdentifier(e.target.value)}
                            placeholder="例如 admin.main"
                            className="w-full"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-bold text-surface-700">
                            管理员密码
                        </label>
                        <Password
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            toggleMask
                            feedback={false}
                            placeholder="请输入管理员密码"
                            pt={{
                                root: { className: 'w-full' },
                                input: { className: 'w-full' },
                            }}
                        />
                    </div>

                    {error ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                            {error}
                        </div>
                    ) : null}

                    <Button
                        type="submit"
                        loading={loading}
                        className="w-full border-none bg-[#B4553A] py-3 text-white hover:opacity-90"
                    >
                        登录管理端
                    </Button>
                </form>
            </div>
        </main>
    );
}
