'use client';

import React from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Bell, Smartphone, Shield } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToastContext } from '@/context/ToastContext';

interface NotificationPermissionDialogProps {
    visible: boolean;
    onHide: () => void;
}

export default function NotificationPermissionDialog({
    visible,
    onHide,
}: NotificationPermissionDialogProps) {
    const { supported, permission, pushLoading, requestAndSubscribe } = usePushNotifications();
    const { showToast } = useToastContext();

    // 检测是否为 iOS
    const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    // 检测是否为 Android
    const isAndroid = typeof window !== 'undefined' && /Android/.test(navigator.userAgent);
    // 检测是否为 PWA（已加主屏）
    const isPWA = typeof window !== 'undefined' && 
        ((typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) || 
         (window.navigator as any).standalone === true);

    const handleEnable = async () => {
        const res = await requestAndSubscribe();
        if (res?.ok) {
            showToast({ severity: 'success', summary: '已开启', detail: '系统通知已开启，您将及时收到新消息' });
            onHide();
        } else if (res && !res.ok && res.reason) {
            showToast({ severity: 'warn', summary: '提示', detail: res.reason });
        }
    };

    if (!supported) {
        return null;
    }

    return (
        <Dialog
            header={
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-50 rounded-xl">
                        <Bell size={24} className="text-primary-600" strokeWidth={2.5} />
                    </div>
                    <span className="text-xl font-black text-surface-900">开启系统通知</span>
                </div>
            }
            visible={visible}
            onHide={onHide}
            modal
            draggable={false}
            className="w-[min(92vw,520px)]"
            pt={{
                root: { className: 'rounded-2xl border-none shadow-2xl' },
                header: { className: 'px-6 pt-6 pb-4 border-b border-surface-100' },
                content: { className: 'px-6 py-6' },
                footer: { className: 'px-6 pb-6 pt-4 border-t border-surface-100' },
            }}
            footer={
                <div className="flex flex-col gap-3 w-full">
                    <Button
                        label={pushLoading ? '开通中…' : '立即开启'}
                        icon="pi pi-bell"
                        className="w-full rounded-xl font-bold"
                        loading={pushLoading}
                        disabled={pushLoading || permission === 'denied'}
                        onClick={handleEnable}
                    />
                    {permission !== 'denied' && (
                        <Button
                            label="稍后再说"
                            className="w-full rounded-xl p-button-text"
                            onClick={onHide}
                            disabled={pushLoading}
                        />
                    )}
                </div>
            }
        >
            <div className="space-y-4">
                {/* 主要说明 */}
                <div className="space-y-2">
                    <p className="text-base text-surface-700 leading-relaxed">
                        开启系统通知后，即使应用在后台或锁屏，您也能及时收到新消息提醒。
                    </p>
                    <p className="text-sm text-surface-500">
                        通知将显示在锁屏界面和通知栏中，点击即可快速打开应用查看消息。
                    </p>
                </div>

                {/* 平台特定提示 */}
                {(isIOS || isAndroid) && (
                    <div className="p-4 rounded-xl bg-surface-50 border border-surface-200 space-y-3">
                        {isIOS && (
                            <div className="flex items-start gap-3">
                                <Smartphone size={20} className="text-primary-500 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 text-sm text-surface-700">
                                    <p className="font-semibold mb-1">iOS 用户：</p>
                                    <p className="text-surface-600">
                                        {isPWA 
                                            ? '请点击「允许」以开启通知权限。'
                                            : '请先将 CoachLink 添加到主屏幕（PWA），然后重新打开应用开启通知。'}
                                    </p>
                                </div>
                            </div>
                        )}
                        {isAndroid && (
                            <div className="flex items-start gap-3">
                                <Shield size={20} className="text-primary-500 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 text-sm text-surface-700">
                                    <p className="font-semibold mb-1">Android 用户：</p>
                                    <p className="text-surface-600">
                                        点击「立即开启」后，系统会弹出权限请求，请选择「允许」以开启通知权限。
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 权限被拒绝的提示 */}
                {permission === 'denied' && (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                        <p className="text-sm text-amber-800 font-semibold mb-1">通知权限已被拒绝</p>
                        <p className="text-sm text-amber-700">
                            如需开启通知，请在系统设置中手动允许 CoachLink 的通知权限。
                        </p>
                    </div>
                )}

                {/* 功能说明 */}
                <div className="pt-2 space-y-2">
                    <p className="text-sm font-semibold text-surface-700">开启后您将收到：</p>
                    <ul className="text-sm text-surface-600 space-y-1.5 list-disc list-inside">
                        <li>新消息提醒（来自教练或学员）</li>
                        <li>训练计划更新通知</li>
                        <li>系统重要消息</li>
                    </ul>
                </div>
            </div>
        </Dialog>
    );
}
