'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { useSession } from 'next-auth/react';
import { Mail, Phone, Link2, ShieldCheck, X } from 'lucide-react';
import { useToastContext } from '@/context/ToastContext';
import WechatIcon from '@/components/icons/wechat';
import SliderCaptcha from '@/components/auth/SliderCaptcha';
import { smsService } from '@/app/service/smsService';
import { sesService } from '@/app/service/sesService';
import { userService } from '@/app/service/userService';

type ContactType = 'phone' | 'email';
const phoneRegex = /^1[3-9]\d{9}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function maskPhone(phone: string) {
    if (!phone) return '';
    return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

function maskEmail(email: string) {
    if (!email) return '';
    const [name, domain] = email.split('@');
    if (!domain) return email;
    const maskedName = name.length <= 2 ? `${name[0] || ''}*` : `${name.slice(0, 2)}***`;
    return `${maskedName}@${domain}`;
}

export default function AccountBindingSection() {
    const { data: session, update: updateSession } = useSession();
    const { showToast } = useToastContext();
    const user = session?.user as any;
    const boundPhone = (user?.phone as string | null) || '';
    const boundEmail = (user?.email as string | null) || '';
    const boundWechat = (user?.wechat_openid as string | null) || '';

    const [contactDialogOpen, setContactDialogOpen] = useState(false);
    const [contactType, setContactType] = useState<ContactType>('phone');
    const [contactValue, setContactValue] = useState('');
    const [verifyCode, setVerifyCode] = useState('');
    const [sending, setSending] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [sliderCaptchaVisible, setSliderCaptchaVisible] = useState(false);

    useEffect(() => {
        if (countdown <= 0) return;
        const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [countdown]);

    const resetContactDialog = () => {
        setContactValue(''); setVerifyCode(''); setSending(false); setConfirming(false); setCountdown(0);
    };

    const openBindDialog = (type: ContactType) => {
        setContactType(type); resetContactDialog(); setContactDialogOpen(true);
    };

    const canSend = useMemo(() => {
        const v = contactValue.trim();
        return contactType === 'phone' ? phoneRegex.test(v) : emailRegex.test(v);
    }, [contactType, contactValue]);

    const handleCaptchaSuccess = async (token: string) => {
        const v = contactValue.trim();
        setSending(true);
        try {
            const useMockSms = process.env.NEXT_PUBLIC_USE_MOCK_SMS === 'true';
            if (useMockSms) {
                setCountdown(60);
                showToast({ severity: 'info', summary: '验证码已发送', detail: '模拟验证码：123456' });
            } else {
                if (contactType === 'phone') {
                    await smsService.sendVerificationCode({ phoneNumber: v, captchaToken: token });
                } else {
                    await sesService.sendVerificationCode({ email: v, captchaToken: token });
                }
                setCountdown(60);
                showToast({ severity: 'success', summary: '验证码已发送' });
            }
        } catch (e: any) {
            showToast({ severity: 'error', summary: '发送失败', detail: e?.message || '请稍后重试' });
        } finally { setSending(false); }
    };

    const handleSendCode = () => {
        if (!canSend) {
            showToast({ severity: 'warn', summary: contactType === 'phone' ? '请输入正确的手机号' : '请输入正确的邮箱地址' });
            return;
        }
        if (countdown > 0) return;
        setSliderCaptchaVisible(true);
    };

    const handleConfirmBind = async () => {
        const v = contactValue.trim();
        const code = verifyCode.trim();
        if (!canSend) {
            showToast({ severity: 'warn', summary: contactType === 'phone' ? '请输入正确的手机号' : '请输入正确的邮箱地址' });
            return;
        }
        if (!code) { showToast({ severity: 'warn', summary: '请输入验证码' }); return; }
        setConfirming(true);
        try {
            await userService.bindContact({ type: contactType, value: v, verifyCode: code });
            try { await updateSession(); } catch { }
            showToast({ severity: 'success', summary: '绑定成功' });
            setContactDialogOpen(false); resetContactDialog();
        } catch (e: any) {
            showToast({
                severity: 'error',
                summary: e?.code === 'ACCOUNT_LINK_REQUIRED' ? '发现另一个账号' : '绑定失败',
                detail: e?.message || '请稍后重试'
            });
        } finally { setConfirming(false); }
    };

    const handleUnbind = async (type: 'phone' | 'email' | 'wechat') => {
        try {
            await userService.unbindContact({ type });
            try { await updateSession(); } catch { }
            showToast({ severity: 'success', summary: '解绑成功' });
        } catch (e: any) {
            showToast({ severity: 'error', summary: '解绑失败', detail: e?.message || '请稍后重试' });
        }
    };

    const startWechatBind = () => {
        const returnTo = window.location.pathname + window.location.search;
        window.location.href = `/wechat-auth/bind?returnTo=${encodeURIComponent(returnTo)}`;
    };

    const ItemRow = ({ icon, label, value, bound, onBind, onUnbind, bindText }: {
        icon: React.ReactNode; label: string; value: string; bound: boolean;
        onBind: () => void; onUnbind: () => void; bindText: string;
    }) => (
        <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-surface-50 border border-surface-200 flex items-center justify-center shrink-0">{icon}</div>
                <div className="min-w-0">
                    <div className="text-sm font-black text-surface-900">{label}</div>
                    <div className="text-xs text-surface-500 truncate">{bound ? value : '未绑定'}</div>
                </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Button type="button" onClick={onBind} className="h-9 px-4 rounded-2xl bg-primary-500 border-none text-surface font-black active:scale-[0.98] transition-all">{bindText}</Button>
                {bound && <Button type="button" onClick={onUnbind} className="h-9 px-4 rounded-2xl bg-surface-50 border border-surface-200 text-surface-700 font-black hover:border-rose-300 hover:text-rose-600 transition-all">解绑</Button>}
            </div>
        </div>
    );

    return (
        <>
            <div className="bg-surface rounded-2xl shadow-sm border border-surface-200 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm sm:text-lg font-black text-surface-900 flex items-center gap-2"><Link2 className="text-primary" size={20} />账号绑定</h2>
                </div>
                <div className="divide-y divide-surface-100">
                    <ItemRow icon={<Phone size={18} className="text-surface-500" />} label="手机号" value={boundPhone ? maskPhone(boundPhone) : ''} bound={!!boundPhone} onBind={() => openBindDialog('phone')} onUnbind={() => handleUnbind('phone')} bindText={boundPhone ? '换绑' : '绑定'} />
                    <ItemRow icon={<Mail size={18} className="text-surface-500" />} label="邮箱" value={boundEmail ? maskEmail(boundEmail) : ''} bound={!!boundEmail} onBind={() => openBindDialog('email')} onUnbind={() => handleUnbind('email')} bindText={boundEmail ? '换绑' : '绑定'} />
                    <ItemRow icon={<WechatIcon className="w-5 h-5" fill="#07C160" />} label="微信" value={boundWechat ? '已绑定' : ''} bound={!!boundWechat} onBind={startWechatBind} onUnbind={() => handleUnbind('wechat')} bindText={boundWechat ? '重新绑定' : '绑定'} />
                </div>
                <div className="mt-3 text-xs text-surface-500 leading-relaxed">同一账号同时绑定手机号和微信后，网页端与小程序会共用会员、训练计划和记录。未绑定时，两端可能是独立账号；系统不会自动用一边覆盖另一边。</div>
            </div>

            <Dialog visible={contactDialogOpen} onHide={() => { setContactDialogOpen(false); resetContactDialog(); }} showHeader={false} className="border-none shadow-2xl rounded-none sm:rounded-3xl overflow-hidden" style={{ width: '620px' }} contentClassName="p-0" pt={{ root: { className: 'shadow-none border-none bg-transparent min-h-screen flex items-center justify-center md:min-h-[fit-content] md:items-start md:justify-start' }, content: { className: 'rounded-none sm:rounded-[24px]' } }}>
                <div className="bg-surface p-8 relative">
                    <button onClick={() => { setContactDialogOpen(false); resetContactDialog(); }} className="absolute top-6 right-6 p-2 text-surface-400 hover:text-primary-500 hover:bg-primary-50 rounded-full transition-all"><X size={20} /></button>
                    <div className="mb-6">
                        <div className="text-[10px] font-black text-primary-500 uppercase tracking-[0.3em] mb-2">账号绑定</div>
                        <div className="text-2xl font-black text-surface-900">{contactType === 'phone' ? '绑定手机号' : '绑定邮箱'}</div>
                        <div className="mt-2 text-sm text-surface-500">
                            {contactType === 'phone'
                                ? '验证后可与绑定同一微信的小程序账号跨端同步；若手机号已有账号，系统会停止绑定并提示合并，不会覆盖数据。'
                                : '请输入新的邮箱，并完成验证码校验。'}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <InputText value={contactValue} onChange={(e) => setContactValue(e.target.value)} placeholder={contactType === 'phone' ? '手机号（11位）' : '邮箱地址'} className="w-full h-12 rounded-2xl bg-surface-50 border border-surface-200 font-bold" />
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-4 flex items-center text-surface-400"><ShieldCheck size={18} /></div>
                                <InputText value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} placeholder="6位验证码" maxLength={6} className="w-full h-12 pl-12 rounded-2xl bg-surface-50 border border-surface-200 font-bold" />
                            </div>
                            <Button type="button" onClick={handleSendCode} disabled={sending || countdown > 0 || !canSend} className="h-12 px-5 rounded-2xl bg-surface border border-surface-200 text-surface-700 font-black hover:border-primary-400 hover:text-primary-600 transition-all">{sending ? '发送中…' : countdown > 0 ? `${countdown}s` : '发送验证码'}</Button>
                        </div>
                        <div className="pt-2 flex justify-end gap-3">
                            <Button type="button" onClick={() => { setContactDialogOpen(false); resetContactDialog(); }} className="h-12 w-auto px-6 rounded-2xl bg-surface-50 border-none text-surface-600 font-black">取消</Button>
                            <Button type="button" loading={confirming} onClick={handleConfirmBind} className="h-12 w-auto px-6 rounded-2xl bg-primary-500 border-none text-surface font-black shadow-xl shadow-primary-100 active:scale-[0.98] transition-all">确认绑定</Button>
                        </div>
                    </div>
                </div>
            </Dialog>
            <SliderCaptcha visible={sliderCaptchaVisible} onHide={() => setSliderCaptchaVisible(false)} onSuccess={handleCaptchaSuccess} />
        </>
    );
}
