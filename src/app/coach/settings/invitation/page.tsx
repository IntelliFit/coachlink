'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Skeleton } from 'primereact/skeleton'; // 替换 Spinner 为骨架屏
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { useToastContext } from '@/context/ToastContext';
import { coachService } from '@/app/service/coachService';
import { GetCoachResponseDto } from '@/app/api/coach/get-coach/entity';

// 导入拆分后的组件
import { InvitationCodeCard } from './InvitationCodeCard';
import { InvitationPosterCard } from './InvitationPosterCard';
import { InvitationModeCard } from './InvitationModeCard';

export default function InvitationSettingsPage() {
    const { data: session, status } = useSession();
    const { showToast } = useToastContext();

    const [coach, setCoach] = useState<GetCoachResponseDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [manualCode, setManualCode] = useState('');
    const [showManualInput, setShowManualInput] = useState(false);
    const [isSavingManualCode, setIsSavingManualCode] = useState(false);

    const fetchData = useCallback(async () => {
        if (!session?.user?.id) return;
        try {
            const res = await coachService.getCoach({ userId: session.user.id, needInvitationInfo: true });
            if (res) setCoach(res);
        } catch (error) {
            showToast({ severity: 'error', summary: '获取失败', detail: '无法同步邀请数据' });
        } finally {
            setLoading(false);
        }
    }, [session, showToast]);

    useEffect(() => {
        if (status !== 'loading') fetchData();
    }, [status, fetchData]);

    const handleCopyText = async (text: string, msg: string) => {
        try {
            await navigator.clipboard.writeText(text);
            showToast({ severity: 'success', summary: '已复制', detail: msg });
        } catch {
            showToast({ severity: 'error', summary: '操作失败', detail: '浏览器暂不支持剪贴板访问' });
        }
    };

    const handleSaveManualCode = async () => {
        if (!/^\d{3,8}$/.test(manualCode)) {
            showToast({ severity: 'warn', summary: '校验未通过', detail: '邀请码需为 3-8 位纯数字' });
            return;
        }

        confirmDialog({
            header: '确认锁定邀请码',
            message: `您即将设置邀请码为 "${manualCode}"。设置后将无法二次修改，是否确认？`,
            icon: 'pi pi-exclamation-circle',
            acceptLabel: '确认设置',
            rejectLabel: '再想想',
            acceptClassName: 'p-button-primary rounded-xl active:scale-[0.98]',
            rejectClassName: 'p-button-text text-surface-500 rounded-xl',
            accept: async () => {
                setIsSavingManualCode(true);
                const res = await coachService.updateCoachProfile({ userId: session!.user.id, invitationCode: manualCode });
                if (res.data.success) {
                    await fetchData();
                    setShowManualInput(false);
                    showToast({ severity: 'success', summary: '设置生效' });
                }
                setIsSavingManualCode(false);
            }
        });
    };

    // 骨架屏：遵循 1:1 布局预占位哲学
    if (loading) return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-surface p-8 border border-surface-100 rounded-[24px] space-y-4">
                <Skeleton width="30%" height="1.5rem" borderRadius="12px" />
                <Skeleton width="100%" height="4rem" borderRadius="16px" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Skeleton height="20rem" borderRadius="24px" />
                <Skeleton height="20rem" borderRadius="24px" />
            </div>
            <Skeleton height="8rem" borderRadius="24px" />
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* 全局确认对话框容器，样式已由自定义规范处理 */}
            <ConfirmDialog pt={{
                root: { className: 'rounded-[24px] border-none shadow-2xl' },
                header: { className: 'pt-8 px-8 font-black tracking-tight text-xl border-none' },
                content: { className: 'px-8 pb-4 text-surface-500' },
                footer: { className: 'p-8 border-none flex gap-2' }
            }} />

            <section className="relative transition-all duration-300">
                <InvitationCodeCard
                    coach={coach}
                    showManualInput={showManualInput}
                    manualCode={manualCode}
                    isSavingManualCode={isSavingManualCode}
                    setShowManualInput={setShowManualInput}
                    setManualCode={setManualCode}
                    handleCopyCode={() => handleCopyText(coach?.invitationInfo.invitationCode || '', '专属邀请码已复制到剪贴板')}
                    handleCopyLink={() => handleCopyText(coach?.invitationInfo.inviteUrl || '', '快捷注册链接已复制')}
                    handleSaveManualCode={handleSaveManualCode}
                />
            </section>

            <section className="relative transition-all duration-300">
                <InvitationPosterCard
                    coach={coach}
                />
            </section>

            <section className="relative transition-all duration-300">
                <InvitationModeCard
                    mode={coach?.invitationInfo.invitationMode || 'open'}
                    updating={updating}
                    onModeChange={async (val) => {
                        setUpdating(true);
                        await coachService.updateCoachProfile({ userId: session!.user.id, invitationMode: val ? 'exclusive' : 'open' });
                        await fetchData();
                        setUpdating(false);
                    }}
                />
            </section>
        </div>
    );
}