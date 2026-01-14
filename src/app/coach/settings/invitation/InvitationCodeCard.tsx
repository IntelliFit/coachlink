import React, { useState, useEffect, useRef } from 'react';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { GetCoachResponseDto } from '@/app/api/coach/get-coach/entity';
import { coachService } from '@/app/service/coachService';

interface Props {
    coach: GetCoachResponseDto | null;
    showManualInput: boolean;
    manualCode: string;
    isSavingManualCode: boolean;
    setShowManualInput: (val: boolean) => void;
    setManualCode: (val: string) => void;
    handleCopyCode: () => void;
    handleCopyLink: () => void;
    handleSaveManualCode: () => void;
}

export const InvitationCodeCard: React.FC<Props> = ({
    coach, showManualInput, manualCode, isSavingManualCode,
    setShowManualInput, setManualCode, handleCopyCode, handleCopyLink, handleSaveManualCode
}) => {
    const [validationStatus, setValidationStatus] = useState<'valid' | 'invalid' | 'checking' | null>(null);
    const [validationMessage, setValidationMessage] = useState<string | null>(null);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Debounced validation function
    const validateInvitationCode = async (code: string) => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        if (!code.trim()) {
            setValidationStatus(null);
            setValidationMessage(null);
            return;
        }

        // Only validate if code is 3-8 digits
        if (!/^\d{3,8}$/.test(code)) {
            setValidationStatus('invalid');
            setValidationMessage('邀请码必须是3-8位数字');
            return;
        }

        setValidationStatus('checking');
        setValidationMessage('正在检查...');

        debounceTimer.current = setTimeout(async () => {
            try {
                const result = await coachService.checkInvitationCodeAvailability({ invitationCode: code });
                if (result) {
                    if (result.available) {
                        setValidationStatus('valid');
                        setValidationMessage(result.message);
                    } else {
                        setValidationStatus('invalid');
                        setValidationMessage(result.message);
                    }
                } else {
                    setValidationStatus('invalid');
                    setValidationMessage('验证失败，请重试');
                }
            } catch (error) {
                setValidationStatus('invalid');
                setValidationMessage('验证失败，请重试');
            }
        }, 300);
    };

    // Handle input change with validation
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '').substring(0, 8);
        setManualCode(value);
        
        // Trigger validation
        validateInvitationCode(value);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, []);

    // Determine if save button should be disabled
    const isSaveDisabled = isSavingManualCode || 
                          !manualCode.trim() || 
                          validationStatus === 'invalid' || 
                          validationStatus === 'checking';

    return (
        <Card title="我的邀请码" subTitle="分享此邀请码或链接，学员注册后将自动与您建立关联">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-surface-700 mb-2">邀请码</label>
                    <div className="flex gap-2">
                        <InputText
                            value={coach?.invitationInfo.invitationCode || ''}
                            readOnly
                            className="flex-1 text-center font-mono text-lg tracking-widest"
                        />
                        <Button icon="pi pi-copy" className="p-button-outlined" onClick={handleCopyCode} tooltip="复制邀请码" />
                        {!coach?.invitationInfo.invitationCode && (
                            <Button label="手动设置" className="p-button-outlined" onClick={() => setShowManualInput(true)} />
                        )}
                    </div>
                </div>

                {showManualInput && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                            <i className="pi pi-info-circle text-blue-500" />
                            <span className="font-medium text-blue-800">手动设置邀请码</span>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <InputText
                                    value={manualCode}
                                    onChange={handleInputChange}
                                    placeholder="输入3-8位数字"
                                    className={`w-full ${validationStatus === 'invalid' ? 'p-invalid' : ''}`}
                                />
                                {validationStatus && (
                                    <div className={`mt-1 text-xs ${
                                        validationStatus === 'valid' ? 'text-green-600' : 
                                        validationStatus === 'invalid' ? 'text-red-600' : 
                                        'text-blue-600'
                                    }`}>
                                        {validationMessage}
                                    </div>
                                )}
                            </div>
                            <Button
                                label="保存"
                                icon={isSavingManualCode ? 'pi pi-spin pi-spinner' : 'pi pi-save'}
                                onClick={handleSaveManualCode}
                                disabled={isSaveDisabled}
                            />
                            <Button icon="pi pi-times" className="p-button-outlined p-button-secondary" onClick={() => setShowManualInput(false)} />
                        </div>
                        <p className="text-xs text-blue-600 mt-2">注意：邀请码只能设置一次，设置后无法更改。</p>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-surface-700 mb-2">邀请链接</label>
                    <div className="flex gap-2">
                        <InputText value={coach?.invitationInfo.inviteUrl || ''} readOnly className="flex-1 text-sm text-surface-500" />
                        <Button icon="pi pi-copy" className="p-button-outlined" onClick={handleCopyLink} />
                    </div>
                </div>
            </div>
        </Card>
    );
};