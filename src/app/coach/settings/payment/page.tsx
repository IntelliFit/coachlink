'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { FileUpload } from 'primereact/fileupload';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { useToastContext } from '@/context/ToastContext';
import WeixinzhifuIcon from '@/components/icons/weixinzhifu';
import ZhifubaoIcon from '@/components/icons/zhifubao';

interface QrCodeItem {
    type: 'wechat' | 'alipay';
    name: string;
    url: string;
}

export default function CoachPaymentSettingsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();

    const [loading, setLoading] = useState(true);
    const [allowPersonalQrcode, setAllowPersonalQrcode] = useState(true);
    const [qrCodes, setQrCodes] = useState<QrCodeItem[]>([]);
    const [uploading, setUploading] = useState<'wechat' | 'alipay' | null>(null);

    useEffect(() => {
        if (status === 'loading') return;

        if (!session?.user?.id) {
            router.push('/login');
            return;
        }

        loadQrCodes();
    }, [session, status]);

    const loadQrCodes = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/coach/payment-qrcodes');
            const data = await res.json();

            if (data.success) {
                setQrCodes(data.data.qrCodes || []);
                setAllowPersonalQrcode(data.data.allowPersonalQrcode);
            } else {
                showToast({ severity: 'error', summary: '错误', detail: data.message });
            }
        } catch (error) {
            console.error('加载收款码失败:', error);
            showToast({ severity: 'error', summary: '错误', detail: '加载收款码失败' });
        } finally {
            setLoading(false);
        }
    };

    // 使用服务端 API 上传文件
    const uploadFile = async (file: File, type: 'wechat' | 'alipay'): Promise<string> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        const res = await fetch('/api/coach/upload-qrcode', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.message || '上传失败');
        }

        return data.data.url;
    };

    const handleUpload = async (event: any, type: 'wechat' | 'alipay') => {
        const file = event.files[0];
        if (!file) return;

        setUploading(type);
        try {
            const url = await uploadFile(file, type);

            // 更新本地状态
            const name = type === 'wechat' ? '微信支付' : '支付宝';
            const existingIndex = qrCodes.findIndex(qr => qr.type === type);

            let newQrCodes: QrCodeItem[];
            if (existingIndex >= 0) {
                newQrCodes = [...qrCodes];
                newQrCodes[existingIndex] = { type, name, url };
            } else {
                newQrCodes = [...qrCodes, { type, name, url }];
            }

            setQrCodes(newQrCodes);

            // 保存到后端
            await saveQrCodes(newQrCodes);

            showToast({ severity: 'success', summary: '成功', detail: `${name}收款码上传成功` });
        } catch (error: any) {
            showToast({ severity: 'error', summary: '错误', detail: error.message || '上传失败' });
        } finally {
            setUploading(null);
        }
    };

    const saveQrCodes = async (codes: QrCodeItem[]) => {
        try {
            const res = await fetch('/api/coach/payment-qrcodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qrCodes: codes })
            });

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.message);
            }
        } catch (error: any) {
            showToast({ severity: 'error', summary: '错误', detail: error.message || '保存失败' });
        }
    };

    const handleDelete = async (type: 'wechat' | 'alipay') => {
        const newQrCodes = qrCodes.filter(qr => qr.type !== type);
        setQrCodes(newQrCodes);
        await saveQrCodes(newQrCodes);
        showToast({ severity: 'success', summary: '成功', detail: '收款码已删除' });
    };

    const getQrCode = (type: 'wechat' | 'alipay') => {
        return qrCodes.find(qr => qr.type === type);
    };

    const SkeletonCard = () => (
        <div className="bg-surface p-8 rounded-[24px] border border-surface-100/60 shadow-sm space-y-6 animate-pulse">
            <div className="flex flex-col items-center">
                <div className="w-24 h-4 bg-surface-100 rounded-full mb-6" />
                <div className="w-48 h-48 bg-surface-50 rounded-[20px] mb-8" />
                <div className="flex gap-3 w-full">
                    <div className="h-12 bg-surface-100 rounded-xl flex-1" />
                    <div className="h-12 w-12 bg-surface-50 rounded-xl" />
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="space-y-10">
                <div className="flex flex-col gap-2">
                    <div className="h-8 w-32 bg-surface-100 rounded-lg animate-pulse" />
                    <div className="h-4 w-64 bg-surface-50 rounded-lg animate-pulse" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
            </div>
        );
    }

    if (!allowPersonalQrcode) {
        return (
            <Message
                severity="warn"
                text="管理员已禁止您使用个人收款码。如有疑问请联系管理员。"
                className="w-full"
            />
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-64 gap-4">
                <ProgressSpinner style={{ width: '40px', height: '40px' }} strokeWidth="4" fill="transparent" animationDuration=".5s" />
                <span className="text-xs font-bold text-surface-400 uppercase tracking-widest">正在同步支付凭证...</span>
            </div>
        );
    }

    if (!allowPersonalQrcode) {
        return (
            <div className="p-8 rounded-[24px] bg-red-50 border border-red-100 flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-600">
                    <i className="pi pi-lock text-lg" />
                </div>
                <div>
                    <h4 className="font-black text-red-900 tracking-tight">功能访问受限</h4>
                    <p className="text-sm text-red-700/70 font-medium">管理员已禁止使用个人收款码。如有疑问请联系平台管理人员。</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {['wechat', 'alipay'].map((type) => {
                    const qr = getQrCode(type as 'wechat' | 'alipay');
                    const isWechat = type === 'wechat';
                    const isUploading = uploading === type;

                    return (
                        <div
                            key={type}
                            className="group relative bg-surface p-8 rounded-[24px] border border-surface-100/60 shadow-[0_4px_20px_-12px_rgba(0,0,0,0.05)] transition-all duration-500 hover:shadow-[0_12px_40px_-15px_rgba(0,0,0,0.1)] active:scale-[0.99]"
                        >
                            {/* 强调色联动：顶部标志条 */}

                            <div className="flex flex-col items-center text-center">
                                <div className="flex items-center gap-2 mb-6">
                                    {isWechat ? (
                                        <WeixinzhifuIcon width="16" height="16" />
                                    ) : (
                                        <ZhifubaoIcon width="16" height="16" fill="#1677FF" />
                                    )}
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-surface-400">
                                        {isWechat ? '微信支付' : '支付宝'}
                                    </span>
                                </div>

                                <div className="relative w-48 h-48 mb-8 group/qr">
                                    {qr ? (
                                        <div className="relative w-full h-full rounded-[20px] border-2 border-surface-50 p-2 bg-surface-50/30 transition-transform duration-500 group-hover/qr:scale-105">
                                            <img src={qr.url} alt={qr.name} className="w-full h-full object-cover rounded-[12px]" />
                                            {isUploading && (
                                                <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm flex items-center justify-center">
                                                    <i className="pi pi-spin pi-spinner text-orange-500 text-xl" />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="w-full h-full rounded-[20px] border-2 border-dashed border-surface-200 bg-surface-50/50 flex flex-col items-center justify-center gap-3">
                                            <i className={`pi ${isWechat ? 'pi-wechat' : 'pi-wallet'} text-3xl text-surface-300`} />
                                            <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">未绑定收款码</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3 w-full">
                                    <div className="flex-1">
                                        <FileUpload
                                            mode="basic"
                                            accept="image/*"
                                            maxFileSize={5000000}
                                            chooseLabel={qr ? "更新" : `上传${isWechat ? '微信' : '支付宝'}`}
                                            className="w-full h-12 rounded-2xl font-bold tracking-tight active:scale-[0.95] transition-all"
                                            auto
                                            customUpload
                                            uploadHandler={(e) => handleUpload(e, type as 'wechat' | 'alipay')}
                                            disabled={isUploading}
                                        />
                                    </div>
                                    {qr && (
                                        <Button
                                            icon="pi pi-trash"
                                            onClick={() => handleDelete(type as 'wechat' | 'alipay')}
                                            className="w-12 h-12 rounded-xl bg-red-50 text-red-500 border-none hover:bg-red-100 transition-colors active:scale-[0.95]"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 注意事项：呼吸感提示框 */}
            <div className="p-6 rounded-[20px] bg-surface-50/50 border border-surface-100 flex gap-4">
                <div className="w-1.5 h-auto rounded-full bg-surface-200" />
                <div>
                    <h4 className="text-sm font-black text-surface-900 tracking-tight mb-2">注意事项</h4>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5">
                        {['支持 JPG、PNG 格式 (Max 5MB)', '建议使用清晰的原始二维码', '学员订阅时将通过此码进行结算', '建议双渠道配置以提升转化率'].map((text, i) => (
                            <li key={i} className="text-xs font-bold text-surface-500 flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-orange-500/40" />
                                {text}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
