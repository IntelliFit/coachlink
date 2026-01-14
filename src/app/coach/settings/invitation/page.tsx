'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { ProgressSpinner } from 'primereact/progressspinner';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { useToastContext } from '@/context/ToastContext';
import { coachService } from '@/app/service/coachService';
import { GetCoachResponseDto } from '@/app/api/coach/get-coach/entity';
import html2canvas from 'html2canvas';

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
    const [savingPoster, setSavingPoster] = useState<'exclusive' | 'open' | null>(null);
    const [manualCode, setManualCode] = useState('');
    const [showManualInput, setShowManualInput] = useState(false);
    const [isSavingManualCode, setIsSavingManualCode] = useState(false);

    const posterRefExclusive = useRef<HTMLDivElement>(null);
    const posterRefOpen = useRef<HTMLDivElement>(null);

    const fetchData = useCallback(async () => {
        if (!session?.user?.id) return;
        try {
            const res = await coachService.getCoach({ userId: session.user.id, needInvitationInfo: true });
            if (res) setCoach(res);
        } catch (error) {
            showToast({ severity: 'error', summary: '错误', detail: '获取邀请码失败' });
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
            showToast({ severity: 'success', summary: '成功', detail: msg });
        } catch {
            showToast({ severity: 'error', summary: '错误', detail: '复制失败' });
        }
    };

    const savePoster = async (mode: 'exclusive' | 'open') => {
        const target = mode === 'exclusive' ? posterRefExclusive.current : posterRefOpen.current;
        if (!target || !coach) return;
        setSavingPoster(mode);
        try {
            const canvas = await html2canvas(target, { useCORS: true, background: '#ffffff' });
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `coach-invite-${mode}-${coach.invitationInfo.invitationCode}.png`;
            link.click();
            showToast({ severity: 'success', summary: '已保存' });
        } catch (e) {
            showToast({ severity: 'error', summary: '保存失败' });
        } finally {
            setSavingPoster(null);
        }
    };

    const handleSaveManualCode = async () => {
        if (!/^\d{3,8}$/.test(manualCode)) {
            showToast({ severity: 'error', summary: '格式错误', detail: '邀请码必须是3-8位数字' });
            return;
        }

        

        confirmDialog({
            message: `确定要将邀请码设置为 "${manualCode}" 吗？设置后将无法更改！`,
            header: '确认修改',
            accept: async () => {
                setIsSavingManualCode(true);
                const res = await coachService.updateCoachProfile({ userId: session!.user.id, invitationCode: manualCode });
                if (res.data.success) {
                    await fetchData(); // 重新刷新数据
                    setShowManualInput(false);
                    showToast({ severity: 'success', summary: '设置成功' });
                }
                setIsSavingManualCode(false);
            }
        });
    };

    if (loading) return <div className="flex justify-center items-center h-64"><ProgressSpinner /></div>;

    return (
        <div className="space-y-6">
            <ConfirmDialog />
            
            <InvitationCodeCard 
                coach={coach}
                showManualInput={showManualInput}
                manualCode={manualCode}
                isSavingManualCode={isSavingManualCode}
                setShowManualInput={setShowManualInput}
                setManualCode={setManualCode}
                handleCopyCode={() => handleCopyText(coach?.invitationInfo.invitationCode || '', '邀请码已复制')}
                handleCopyLink={() => handleCopyText(coach?.invitationInfo.inviteUrl || '', '链接已复制')}
                handleSaveManualCode={handleSaveManualCode}
            />

            <InvitationPosterCard 
                coach={coach}
                posterRefExclusive={posterRefExclusive}
                posterRefOpen={posterRefOpen}
                savingPoster={savingPoster}
                savePoster={savePoster}
                handleCopyModeLink={(mode) => handleCopyText(
                    mode === 'exclusive' ? coach?.invitationInfo.inviteUrlExclusive! : coach?.invitationInfo.inviteUrlOpen!, 
                    '链接已复制'
                )}
            />

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
        </div>
    );
}