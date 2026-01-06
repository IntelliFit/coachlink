'use client';

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { useToastContext } from '@/context/ToastContext';
import { Copy, Gift, Users, Share2 } from 'lucide-react';
import axios from 'axios';

interface InviteInfo {
    inviteCode: string;
    inviteLink: string;
    shareText: string;
}

export default function ReferralPage() {
    const { showToast } = useToastContext();
    const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInvite = async () => {
            try {
                const res = await axios.post('/api/membership/referral/create-invite');
                if (res.data && res.data.success) {
                    setInviteInfo(res.data.data);
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

    if (loading) {
        return <div className="flex justify-center items-center h-96"><i className="pi pi-spin pi-spinner text-4xl text-primary-500"></i></div>;
    }

    return (
        <div className="container mx-auto p-4 max-w-2xl py-10 space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">邀请有礼</h1>
                <p className="text-surface-500">邀请好友注册，一起变强，双方均获 **3天高级会员**</p>
            </div>

            <div className="bg-surface-0 border border-orange-200 shadow-lg rounded-xl overflow-hidden">
                <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 border-b border-orange-100">
                    <h3 className="flex items-center gap-2 text-orange-700 text-lg font-semibold">
                        <Gift className="w-6 h-6" />
                        我的专属邀请链接
                    </h3>
                </div>
                <div className="space-y-6 p-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-surface-700">邀请链接</label>
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

                    <Button label="一键复制分享" icon={<Share2 className="w-4 h-4 mr-2" />} className="w-full bg-orange-600 border-orange-600 hover:bg-orange-700 hover:border-orange-700" onClick={() => copyToClipboard(inviteInfo?.shareText || '')} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface-0 border border-surface-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-surface-900 font-semibold">
                        <Users className="w-4 h-4" />
                        累计邀请
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-surface-900">0 <span className="text-sm font-normal text-surface-500">人</span></div>
                    </div>
                </div>
                <div className="bg-surface-0 border border-surface-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-surface-900 font-semibold">
                        <Gift className="w-4 h-4" />
                        获得奖励
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-surface-900">0 <span className="text-sm font-normal text-surface-500">天会员</span></div>
                    </div>
                </div>
            </div>
            
             <p className="text-xs text-center text-surface-400">
                * 奖励将在好友完成注册后自动发放。最终解释权归平台所有。
            </p>
        </div>
    );
}
