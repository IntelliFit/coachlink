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
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';

interface InvitationData {
    invitationCode: string;
    invitationMode: 'exclusive' | 'open';
    inviteUrl: string;
    inviteUrlExclusive: string;
    inviteUrlOpen: string;
    coach: {
        id: string;
        name: string;
        title: string | null;
        bio: string | null;
        avatarUrl: string | null;
        specialties: string[] | null;
        yearsExperience: number | null;
        totalStudents: number | null;
        rating: number | null;
    };
}

export default function InvitationSettingsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();

    const [data, setData] = useState<InvitationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [savingPoster, setSavingPoster] = useState<'exclusive' | 'open' | null>(null);

    const posterRefExclusive = React.useRef<HTMLDivElement | null>(null);
    const posterRefOpen = React.useRef<HTMLDivElement | null>(null);

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

    const handleCopyModeLink = async (mode: 'exclusive' | 'open') => {
        if (!data) return;
        const url = mode === 'exclusive' ? data.inviteUrlExclusive : data.inviteUrlOpen;
        try {
            await navigator.clipboard.writeText(url);
            showToast({ severity: 'success', summary: '成功', detail: `已复制${mode === 'exclusive' ? '专属' : '公开'}邀请链接` });
        } catch {
            showToast({ severity: 'error', summary: '错误', detail: '复制失败' });
        }
    };

    const savePoster = async (mode: 'exclusive' | 'open') => {
        if (!data) return;
        const target = mode === 'exclusive' ? posterRefExclusive.current : posterRefOpen.current;
        if (!target) return;
        setSavingPoster(mode);
        try {
            // Wait for fonts to be ready to avoid text cropping / fallback layout glitches
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fontsReady = (document as any)?.fonts?.ready;
                if (fontsReady) await fontsReady;
            } catch {}

            const rect = target.getBoundingClientRect();
            const canvas = await html2canvas(target, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                logging: false,
                removeContainer: true,
                // Ensure correct capture when page is scrolled
                scrollX: -window.scrollX,
                scrollY: -window.scrollY,
                // Fix some edge cases where html2canvas mis-measures bounds
                width: Math.ceil(rect.width),
                height: Math.ceil(rect.height),
                onclone: (doc) => {
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (doc.documentElement as any).style.webkitTextSizeAdjust = '100%';
                    } catch {}

                    const modeAttr = mode === 'exclusive' ? 'exclusive' : 'open';
                    const clonedRoot = doc.querySelector(
                        `[data-poster-root="${modeAttr}"]`,
                    ) as HTMLElement | null;
                    if (!clonedRoot) return;

                    const safeTexts = clonedRoot.querySelectorAll(
                        '[data-h2c-safe-text="1"]',
                    ) as NodeListOf<HTMLElement>;
                    safeTexts.forEach((el) => {
                        // Avoid top-crop in some mobile webviews by making line box taller and nudging down
                        el.style.display = 'inline-block';
                        el.style.overflow = 'visible';
                        el.style.lineHeight = '1.35';
                        el.style.paddingTop = '3px';
                        el.style.paddingBottom = '2px';
                        el.style.transform = 'translateY(1px)';
                    });

                    // During export, relax truncation overflow (ellipsis is less important than not clipping)
                    const truncs = clonedRoot.querySelectorAll('.truncate') as NodeListOf<HTMLElement>;
                    truncs.forEach((el) => {
                        el.style.overflow = 'visible';
                    });
                },
            });
            const filename = `coach-invite-${mode}-${data.invitationCode}.png`;

            // Prefer Blob download (more compatible than huge data URLs on some devices)
            const blob: Blob | null = await new Promise((resolve) =>
                canvas.toBlob((b) => resolve(b), 'image/png')
            );

            if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.click();
                URL.revokeObjectURL(url);
            } else {
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = filename;
                link.click();
            }
            showToast({ severity: 'success', summary: '已保存', detail: '邀请海报已保存到本地' });
        } catch (e) {
            console.error(e);
            showToast({ severity: 'error', summary: '保存失败', detail: '请重试或截图分享' });
        } finally {
            setSavingPoster(null);
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

            {/* 邀请海报 */}
            <Card
                title="邀请海报（社媒传播版）"
                subTitle="生成两张海报：专属模式（私域）与公开模式（公域），可分别投放不同渠道"
            >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Exclusive */}
                    <div className="bg-surface-0 border border-surface-200 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-surface-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <i className="pi pi-shield text-orange-500" />
                                <div className="font-semibold text-surface-900">专属海报</div>
                                <span className="text-xs px-2 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-100">
                                    学员订阅期内只看你
                                </span>
                            </div>
                            <Button
                                icon="pi pi-copy"
                                className="p-button-outlined p-button-sm"
                                onClick={() => handleCopyModeLink('exclusive')}
                                tooltip="复制专属邀请链接"
                            />
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="flex justify-center">
                                <div
                                    ref={posterRefExclusive}
                                    data-poster-root="exclusive"
                                    className="w-[360px] rounded-2xl overflow-hidden shadow-sm"
                                    style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}
                                >
                                    <div
                                        className="p-6"
                                        style={{
                                            color: '#0b1220',
                                            background:
                                                'radial-gradient(1200px 400px at 10% 0%, rgba(249,115,22,0.28) 0%, rgba(255,255,255,0) 55%), radial-gradient(900px 360px at 90% 10%, rgba(236,72,153,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg, #0b1220 0%, #111827 45%, #0b1220 100%)',
                                        }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div
                                                data-h2c-safe-text="1"
                                                className="text-xs font-semibold tracking-wide whitespace-nowrap leading-snug"
                                                style={{
                                                    color: 'rgba(255,255,255,0.9)',
                                                    paddingTop: '1px',
                                                    paddingBottom: '1px',
                                                    lineHeight: '1.2',
                                                }}
                                            >
                                                COACHLINK · 邀请加入训练
                                            </div>
                                            <div />
                                        </div>

                                        <div className="mt-5 flex items-center gap-4">
                                            <div
                                                className="w-14 h-14 rounded-2xl overflow-hidden"
                                                style={{
                                                    background: 'rgba(255,255,255,0.10)',
                                                    border: '1px solid rgba(255,255,255,0.15)',
                                                }}
                                            >
                                                {data?.coach?.avatarUrl ? (
                                                    <img
                                                        src={data.coach.avatarUrl}
                                                        alt="coach avatar"
                                                        className="w-full h-full object-cover"
                                                        crossOrigin="anonymous"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-white font-black text-xl">
                                                        {(data?.coach?.name || 'C').charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div
                                                    data-h2c-safe-text="1"
                                                    className="text-white text-xl font-black tracking-tight leading-snug truncate"
                                                    style={{ paddingTop: '1px', lineHeight: '1.15' }}
                                                >
                                                    {data?.coach?.name || '教练'}
                                                </div>
                                                <div className="text-sm mt-1 truncate" style={{ color: 'rgba(255,255,255,0.82)' }}>
                                                    {data?.coach?.title || '私人训练 / 体能提升'}
                                                </div>
                                                <div className="text-[12px] mt-1.5" style={{ color: 'rgba(255,255,255,0.70)' }}>
                                                    {data?.coach?.yearsExperience != null ? `训练经验 ${data.coach.yearsExperience} 年` : '在线指导 · 训练计划 · 打卡监督'}
                                                </div>
                                                <div className="text-[11px] mt-2 truncate" style={{ color: 'rgba(255,255,255,0.78)' }}>
                                                    {(data?.coach?.specialties && data.coach.specialties.length > 0)
                                                        ? data.coach.specialties.slice(0, 3).join(' · ')
                                                        : '训练计划 · 饮食建议 · 监督打卡'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.80)' }}>
                                            {data?.coach?.bio
                                                ? data.coach.bio.slice(0, 52) + (data.coach.bio.length > 52 ? '…' : '')
                                                : '一起科学训练：动作要领、训练计划、逐步加量，带你更稳更强。'}
                                        </div>

                                        <div className="mt-5 flex items-center gap-4 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                                            <div className="p-2 rounded-xl" style={{ background: '#ffffff' }}>
                                                <QRCodeSVG value={data?.inviteUrlExclusive || ''} size={84} level="M" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-white font-black text-base">扫码 · 立即注册</div>
                                                <div className="text-[12px] mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.74)' }}>
                                                    注册后可查看教练主页、训练内容与计划
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="px-6 py-4 text-[11px]" style={{ color: '#6b7280' }}>
                                        * 海报仅用于邀请注册，具体服务内容以教练主页展示为准
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    label={savingPoster === 'exclusive' ? '保存中...' : '保存专属海报'}
                                    icon={savingPoster === 'exclusive' ? 'pi pi-spin pi-spinner' : 'pi pi-download'}
                                    className="flex-1 bg-orange-600 border-orange-600 hover:bg-orange-700 hover:border-orange-700"
                                    onClick={() => savePoster('exclusive')}
                                    disabled={savingPoster !== null}
                                />
                                <Button
                                    label="复制专属链接"
                                    icon="pi pi-copy"
                                    outlined
                                    className="flex-1"
                                    onClick={() => handleCopyModeLink('exclusive')}
                                    disabled={savingPoster !== null}
                                />
                            </div>

                            <div className="text-xs text-surface-500 break-all font-mono bg-surface-50 border border-surface-200 rounded-lg p-3">
                                {data?.inviteUrlExclusive || ''}
                            </div>
                        </div>
                    </div>

                    {/* Open */}
                    <div className="bg-surface-0 border border-surface-200 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-surface-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <i className="pi pi-globe text-blue-500" />
                                <div className="font-semibold text-surface-900">公开海报</div>
                                <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                    学员可自由发现其他教练
                                </span>
                            </div>
                            <Button
                                icon="pi pi-copy"
                                className="p-button-outlined p-button-sm"
                                onClick={() => handleCopyModeLink('open')}
                                tooltip="复制公开邀请链接"
                            />
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="flex justify-center">
                                <div
                                    ref={posterRefOpen}
                                    data-poster-root="open"
                                    className="w-[360px] rounded-2xl overflow-hidden shadow-sm"
                                    style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}
                                >
                                    <div
                                        className="p-6"
                                        style={{
                                            color: '#0b1220',
                                            background:
                                                'radial-gradient(1100px 380px at 0% 0%, rgba(59,130,246,0.30) 0%, rgba(255,255,255,0) 55%), radial-gradient(900px 360px at 100% 10%, rgba(16,185,129,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg, #07111f 0%, #0b1220 55%, #07111f 100%)',
                                        }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div
                                                data-h2c-safe-text="1"
                                                className="text-xs font-semibold tracking-wide whitespace-nowrap leading-snug"
                                                style={{
                                                    color: 'rgba(255,255,255,0.9)',
                                                    paddingTop: '1px',
                                                    paddingBottom: '1px',
                                                    lineHeight: '1.2',
                                                }}
                                            >
                                                COACHLINK · 邀请加入训练
                                            </div>
                                            <div />
                                        </div>

                                        <div className="mt-5 flex items-center gap-4">
                                            <div
                                                className="w-14 h-14 rounded-2xl overflow-hidden"
                                                style={{
                                                    background: 'rgba(255,255,255,0.10)',
                                                    border: '1px solid rgba(255,255,255,0.15)',
                                                }}
                                            >
                                                {data?.coach?.avatarUrl ? (
                                                    <img
                                                        src={data.coach.avatarUrl}
                                                        alt="coach avatar"
                                                        className="w-full h-full object-cover"
                                                        crossOrigin="anonymous"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-white font-black text-xl">
                                                        {(data?.coach?.name || 'C').charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div
                                                    data-h2c-safe-text="1"
                                                    className="text-white text-xl font-black tracking-tight leading-snug truncate"
                                                    style={{ paddingTop: '1px', lineHeight: '1.15' }}
                                                >
                                                    {data?.coach?.name || '教练'}
                                                </div>
                                                <div className="text-sm mt-1 truncate" style={{ color: 'rgba(255,255,255,0.82)' }}>
                                                    {data?.coach?.title || '训练陪伴 / 目标达成'}
                                                </div>
                                                <div className="text-[12px] mt-1.5" style={{ color: 'rgba(255,255,255,0.70)' }}>
                                                    {data?.coach?.yearsExperience != null ? `训练经验 ${data.coach.yearsExperience} 年` : '在线指导 · 训练计划 · 打卡监督'}
                                                </div>
                                                <div className="text-[11px] mt-2 truncate" style={{ color: 'rgba(255,255,255,0.78)' }}>
                                                    {(data?.coach?.specialties && data.coach.specialties.length > 0)
                                                        ? data.coach.specialties.slice(0, 3).join(' · ')
                                                        : '科学训练 · 习惯养成 · 自我提升'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.80)' }}>
                                            {data?.coach?.bio
                                                ? data.coach.bio.slice(0, 52) + (data.coach.bio.length > 52 ? '…' : '')
                                                : '一起科学训练：动作要领、训练计划、逐步加量，带你更稳更强。'}
                                        </div>

                                        <div className="mt-5 flex items-center gap-4 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                                            <div className="p-2 rounded-xl" style={{ background: '#ffffff' }}>
                                                <QRCodeSVG value={data?.inviteUrlOpen || ''} size={84} level="M" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-white font-black text-base">扫码 · 立即注册</div>
                                                <div className="text-[12px] mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.74)' }}>
                                                    注册后可查看教练主页、训练内容与计划
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="px-6 py-4 text-[11px]" style={{ color: '#6b7280' }}>
                                        * 海报仅用于邀请注册，具体服务内容以教练主页展示为准
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    label={savingPoster === 'open' ? '保存中...' : '保存公开海报'}
                                    icon={savingPoster === 'open' ? 'pi pi-spin pi-spinner' : 'pi pi-download'}
                                    className="flex-1 bg-blue-600 border-blue-600 hover:bg-blue-700 hover:border-blue-700"
                                    onClick={() => savePoster('open')}
                                    disabled={savingPoster !== null}
                                />
                                <Button
                                    label="复制公开链接"
                                    icon="pi pi-copy"
                                    outlined
                                    className="flex-1"
                                    onClick={() => handleCopyModeLink('open')}
                                    disabled={savingPoster !== null}
                                />
                            </div>

                            <div className="text-xs text-surface-500 break-all font-mono bg-surface-50 border border-surface-200 rounded-lg p-3">
                                {data?.inviteUrlOpen || ''}
                            </div>
                        </div>
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
                            <p className="text-xs text-surface-500 mt-2 max-w-md">
                                注：上面的两张海报是“每个链接单独选择专属/公开”。这里的模式是教练全局默认值（用于未指定模式的老链接/手动输入邀请码注册）。
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
