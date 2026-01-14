'use client';

import React, { useState, useEffect, useRef } from 'react';
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

    const validateInvitationCode = async (code: string) => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        if (!code.trim()) {
            setValidationStatus(null);
            setValidationMessage(null);
            return;
        }
        if (!/^\d{3,8}$/.test(code)) {
            setValidationStatus('invalid');
            setValidationMessage('需为 3-8 位纯数字');
            return;
        }

        setValidationStatus('checking');
        debounceTimer.current = setTimeout(async () => {
            try {
                const result = await coachService.checkInvitationCodeAvailability({ invitationCode: code });
                if (result?.available) {
                    setValidationStatus('valid');
                    setValidationMessage('该邀请码可用');
                } else {
                    setValidationStatus('invalid');
                    setValidationMessage(result?.message || '已被占用');
                }
            } catch {
                setValidationStatus('invalid');
                setValidationMessage('验证异常');
            }
        }, 400);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '').substring(0, 8);
        setManualCode(value);
        validateInvitationCode(value);
    };

    const isSaveDisabled = isSavingManualCode || !manualCode.trim() || validationStatus !== 'valid';

    return (
        <div className="bg-surface border border-surface-100 rounded-[24px] p-8 transition-all duration-300 shadow-sm hover:shadow-md">
            {/* 头部：排版符号化 */}
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h3 className="text-xl font-black text-surface-900 tracking-tighter italic">
                        我的邀请码 <span className="text-primary-500 not-italic">/ Code</span>
                    </h3>
                    <p className="text-xs font-bold text-surface-400 mt-1 uppercase tracking-wider">
                        建立学员自动关联的唯一凭证
                    </p>
                </div>
                {!coach?.invitationInfo.invitationCode && !showManualInput && (
                    <Button
                        label="立即设置"
                        icon="pi pi-plus"
                        className="p-button-text p-button-sm font-bold text-primary-500 hover:bg-primary-50 rounded-xl"
                        onClick={() => setShowManualInput(true)}
                    />
                )}
            </div>

            <div className="space-y-8">
                {/* 邀请码核心展示区 - 数值中心化 */}
                <div className="relative group bg-surface-50/50 rounded-[20px] p-6 border border-surface-100/50 transition-colors hover:bg-surface-50">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-surface-400 uppercase tracking-[0.2em]">数字凭证</span>
                            <div className="text-5xl font-black text-surface-900 tracking-tighter font-mono">
                                {coach?.invitationInfo.invitationCode || <span className="text-surface-200">------</span>}
                            </div>
                        </div>
                        {coach?.invitationInfo.invitationCode && (
                            <button
                                onClick={handleCopyCode}
                                className="w-12 h-12 rounded-2xl bg-surface border border-surface-100 shadow-sm flex items-center justify-center text-surface-600 hover:text-primary-500 hover:border-primary-200 transition-all active:scale-90"
                            >
                                <i className="pi pi-copy text-lg" />
                            </button>
                        )}
                    </div>
                </div>

                {/* 手动设置面板 - 低饱和功能色 */}
                {showManualInput && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500 bg-primary-50/30 border border-primary-100/50 rounded-[20px] p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                            <span className="text-xs font-black text-primary-700 uppercase tracking-widest">初始化设置</span>
                        </div>

                        <div className="flex gap-3">
                            <div className="flex-1 space-y-2">
                                <InputText
                                    value={manualCode}
                                    onChange={handleInputChange}
                                    placeholder="输入 3-8 位数字"
                                    className={`w-full py-3.5 px-4 bg-surface/80 rounded-xl border-none shadow-inner text-lg font-bold tracking-widest focus:ring-2 focus:ring-primary-500/20 ${validationStatus === 'invalid' ? 'ring-2 ring-red-500/20' : ''}`}
                                />
                                {validationStatus && (
                                    <p className={`text-[11px] font-bold px-1 flex items-center gap-1.5 ${validationStatus === 'valid' ? 'text-green-600' :
                                            validationStatus === 'invalid' ? 'text-red-500' : 'text-primary-500'
                                        }`}>
                                        <i className={`pi ${validationStatus === 'checking' ? 'pi-spin pi-spinner' : validationStatus === 'valid' ? 'pi-check-circle' : 'pi-exclamation-circle'} text-[10px]`} />
                                        {validationMessage}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-col gap-2">
                                <Button
                                    icon="pi pi-check"
                                    onClick={handleSaveManualCode}
                                    disabled={isSaveDisabled}
                                    className="p-button-primary shadow-lg shadow-primary-200 h-[52px] w-[52px] rounded-xl active:scale-95 transition-all"
                                />
                                <Button
                                    icon="pi pi-times"
                                    onClick={() => setShowManualInput(false)}
                                    className="p-button-text p-button-secondary h-[40px] w-[52px] rounded-xl active:scale-95"
                                />
                            </div>
                        </div>
                        <p className="text-[11px] text-primary-400 font-medium mt-4 leading-relaxed">
                            <i className="pi pi-info-circle mr-1" />
                            邀请码具有唯一性且仅支持设置一次，建议使用您的幸运数字或手机尾号。
                        </p>
                    </div>
                )}

                {/* 链接区域 - 仅在有邀请码时展示，符合信息约束规范 */}
                {coach?.invitationInfo?.invitationCode && (
                    <div className="pt-6 border-t border-surface-100/50 animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-[0.2em]">
                                专属注册链接 <span className="text-orange-500/30 ml-1">/ Link</span>
                            </label>
                            <button
                                onClick={handleCopyLink}
                                className="text-[11px] font-black text-orange-500 hover:text-orange-600 transition-all active:scale-95 flex items-center gap-1.5"
                            >
                                <i className="pi pi-copy text-[10px]" />
                                一键复制
                            </button>
                        </div>

                        <div
                            className="group/link bg-surface-50/50 hover:bg-white hover:shadow-sm px-4 py-3 rounded-[16px] border border-surface-100 flex items-center gap-3 transition-all duration-300"
                        >
                            <div className="w-6 h-6 rounded-lg bg-white border border-surface-100 flex items-center justify-center shadow-xs">
                                <i className="pi pi-link text-[10px] text-surface-400 group-hover/link:text-orange-500 transition-colors" />
                            </div>
                            <span className="flex-1 text-[11px] text-surface-500 font-bold truncate tracking-tight italic opacity-80 group-hover/link:opacity-100">
                                {coach.invitationInfo.inviteUrl}
                            </span>
                        </div>

                        {/* 呼吸感提示：利用视觉本能引导 */}
                        <p className="mt-3 px-1 text-[9px] font-medium text-surface-400 leading-relaxed italic">
                            * 链接已包含您的专属邀请码 <span className="text-surface-900 font-black">{coach.invitationInfo.invitationCode}</span>，学员注册后将直接建立管理关联。
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};