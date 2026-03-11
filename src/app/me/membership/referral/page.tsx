'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { useToastContext } from '@/context/ToastContext';
import { Copy, Gift, Users, Download } from 'lucide-react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';

interface InviteInfo {
    inviteCode: string;
    inviteLink: string;
    shareText: string;
    inviter?: {
        nickname: string | null;
        avatarUrl: string | null;
    };
    posterStats?: {
        trainingDays: number;
        totalTrainings: number;
        totalSets: number;
        monthPrCount: number;
        latestPr?: {
            exerciseName: string;
            weight: number | null;
            reps: number | null;
            e1rm: number | null;
            loadFormula: string | null;
            dateAchieved: string | null;
        } | null;
    };
}

export default function ReferralPage() {
    const { showToast } = useToastContext();
    const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
    const [stats, setStats] = useState<{
        invites: number;
        rewardedAi: number;
        rewardedStorageMb: number;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const posterRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const fetchInvite = async () => {
            try {
                const [inviteRes, statsRes] = await Promise.all([
                    axios.post('/api/membership/referral/create-invite'),
                    axios.post('/api/membership/referral/stats'),
                ]);

                if (inviteRes.data && inviteRes.data.success) {
                    setInviteInfo(inviteRes.data.data);
                }
                if (statsRes.data && statsRes.data.success) {
                    setStats(statsRes.data.data);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchInvite();
    }, []);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast({
            severity: 'success',
            summary: "已复制到剪贴板",
            detail: "快去分享给好友吧！",
        });
    };

    const savePoster = async () => {
        if (!posterRef.current) return;
        try {
            const canvas = await html2canvas(posterRef.current, {
                // Use a solid background to avoid theme CSS variables / unsupported color functions.
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                logging: false,
                removeContainer: true,
            });
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `coachlink-invite-${inviteInfo?.inviteCode || 'poster'}.png`;
            link.click();
            showToast({ severity: 'success', summary: '已保存', detail: '邀请海报已保存到本地' });
        } catch (e) {
            console.error(e);
            showToast({ severity: 'error', summary: '保存失败', detail: '请重试或截图分享' });
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-96"><i className="pi pi-spin pi-spinner text-4xl text-primary-500"></i></div>;
    }

    return (
        <div className="container mx-auto p-4 max-w-2xl py-10 space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">邀请有礼</h1>
                <p className="text-surface-500">邀请好友注册，一起变强，双方均获「AI 导入 +2 次」与「存储 +200MB」奖励</p>
            </div>

            <div className="bg-surface-0 border border-orange-200 shadow-lg rounded-xl overflow-hidden">
                <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 border-b border-orange-100">
                    <h3 className="flex items-center gap-2 text-orange-700 text-lg font-semibold">
                        <Gift className="w-6 h-6" />
                        我的邀请海报（推荐发朋友圈/群聊）
                    </h3>
                </div>
                <div className="space-y-6 p-6">
                    <div className="flex justify-center">
                        <div
                            ref={posterRef}
                            // IMPORTANT: keep poster styles self-contained & simple (avoid theme CSS vars)
                            className="w-[320px] rounded-2xl overflow-hidden shadow-sm"
                            style={{
                                background: '#ffffff',
                                border: '1px solid #e5e7eb',
                            }}
                        >
                            <div
                                className="p-5"
                                style={{
                                    color: '#ffffff',
                                    background: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-full overflow-hidden"
                                        style={{ background: 'rgba(255,255,255,0.25)' }}
                                    >
                                        {inviteInfo?.inviter?.avatarUrl ? (
                                            <img
                                                src={inviteInfo.inviter.avatarUrl}
                                                alt="avatar"
                                                className="w-full h-full object-cover"
                                                crossOrigin="anonymous"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center font-black">
                                                {(inviteInfo?.inviter?.nickname || '我')?.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-[16px] font-black leading-tight">
                                            {(inviteInfo?.inviter?.nickname || '我')} 的训练战报
                                        </div>
                                        <div className="text-[12px] opacity-95 mt-0.5">
                                            截止今日 · 累计在 CoachLink 训练 {inviteInfo?.posterStats?.trainingDays ?? 0} 天
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-5 flex items-center gap-4">
                                <div
                                    className="p-2 rounded-xl"
                                    style={{ background: '#ffffff', border: '1px solid #f3f4f6' }}
                                >
                                    <QRCodeSVG value={inviteInfo?.inviteLink || ''} size={96} level="M" />
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold" style={{ color: '#111827' }}>微信扫码注册</div>
                                    <div className="text-xs mt-1" style={{ color: '#6b7280' }}>
                                        24 小时内有效 · 单日上限 10 次
                                    </div>

                                    {/* A/B: default A; if PR exists, show B headline */}
                                    {inviteInfo?.posterStats?.latestPr ? (
                                        <div className="mt-3 space-y-1">
                                            <div className="text-[11px] font-semibold" style={{ color: '#6b7280' }}>
                                                最新 PR（任意动作）
                                            </div>
                                            <div className="text-[14px] font-black leading-tight" style={{ color: '#111827' }}>
                                                {inviteInfo.posterStats.latestPr.exerciseName}
                                                {inviteInfo.posterStats.latestPr.weight != null && inviteInfo.posterStats.latestPr.reps != null
                                                    ? ` ${inviteInfo.posterStats.latestPr.weight}kg × ${inviteInfo.posterStats.latestPr.reps}`
                                                    : ''}
                                            </div>
                                            <div className="text-[11px]" style={{ color: '#374151' }}>
                                                本月 PR +{inviteInfo?.posterStats?.monthPrCount ?? 0} · 累计完成 {inviteInfo?.posterStats?.totalSets ?? 0} 组
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-3 space-y-1">
                                            <div className="text-[11px] font-semibold" style={{ color: '#6b7280' }}>
                                                坚持与训练量
                                            </div>
                                            <div className="text-[14px] font-black leading-tight" style={{ color: '#111827' }}>
                                                本月 PR +{inviteInfo?.posterStats?.monthPrCount ?? 0}
                                            </div>
                                            <div className="text-[11px]" style={{ color: '#374151' }}>
                                                累计完成训练 {inviteInfo?.posterStats?.totalTrainings ?? 0} 次 · {inviteInfo?.posterStats?.totalSets ?? 0} 组
                                            </div>
                                        </div>
                                    )}

                                    <div className="text-[10px] mt-3 break-all font-mono" style={{ color: '#9ca3af' }}>
                                        {inviteInfo?.inviteLink || ''}
                                    </div>
                                </div>
                            </div>
                            <div className="px-5 pb-5 text-[11px]" style={{ color: '#6b7280' }}>
                                * 扫码一起训练（注册完成后双方各获 AI 导入 +2 次 & 存储 +200MB）
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            label="保存邀请海报"
                            icon={<Download className="w-4 h-4 mr-2" />}
                            className="flex-1 bg-orange-600 border-orange-600 hover:bg-orange-700 hover:border-orange-700"
                            onClick={savePoster}
                        />
                        <Button
                            label="复制招募链接"
                            icon={<Copy className="w-4 h-4 mr-2" />}
                            outlined
                            className="flex-1"
                            onClick={() => copyToClipboard(inviteInfo?.inviteLink || '')}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-surface-700">招募链接（备用）</label>
                        <div className="flex gap-2">
                            <InputText value={inviteInfo?.inviteLink || ''} readOnly className="font-mono text-sm bg-surface-50 w-full" />
                            <Button icon={<Copy className="w-4 h-4" />} outlined onClick={() => copyToClipboard(inviteInfo?.inviteLink || '')} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-surface-700">分享文案</label>
                        <div className="flex gap-2">
                            <InputTextarea 
                                className="font-mono bg-surface-50 w-full text-sm"
                                rows={3}
                                readOnly
                                value={inviteInfo?.shareText || ''}
                            />
                            <Button icon={<Copy className="w-4 h-4" />} outlined onClick={() => copyToClipboard(inviteInfo?.shareText || '')} className="h-auto" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface-0 border border-surface-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-surface-900 font-semibold">
                        <Users className="w-4 h-4" />
                        累计邀请
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-surface-900">{stats?.invites || 0} <span className="text-sm font-normal text-surface-500">人</span></div>
                    </div>
                </div>
                <div className="bg-surface-0 border border-surface-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-surface-900 font-semibold">
                        <Gift className="w-4 h-4" />
                        获得奖励
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-surface-900">
                            +{stats?.rewardedAi || 0} <span className="text-sm font-normal text-surface-500">次AI导入</span>
                        </div>
                        <div className="text-sm font-semibold text-surface-700 mt-1">
                            +{stats?.rewardedStorageMb || 0} <span className="text-xs font-normal text-surface-500">MB 存储</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <p className="text-xs text-center text-surface-400">
                * 奖励将在好友完成注册后自动发放（智能导入次数 + 存储配额）。最终解释权归平台所有。
            </p>
        </div>
    );
}
