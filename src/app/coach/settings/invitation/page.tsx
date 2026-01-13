'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { InputSwitch } from 'primereact/inputswitch';
import { ProgressSpinner } from 'primereact/progressspinner';
import { useToastContext } from '@/context/ToastContext';

interface InvitationData {
    invitationCode: string;
    invitationMode: 'exclusive' | 'open';
    inviteUrl: string;
}

export default function InvitationSettingsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();

    const [data, setData] = useState<InvitationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);
    const [updating, setUpdating] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch('/api/coach/invitation-code');
            const json = await res.json();
            if (json.success && json.data) {
                setData(json.data);
            }
        } catch (error) {
            console.error('获取邀请码失败:', error);
            showToast({ severity: 'error', summary: '错误', detail: '获取邀请码失败' });
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        if (status === 'loading') return;
        if (!session?.user?.id) {
            router.push('/login');
            return;
        }
        fetchData();
    }, [session, status, router, fetchData]);

    const handleCopyCode = async () => {
        if (!data?.invitationCode) return;
        try {
            await navigator.clipboard.writeText(data.invitationCode);
            showToast({ severity: 'success', summary: '成功', detail: '邀请码已复制' });
        } catch {
            showToast({ severity: 'error', summary: '错误', detail: '复制失败' });
        }
    };

    const handleCopyLink = async () => {
        if (!data?.inviteUrl) return;
        try {
            await navigator.clipboard.writeText(data.inviteUrl);
            showToast({ severity: 'success', summary: '成功', detail: '邀请链接已复制' });
        } catch {
            showToast({ severity: 'error', summary: '错误', detail: '复制失败' });
        }
    };

    const handleRegenerate = async () => {
        setRegenerating(true);
        try {
            const res = await fetch('/api/coach/invitation-code', { method: 'POST' });
            const json = await res.json();
            if (json.success && json.data) {
                setData(prev => prev ? { ...prev, ...json.data } : json.data);
                showToast({ severity: 'success', summary: '成功', detail: '邀请码已重新生成' });
            } else {
                showToast({ severity: 'error', summary: '错误', detail: json.message || '重新生成失败' });
            }
        } catch {
            showToast({ severity: 'error', summary: '错误', detail: '重新生成失败' });
        } finally {
            setRegenerating(false);
        }
    };

    const handleModeChange = async (isExclusive: boolean) => {
        setUpdating(true);
        try {
            const res = await fetch('/api/coach/invitation-code', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invitationMode: isExclusive ? 'exclusive' : 'open' }),
            });
            const json = await res.json();
            if (json.success) {
                setData(prev => prev ? { ...prev, invitationMode: isExclusive ? 'exclusive' : 'open' } : null);
                showToast({ severity: 'success', summary: '成功', detail: json.message });
            } else {
                showToast({ severity: 'error', summary: '错误', detail: json.message || '更新失败' });
            }
        } catch {
            showToast({ severity: 'error', summary: '错误', detail: '更新失败' });
        } finally {
            setUpdating(false);
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
        <div className="space-y-6">
            {/* 邀请码卡片 */}
            <Card title="我的邀请码" subTitle="分享此邀请码或链接，学员注册后将自动与您建立关联">
                <div className="space-y-4">
                    {/* 邀请码显示 */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-2">邀请码</label>
                        <div className="flex gap-2">
                            <InputText
                                value={data?.invitationCode || ''}
                                readOnly
                                className="flex-1 text-center font-mono text-lg tracking-widest"
                            />
                            <Button
                                icon="pi pi-copy"
                                className="p-button-outlined"
                                onClick={handleCopyCode}
                                tooltip="复制邀请码"
                            />
                            <Button
                                icon={regenerating ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'}
                                className="p-button-outlined"
                                onClick={handleRegenerate}
                                disabled={regenerating}
                                tooltip="重新生成"
                            />
                        </div>
                    </div>

                    {/* 邀请链接 */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-2">邀请链接</label>
                        <div className="flex gap-2">
                            <InputText
                                value={data?.inviteUrl || ''}
                                readOnly
                                className="flex-1 text-sm text-surface-500"
                            />
                            <Button
                                icon="pi pi-copy"
                                className="p-button-outlined"
                                onClick={handleCopyLink}
                                tooltip="复制链接"
                            />
                        </div>
                        <p className="text-xs text-surface-500 mt-1">
                            学员访问此链接后注册，将自动与您关联
                        </p>
                    </div>
                </div>
            </Card>

            {/* 邀请模式设置 */}
            <Card title="邀请模式" subTitle="控制通过您邀请码注册的学员在平台上的可见范围">
                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-surface-50 rounded-lg">
                        <div>
                            <div className="flex items-center gap-2">
                                <i className={`pi ${data?.invitationMode === 'exclusive' ? 'pi-shield text-orange-500' : 'pi-globe text-blue-500'}`}></i>
                                <span className="font-medium">
                                    {data?.invitationMode === 'exclusive' ? '专属模式' : '开放模式'}
                                </span>
                            </div>
                            <p className="text-sm text-surface-500 mt-1 max-w-md">
                                {data?.invitationMode === 'exclusive' 
                                    ? '学员在订阅期内只能看到您的信息，有效防止学员流失'
                                    : '学员可以自由浏览平台所有教练，适合开放推广场景'
                                }
                            </p>
                        </div>
                        <InputSwitch
                            checked={data?.invitationMode === 'exclusive'}
                            onChange={(e) => handleModeChange(e.value)}
                            disabled={updating}
                        />
                    </div>

                    {/* 模式说明 */}
                    <div className="p-4 bg-surface-100 rounded-lg">
                        <h4 className="font-semibold text-surface-800 mb-3">模式说明</h4>
                        <ul className="space-y-3 text-sm text-surface-600">
                            <li className="flex items-start gap-2">
                                <i className="pi pi-shield text-orange-500 mt-0.5"></i>
                                <span><strong>专属模式</strong>：通过您邀请码注册的学员，在订阅期内只能看到您的内容、计划和信息。订阅结束后自动解锁。</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <i className="pi pi-globe text-blue-500 mt-0.5"></i>
                                <span><strong>开放模式</strong>：学员可以自由浏览平台所有教练和内容，适合希望开放推广的场景。</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </Card>
        </div>
    );
}
