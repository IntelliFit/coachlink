'use client';

import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import {
    COACH_EXIT_NOTE_MAX_LENGTH,
    coachExitReasonsFor,
    type CoachExitCandidate,
    type CoachExitReason,
} from '@coachlink/core/src/coachFunnel';
import { trackCoachFunnel } from '@/lib/coachFunnelClient';
import { useToastContext } from '@/context/ToastContext';

interface CoachExitDialogProps {
    candidate: CoachExitCandidate | null;
    onClose: () => void;
}

/** 学员离开教练页后问一个「为什么没订阅」，一次点选就结束，可以跳过。 */
export default function CoachExitDialog({ candidate, onClose }: CoachExitDialogProps) {
    const { showToast } = useToastContext();
    const [otherOpen, setOtherOpen] = useState(false);
    const [note, setNote] = useState('');

    if (!candidate) return null;

    const finish = () => {
        setOtherOpen(false);
        setNote('');
        onClose();
    };

    const submit = (reason: CoachExitReason, text?: string) => {
        trackCoachFunnel('exit_reason', {
            coachId: candidate.coachId,
            reason,
            note: text,
            properties: { trigger: candidate.trigger },
        });
        showToast({ severity: 'success', summary: '谢谢你的反馈' });
        finish();
    };

    const skip = () => {
        trackCoachFunnel('exit_skip', { coachId: candidate.coachId, properties: { trigger: candidate.trigger } });
        finish();
    };

    return (
        <Dialog
            visible
            header={`这次没有订阅${candidate.coachName ? ` ${candidate.coachName}` : '这位教练'}，主要是因为？`}
            onHide={skip}
            style={{ width: '32rem' }}
            breakpoints={{ '640px': '92vw' }}
            footer={<Button label="跳过" text severity="secondary" onClick={skip} />}
        >
            <p className="text-sm text-surface-500 mt-0 mb-3">选一项就好，帮我们和教练做得更好</p>
            <div className="flex flex-col gap-2">
                {coachExitReasonsFor(candidate.canBuy).map((reason) => (
                    <Button
                        key={reason.value}
                        label={reason.label}
                        outlined
                        severity="secondary"
                        className="w-full justify-start text-left"
                        onClick={() => (reason.value === 'other' ? setOtherOpen(true) : submit(reason.value))}
                    />
                ))}
            </div>
            {otherOpen && (
                <div className="mt-3 flex gap-2">
                    <InputText
                        className="flex-1"
                        value={note}
                        maxLength={COACH_EXIT_NOTE_MAX_LENGTH}
                        placeholder="想说点什么（选填，请勿填写手机号等隐私）"
                        onChange={(e) => setNote(e.target.value)}
                    />
                    <Button label="提交" onClick={() => submit('other', note.trim() || undefined)} />
                </div>
            )}
        </Dialog>
    );
}
