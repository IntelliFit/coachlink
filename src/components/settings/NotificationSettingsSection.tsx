'use client';

import React from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Bell, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNotificationPermission } from '@/context/NotificationPermissionContext';
import { useSession } from 'next-auth/react';

export default function NotificationSettingsSection() {
    const { data: session } = useSession();
    const { supported, permission, pushLoading } = usePushNotifications();
    const { openDialog } = useNotificationPermission();

    if (!session?.user) {
        return null;
    }

    const getStatusInfo = () => {
        if (!supported) {
            return {
                icon: <XCircle size={20} className="text-surface-400" />,
                text: '当前环境不支持推送通知',
                color: 'text-surface-500',
            };
        }
        switch (permission) {
            case 'granted':
                return {
                    icon: <CheckCircle size={20} className="text-emerald-500" />,
                    text: '已开启',
                    color: 'text-emerald-600',
                };
            case 'denied':
                return {
                    icon: <XCircle size={20} className="text-rose-500" />,
                    text: '已拒绝',
                    color: 'text-rose-600',
                };
            default:
                return {
                    icon: <AlertCircle size={20} className="text-amber-500" />,
                    text: '未开启',
                    color: 'text-amber-600',
                };
        }
    };

    const statusInfo = getStatusInfo();

    return (
        <Card
            title={
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-50 rounded-xl">
                        <Bell size={20} className="text-primary-600" strokeWidth={2.5} />
                    </div>
                    <span className="text-lg font-bold text-surface-900">系统通知</span>
                </div>
            }
            className="shadow-sm"
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {statusInfo.icon}
                        <div>
                            <p className="font-semibold text-surface-900">推送通知状态</p>
                            <p className={`text-sm ${statusInfo.color}`}>{statusInfo.text}</p>
                        </div>
                    </div>
                    {supported && permission !== 'granted' && (
                        <Button
                            label={permission === 'denied' ? '去设置' : '开启通知'}
                            icon="pi pi-bell"
                            className="rounded-xl"
                            size="small"
                            disabled={pushLoading}
                            onClick={() => {
                                if (permission === 'denied') {
                                    // iOS/Android 引导用户去系统设置
                                    if (typeof window !== 'undefined') {
                                        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                                        if (isIOS) {
                                            alert('请在「设置」>「CoachLink」>「通知」中开启通知权限');
                                        } else {
                                            alert('请在「设置」>「应用」>「CoachLink」>「通知」中开启通知权限');
                                        }
                                    }
                                } else {
                                    openDialog();
                                }
                            }}
                        />
                    )}
                </div>

                {supported && (
                    <div className="pt-3 border-t border-surface-100 space-y-2">
                        <p className="text-sm text-surface-600">
                            开启后，即使应用在后台或锁屏，您也能及时收到：
                        </p>
                        <ul className="text-sm text-surface-500 space-y-1 list-disc list-inside">
                            <li>新消息提醒（来自教练或学员）</li>
                            <li>训练计划更新通知</li>
                            <li>系统重要消息</li>
                        </ul>
                    </div>
                )}

                {!supported && (
                    <div className="pt-3 border-t border-surface-100">
                        <p className="text-sm text-surface-500">
                            您的浏览器或设备不支持推送通知功能。
                        </p>
                    </div>
                )}

                {permission === 'denied' && (
                    <div className="pt-3 border-t border-surface-100">
                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                            <p className="text-sm text-amber-800 font-semibold mb-1">通知权限已被拒绝</p>
                            <p className="text-sm text-amber-700">
                                如需开启通知，请在系统设置中手动允许 CoachLink 的通知权限。
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}
