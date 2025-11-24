'use client';

import { useState } from 'react';
import { Button } from 'primereact/button';
import { useRouter } from 'next/navigation';
import { chatService } from '@/app/service/chatService';
import { useToastContext } from '@/context/ToastContext';

interface ContactCoachButtonProps {
    coachId: string;
    label?: string;
    icon?: string;
    className?: string;
    outlined?: boolean;
}

export function ContactCoachButton({
    coachId,
    label = '联系教练',
    icon = 'pi pi-comment',
    className,
    outlined = false
}: ContactCoachButtonProps) {
    const router = useRouter();
    const { showToast } = useToastContext();
    const [loading, setLoading] = useState(false);

    const handleContact = async () => {
        setLoading(true);
        try {
            const data = await chatService.getOrCreateConversation({ coach_id: coachId });
            
            if (data) {
                router.push(`/messages/${data.conversation_id}`);
            } else {
                showToast({
                    severity: 'error',
                    summary: '错误',
                    detail: '创建会话失败，请稍后重试'
                });
            }
        } catch (error: any) {
            console.error('联系教练失败:', error);
            showToast({
                severity: 'error',
                summary: '错误',
                detail: error?.message || '操作失败，请稍后重试'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            label={label}
            icon={icon}
            onClick={handleContact}
            loading={loading}
            outlined={outlined}
            className={className}
        />
    );
}

