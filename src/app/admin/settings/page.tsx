'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Dropdown } from 'primereact/dropdown';
import { ProgressSpinner } from 'primereact/progressspinner';
import { useToastContext } from '@/context/ToastContext';

interface PlatformSetting {
    id: string;
    key: string;
    value: any;
    description?: string;
}

const paymentModeOptions = [
    { label: '教练个人二维码', value: 'qrcode' },
    { label: '平台支付宝接口', value: 'alipay_api' },
    { label: '双模式（用户选择）', value: 'both' }
];

export default function AdminSettingsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [defaultPaymentMode, setDefaultPaymentMode] = useState<string>('qrcode');

    useEffect(() => {
        if (status === 'loading') return;

        if (!session?.user?.is_admin) {
            router.push('/');
            return;
        }

        loadSettings();
    }, [session, status]);

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

    const handleSave = async () => {
        try {
            setSaving(true);
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'payment_mode',
                    value: { default_mode: defaultPaymentMode }
                })
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
                            此设置决定学员订阅时默认使用的支付方式。教练可以有独立设置，会覆盖此全局设置。
                        </p>
                    </div>

                    <div className="bg-surface-100 p-4 rounded-lg">
                        <h4 className="font-semibold text-surface-800 mb-2">模式说明</h4>
                        <ul className="text-sm text-surface-600 space-y-1">
                            <li><strong>教练个人二维码</strong>：学员扫描教练上传的收款码付款</li>
                            <li><strong>平台支付宝接口</strong>：使用平台支付宝接口收款，款项进入平台账户</li>
                            <li><strong>双模式</strong>：学员可选择使用二维码或平台接口</li>
                        </ul>
                    </div>

                    <div className="border-t pt-4">
                        <Button
                            label="管理教练个人支付设置"
                            icon="pi pi-users"
                            className="p-button-outlined"
                            onClick={() => router.push('/admin/payments/coach-settings')}
                        />
                        <p className="text-xs text-surface-500 mt-2">
                            为特定教练设置独立的支付模式，覆盖全局默认设置
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <Button
                        label="保存设置"
                        icon="pi pi-save"
                        onClick={handleSave}
                        loading={saving}
                        className="p-button-primary"
                    />
                </div>
            </Card>

            <Card title="其他设置" className="mb-4">
                <p className="text-surface-500">更多平台设置即将推出...</p>
            </Card>
        </div>
    );
}
