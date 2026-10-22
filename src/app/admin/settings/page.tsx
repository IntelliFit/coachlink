'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Dropdown } from 'primereact/dropdown';
import { ProgressSpinner } from 'primereact/progressspinner';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { useToastContext } from '@/context/ToastContext';
import { userService } from '@/app/service/userService';

const paymentModeOptions = [
    { label: '教练个人二维码', value: 'qrcode' },
    { label: '平台支付宝接口', value: 'alipay_api' },
    { label: '双模式（用户选择）', value: 'both' },
];

type AdminCredentialState = {
    loginIdentifier: string | null;
    hasPassword: boolean;
    isActive: boolean;
    linkedPhone: string | null;
    linkedEmail: string | null;
    canUnbindPhone: boolean;
};

export default function AdminSettingsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [defaultPaymentMode, setDefaultPaymentMode] = useState<string>('qrcode');

    const [credentialLoading, setCredentialLoading] = useState(true);
    const [credentialSaving, setCredentialSaving] = useState(false);
    const [unbindingPhone, setUnbindingPhone] = useState(false);
    const [adminLoginIdentifier, setAdminLoginIdentifier] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [credentialState, setCredentialState] = useState<AdminCredentialState | null>(null);

    useEffect(() => {
        if (status === 'loading') return;

        if (!session?.user?.is_admin) {
            router.push('/');
            return;
        }

        void Promise.all([loadSettings(), loadAdminCredential()]);
    }, [session, status, router]);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/settings?key=payment_mode');
            const data = await res.json();

            if (data.success && data.data.settings.length > 0) {
                const paymentSetting = data.data.settings[0];
                setDefaultPaymentMode(paymentSetting.value?.default_mode || 'qrcode');
            }
        } catch (error) {
            console.error('加载设置失败:', error);
            showToast({ severity: 'error', summary: '错误', detail: '加载设置失败' });
        } finally {
            setLoading(false);
        }
    };

    const loadAdminCredential = async () => {
        try {
            setCredentialLoading(true);
            const res = await fetch('/api/admin/credential');
            const data = await res.json();

            if (data.success) {
                const nextState = data.data.credential as AdminCredentialState;
                setCredentialState(nextState);
                setAdminLoginIdentifier(nextState.loginIdentifier || '');
            } else {
                showToast({ severity: 'error', summary: '错误', detail: data.message || '加载管理员凭证失败' });
            }
        } catch (error) {
            console.error('加载管理员凭证失败:', error);
            showToast({ severity: 'error', summary: '错误', detail: '加载管理员凭证失败' });
        } finally {
            setCredentialLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'payment_mode',
                    value: { default_mode: defaultPaymentMode },
                }),
            });

            const data = await res.json();

            if (data.success) {
                showToast({ severity: 'success', summary: '成功', detail: '设置已保存' });
            } else {
                showToast({ severity: 'error', summary: '错误', detail: data.message });
            }
        } catch (error) {
            console.error('保存设置失败:', error);
            showToast({ severity: 'error', summary: '错误', detail: '保存设置失败' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveAdminCredential = async () => {
        if (!adminLoginIdentifier.trim()) {
            showToast({ severity: 'warn', summary: '请填写管理员登录账号' });
            return;
        }

        if (!adminPassword.trim()) {
            showToast({ severity: 'warn', summary: '请填写管理员密码' });
            return;
        }

        try {
            setCredentialSaving(true);
            const res = await fetch('/api/admin/credential', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    loginIdentifier: adminLoginIdentifier.trim(),
                    password: adminPassword,
                }),
            });
            const data = await res.json();

            if (!data.success) {
                showToast({ severity: 'error', summary: '错误', detail: data.message || '保存失败' });
                return;
            }

            setAdminPassword('');
            showToast({ severity: 'success', summary: '成功', detail: '管理员独立登录凭证已保存' });
            await loadAdminCredential();
        } catch (error) {
            console.error('保存管理员凭证失败:', error);
            showToast({ severity: 'error', summary: '错误', detail: '保存管理员凭证失败' });
        } finally {
            setCredentialSaving(false);
        }
    };

    const handleUnbindPhone = async () => {
        if (!credentialState?.linkedPhone) return;

        const confirmed = window.confirm(
            `解绑当前管理员手机号 ${credentialState.linkedPhone} 后，你就可以拿这个手机号去注册教练端或学员端。确定继续吗？`,
        );
        if (!confirmed) return;

        try {
            setUnbindingPhone(true);
            await userService.unbindContact({ type: 'phone' });
            showToast({ severity: 'success', summary: '成功', detail: '管理员手机号已解绑' });
            await loadAdminCredential();
        } catch (error: any) {
            showToast({ severity: 'error', summary: '解绑失败', detail: error?.message || '请稍后重试' });
        } finally {
            setUnbindingPhone(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <ProgressSpinner />
            </div>
        );
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-surface-900 mb-6">平台设置</h1>

            <Card title="支付设置" className="mb-4">
                <div className="grid gap-4">
                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-2">
                            全局默认支付模式
                        </label>
                        <Dropdown
                            value={defaultPaymentMode}
                            options={paymentModeOptions}
                            onChange={(e) => setDefaultPaymentMode(e.value)}
                            placeholder="选择支付模式"
                            className="w-full md:w-80"
                        />
                        <p className="text-sm text-surface-500 mt-2">
                            这项设置决定学员订阅时默认使用的支付方式，教练侧单独配置仍会覆盖这里。
                        </p>
                    </div>

                    <div className="border-t pt-4">
                        <Button
                            label="管理教练个人支付设置"
                            icon="pi pi-users"
                            className="p-button-outlined"
                            onClick={() => router.push('/admin/payments/coach-settings')}
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <Button
                        label="保存支付设置"
                        icon="pi pi-save"
                        onClick={handleSave}
                        loading={saving}
                        className="p-button-primary"
                    />
                </div>
            </Card>

            <Card title="管理端独立登录凭证" className="mb-4">
                {credentialLoading ? (
                    <div className="flex justify-center py-8">
                        <ProgressSpinner style={{ width: '40px', height: '40px' }} />
                    </div>
                ) : (
                    <div className="grid gap-4">
                        <div className="rounded-lg bg-surface-100 p-4 text-sm text-surface-700">
                            <p>管理端现在支持独立账号登录，入口是 `/admin/login`。</p>
                            <p className="mt-2">先配置这里的管理员账号和密码，再解绑原手机号，就能把手机号腾出来给教练端、学员端和注销功能测试。</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-2">
                                管理员登录账号
                            </label>
                            <InputText
                                value={adminLoginIdentifier}
                                onChange={(e) => setAdminLoginIdentifier(e.target.value)}
                                placeholder="例如 admin.main"
                                className="w-full md:w-96"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-2">
                                管理员密码
                            </label>
                            <Password
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                                toggleMask
                                feedback={false}
                                placeholder={credentialState?.hasPassword ? '输入新密码可覆盖旧密码' : '至少 8 位'}
                                pt={{
                                    root: { className: 'w-full md:w-96' },
                                    input: { className: 'w-full' },
                                }}
                            />
                        </div>

                        <div className="rounded-lg border border-surface-200 p-4 text-sm text-surface-700">
                            <p>当前绑定手机号：{credentialState?.linkedPhone || '未绑定'}</p>
                            <p className="mt-2">当前绑定邮箱：{credentialState?.linkedEmail || '未绑定'}</p>
                            <p className="mt-2">独立密码状态：{credentialState?.hasPassword ? '已设置' : '未设置'}</p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Button
                                label="保存管理员凭证"
                                icon="pi pi-save"
                                onClick={handleSaveAdminCredential}
                                loading={credentialSaving}
                                className="bg-[#B4553A] border-none hover:opacity-90"
                            />
                            <Button
                                label={credentialState?.linkedPhone ? `解绑手机号 ${credentialState.linkedPhone}` : '暂无手机号可解绑'}
                                icon="pi pi-mobile"
                                onClick={handleUnbindPhone}
                                loading={unbindingPhone}
                                disabled={!credentialState?.linkedPhone || !credentialState?.canUnbindPhone}
                                className="p-button-outlined"
                            />
                        </div>

                        {!credentialState?.canUnbindPhone && credentialState?.linkedPhone ? (
                            <p className="text-sm text-amber-600">
                                解绑手机号前，必须先配置独立管理员登录凭证，或至少保留一个邮箱登录方式。
                            </p>
                        ) : null}
                    </div>
                )}
            </Card>
        </div>
    );
}
