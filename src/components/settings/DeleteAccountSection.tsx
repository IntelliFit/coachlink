'use client';

import { useState } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { AlertTriangle } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { userService } from '@/app/service/userService';
import { useToastContext } from '@/context/ToastContext';

const REQUIRED_CONFIRMATION_TEXT = '注销账号';

export default function DeleteAccountSection() {
    const { showToast } = useToastContext();
    const [confirmationText, setConfirmationText] = useState('');
    const [loading, setLoading] = useState(false);

    const isConfirmMatched = confirmationText.trim() === REQUIRED_CONFIRMATION_TEXT;

    const handleDeleteAccount = async () => {
        if (!isConfirmMatched) {
            showToast({
                severity: 'warn',
                summary: '请先输入确认文案',
                detail: `请输入“${REQUIRED_CONFIRMATION_TEXT}”后再继续`,
            });
            return;
        }

        setLoading(true);
        try {
            await userService.deleteAccount({ confirmationText: confirmationText.trim() });
            showToast({
                severity: 'success',
                summary: '账号已注销',
                detail: '即将退出登录',
            });
            await signOut({ callbackUrl: '/' });
        } catch (error: any) {
            showToast({
                severity: 'error',
                summary: '注销失败',
                detail: error?.message || '请稍后重试',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-surface rounded-2xl shadow-sm border border-rose-200 p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="text-rose-500" size={20} />
                <h2 className="text-sm sm:text-lg font-black text-surface-900">危险操作：注销账号</h2>
            </div>

            <p className="text-sm text-surface-500 mb-4">
                注销后将清空登录凭据（手机号/邮箱/微信），账号将无法再登录。此操作不可恢复。
            </p>

            <div className="space-y-3">
                <div>
                    <label className="block text-sm font-bold text-surface-700 mb-2">
                        请输入“{REQUIRED_CONFIRMATION_TEXT}”以确认
                    </label>
                    <InputText
                        value={confirmationText}
                        onChange={(e) => setConfirmationText(e.target.value)}
                        placeholder={REQUIRED_CONFIRMATION_TEXT}
                        className="w-full h-10 rounded-xl bg-surface-50 border border-surface-200 font-bold text-sm"
                    />
                </div>

                <div className="flex justify-end">
                    <Button
                        type="button"
                        severity="danger"
                        onClick={handleDeleteAccount}
                        loading={loading}
                        disabled={!isConfirmMatched}
                        className="h-10 px-4 rounded-xl font-black"
                    >
                        立即注销
                    </Button>
                </div>
            </div>
        </div>
    );
}
